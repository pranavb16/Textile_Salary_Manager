import { argon2Sync, randomBytes } from "node:crypto";
import { emitKeypressEvents } from "node:readline";

if (!process.stdin.isTTY || !process.stdin.setRawMode) {
  process.stderr.write("Run this command in an interactive terminal.\n");
  process.exit(1);
}

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdout.write(prompt);
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    function finish(error) {
      process.stdin.off("keypress", onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }
    function onKeypress(character, key) {
      if (key?.ctrl && key.name === "c") return finish(new Error("Cancelled."));
      if (key?.name === "return" || key?.name === "enter") return finish();
      if (key?.name === "backspace") { value = value.slice(0, -1); return; }
      if (character && !key?.ctrl && !key?.meta) value += character;
    }
    process.stdin.on("keypress", onKeypress);
  });
}

try {
  const password = await askHidden("Password (hidden): ");
  const confirmation = await askHidden("Confirm password (hidden): ");
  const characterCount = Array.from(password).length;
  if (characterCount < 6 || characterCount > 1024) throw new Error("Use a password of 6 to 1024 characters.");
  if (password !== confirmation) throw new Error("Passwords did not match.");
  const salt = randomBytes(16);
  const key = argon2Sync("argon2id", { message: password, nonce: salt, memory: 19456, passes: 2, parallelism: 1, tagLength: 32 });
  process.stdout.write(`\nArgon2id hash (paste this into the password_hash column):\n$argon2id$v=19$m=19456,t=2,p=1$${salt.toString("base64url")}$${key.toString("base64url")}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
