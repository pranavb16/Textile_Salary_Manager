CREATE TABLE "auth_accounts" (
    "id" INTEGER NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_accounts_single_row" CHECK ("id" = 1)
);
CREATE UNIQUE INDEX "auth_accounts_username_key" ON "auth_accounts"("username");

CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "account_id" INTEGER NOT NULL,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "previous_refresh_token_hash" VARCHAR(64),
    "previous_refresh_until" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");
CREATE UNIQUE INDEX "auth_sessions_previous_refresh_token_hash_key" ON "auth_sessions"("previous_refresh_token_hash");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "auth_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "auth_access_tokens" (
    "hash" VARCHAR(64) NOT NULL,
    "session_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "auth_access_tokens_pkey" PRIMARY KEY ("hash")
);
CREATE INDEX "auth_access_tokens_expires_at_idx" ON "auth_access_tokens"("expires_at");
ALTER TABLE "auth_access_tokens" ADD CONSTRAINT "auth_access_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "auth_ip_limits" (
    "ip_hash" VARCHAR(64) NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "auth_ip_limits_pkey" PRIMARY KEY ("ip_hash")
);
