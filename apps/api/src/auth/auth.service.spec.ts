import { hashPassword, verifyPassword } from "./password.js";
import { ACCESS_LIFETIME_MS, AuthService, LOCK_LIFETIME_MS, SESSION_LIFETIME_MS } from "./auth.service.js";

type Account = { id: number; username: string; passwordHash: string; failedAttempts: number; lockedUntil: Date | null };
type Session = { id: string; accountId: number; account: Account; refreshTokenHash: string; previousRefreshTokenHash: string | null; previousRefreshUntil: Date | null; expiresAt: Date };
type Access = { hash: string; sessionId: string; expiresAt: Date; session?: Session };

function harness(passwordHash: string) {
  const account: Account = { id: 1, username: "admin", passwordHash, failedAttempts: 0, lockedUntil: null };
  const sessions = new Map<string, Session>();
  const accessTokens = new Map<string, Access>();
  const ipLimits = new Map<string, { ipHash: string; failedAttempts: number; lockedUntil: Date | null; updatedAt: Date }>();
  const tx = {
    $queryRaw: async () => [],
    authAccount: {
      findUnique: async () => account,
      update: async ({ data }: { data: Partial<Account> }) => Object.assign(account, data),
    },
    authIpLimit: {
      findUnique: async ({ where }: { where: { ipHash: string } }) => ipLimits.get(where.ipHash) ?? null,
      upsert: async ({ where, create, update }: { where: { ipHash: string }; create: { ipHash: string; failedAttempts: number; lockedUntil: Date | null }; update: { failedAttempts: number; lockedUntil: Date | null } }) => {
        const row = { ...(ipLimits.get(where.ipHash) ?? create), ...update, updatedAt: new Date() };
        ipLimits.set(where.ipHash, row);
        return row;
      },
      deleteMany: async ({ where }: { where: { ipHash?: string; updatedAt?: { lt: Date } } }) => {
        if (where.ipHash) ipLimits.delete(where.ipHash);
        else if (where.updatedAt) for (const [key, row] of ipLimits) if (row.updatedAt < where.updatedAt.lt) ipLimits.delete(key);
      },
    },
    authSession: {
      create: async ({ data }: { data: { id: string; accountId: number; refreshTokenHash: string; expiresAt: Date; accessTokens: { create: Access } } }) => {
        const session: Session = { id: data.id, accountId: data.accountId, account, refreshTokenHash: data.refreshTokenHash, previousRefreshTokenHash: null, previousRefreshUntil: null, expiresAt: data.expiresAt };
        sessions.set(session.id, session);
        accessTokens.set(data.accessTokens.create.hash, { ...data.accessTokens.create, sessionId: session.id });
        return session;
      },
      findUnique: async ({ where }: { where: { id: string } }) => sessions.get(where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Session> }) => Object.assign(sessions.get(where.id)!, data),
      deleteMany: async ({ where }: { where: { id?: string; expiresAt?: { lte: Date } } }) => {
        for (const [id, session] of sessions) if (id === where.id || (where.expiresAt && session.expiresAt <= where.expiresAt.lte)) {
          sessions.delete(id);
          for (const [hash, access] of accessTokens) if (access.sessionId === id) accessTokens.delete(hash);
        }
      },
    },
    authAccessToken: {
      create: async ({ data }: { data: Access }) => { accessTokens.set(data.hash, data); return data; },
      findUnique: async ({ where }: { where: { hash: string } }) => {
        const access = accessTokens.get(where.hash);
        const session = access && sessions.get(access.sessionId);
        return access && session ? { ...access, session } : null;
      },
      deleteMany: async ({ where }: { where: { expiresAt: { lte: Date } } }) => {
        for (const [hash, access] of accessTokens) if (access.expiresAt <= where.expiresAt.lte) accessTokens.delete(hash);
      },
    },
  };
  let previousTransaction = Promise.resolve();
  const prisma = { ...tx, $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => {
    const wait = previousTransaction;
    let release!: () => void;
    previousTransaction = new Promise<void>((resolve) => { release = resolve; });
    await wait;
    try { return await callback(tx); }
    finally { release(); }
  } };
  return { service: new AuthService(prisma as never), account, sessions, ipLimits };
}

describe("single-account authentication", () => {
  let passwordHash: string;
  beforeAll(async () => { passwordHash = await hashPassword("correct horse battery staple"); });

  it("hashes passwords with Argon2id and checks the supplied password", async () => {
    expect(passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    await expect(verifyPassword("correct horse battery staple", passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", passwordHash)).resolves.toBe(false);
  });

  it("accepts six-character passwords for provisioning and rejects shorter ones", async () => {
    const shortHash = await hashPassword("123456");
    await expect(verifyPassword("123456", shortHash)).resolves.toBe(true);
    await expect(hashPassword("12345")).rejects.toThrow("6 to 1024 characters");
    await expect(hashPassword("😀😀😀")).rejects.toThrow("6 to 1024 characters");
  });

  it("locks on the fifth wrong password, blocks even the correct password, then allows login after 15 minutes", async () => {
    const { service, account } = harness(passwordHash);
    for (let attempt = 1; attempt <= 4; attempt++) {
      await expect(service.login("admin", "wrong", "127.0.0.1")).rejects.toMatchObject({ status: 401 });
      expect(account.failedAttempts).toBe(attempt);
    }
    const beforeFifth = Date.now();
    await expect(service.login("admin", "wrong", "127.0.0.1")).rejects.toMatchObject({ status: 429 });
    expect(account.lockedUntil!.getTime()).toBeGreaterThanOrEqual(beforeFifth + LOCK_LIFETIME_MS);
    await expect(service.login("admin", "correct horse battery staple", "127.0.0.1")).rejects.toMatchObject({ status: 429 });
    account.lockedUntil = new Date(Date.now() - 1);
    const result = await service.login("admin", "correct horse battery staple", "127.0.0.1");
    expect(result.kind).toBe("success");
    expect(account.failedAttempts).toBe(0);
    expect(account.lockedUntil).toBeNull();
  });

  it("resets consecutive failures after a successful login and limits unknown usernames by IP", async () => {
    const { service, account, ipLimits } = harness(passwordHash);
    await expect(service.login("admin", "wrong", "127.0.0.1")).rejects.toMatchObject({ status: 401 });
    await service.login("admin", "correct horse battery staple", "127.0.0.1");
    expect(account.failedAttempts).toBe(0);
    for (let attempt = 1; attempt <= 4; attempt++) await expect(service.login("other", "wrong", "127.0.0.2")).rejects.toMatchObject({ status: 401 });
    await expect(service.login("other", "wrong", "127.0.0.2")).rejects.toMatchObject({ status: 429 });
    expect([...ipLimits.values()][0].failedAttempts).toBe(5);
  });

  it("counts parallel failures together so only five attempts reach the lockout", async () => {
    const { service, account } = harness(passwordHash);
    const outcomes = await Promise.allSettled(Array.from({ length: 7 }, () => service.login("admin", "wrong", "127.0.0.1")));
    expect(outcomes.map((outcome) => outcome.status === "rejected" ? (outcome.reason as { status: number }).status : 200)).toEqual([401, 401, 401, 401, 429, 429, 429]);
    expect(account.failedAttempts).toBe(5);
  });

  it("allows separate devices and simultaneous refresh requests from tabs", async () => {
    const { service } = harness(passwordHash);
    const [first, second] = await Promise.all([
      service.login("admin", "correct horse battery staple", "127.0.0.1"),
      service.login("admin", "correct horse battery staple", "127.0.0.2"),
    ]);
    const [tabOne, tabTwo] = await Promise.all([service.refresh(first.refreshCookie), service.refresh(first.refreshCookie)]);
    expect([tabOne.refreshCookie, tabTwo.refreshCookie].filter(Boolean)).toHaveLength(1);
    await expect(service.authenticate(tabOne.accessToken)).resolves.toMatchObject({ username: "admin" });
    await expect(service.authenticate(tabTwo.accessToken)).resolves.toMatchObject({ username: "admin" });
    await service.logout(first.refreshCookie);
    await expect(service.authenticate(second.accessToken)).resolves.toMatchObject({ username: "admin" });
  });

  it("rotates refresh tokens, caps access at the 24-hour deadline, and revokes access on logout", async () => {
    const { service, sessions } = harness(passwordHash);
    const login = await service.login("admin", "correct horse battery staple", "127.0.0.1");
    expect(login.sessionExpiresAt.getTime() - Date.now()).toBeLessThanOrEqual(SESSION_LIFETIME_MS);
    expect(login.accessExpiresAt.getTime() - Date.now()).toBeLessThanOrEqual(ACCESS_LIFETIME_MS);
    await expect(service.authenticate(login.accessToken)).resolves.toMatchObject({ username: "admin" });
    const session = [...sessions.values()][0];
    session.expiresAt = new Date(Date.now() + 30_000);
    const refreshed = await service.refresh(login.refreshCookie);
    expect(refreshed.accessExpiresAt.getTime()).toBe(session.expiresAt.getTime());
    expect(refreshed.refreshCookie).not.toBe(login.refreshCookie);
    const concurrent = await service.refresh(login.refreshCookie);
    expect(concurrent.refreshCookie).toBeUndefined();
    await expect(service.authenticate(concurrent.accessToken)).resolves.toMatchObject({ username: "admin" });
    await service.logout(refreshed.refreshCookie);
    await expect(service.authenticate(refreshed.accessToken)).rejects.toMatchObject({ status: 401 });
    await expect(service.refresh(refreshed.refreshCookie)).rejects.toMatchObject({ status: 401 });
  });

  it("refuses refresh and access once the original deadline has passed", async () => {
    const { service, sessions } = harness(passwordHash);
    const login = await service.login("admin", "correct horse battery staple", "127.0.0.1");
    [...sessions.values()][0].expiresAt = new Date(Date.now() - 1);
    await expect(service.refresh(login.refreshCookie)).rejects.toMatchObject({ status: 401 });
    await expect(service.authenticate(login.accessToken)).rejects.toMatchObject({ status: 401 });
  });
});
