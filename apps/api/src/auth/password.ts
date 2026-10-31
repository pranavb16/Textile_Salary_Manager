import { argon2, randomBytes, timingSafeEqual } from "node:crypto";

const memory = 19456;
const passes = 2;
const parallelism = 1;
const tagLength = 32;

function derive(password: string, nonce: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2("argon2id", { message: password, nonce, memory, passes, parallelism, tagLength }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const characterCount = Array.from(password).length;
  if (characterCount < 6 || characterCount > 1024) throw new Error("Use a password of 6 to 1024 characters.");
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `$argon2id$v=19$m=${memory},t=${passes},p=${parallelism}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const match = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/.exec(encoded);
  if (!match) return false;
  const expected = Buffer.from(match[2], "base64url");
  const actual = await derive(password, Buffer.from(match[1], "base64url"));
  return timingSafeEqual(actual, expected);
}
