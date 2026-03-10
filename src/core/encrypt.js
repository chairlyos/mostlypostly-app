// src/core/encrypt.js
// AES-256-GCM encryption for sensitive data stored at rest.
// Used for: integration API keys, webhook secrets, MFA TOTP secrets, OAuth tokens.
//
// Requires ENCRYPTION_KEY env var — 32-byte hex string.
// Generate: openssl rand -hex 32
//
// Storage format (JSON string): { iv, ciphertext, tag }
// All values are hex-encoded strings.

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV — standard for GCM

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    // In local dev without a key, fall back to a fixed dev key with a warning.
    // In production this must always be set — enforced in env.js.
    console.warn("[encrypt] ⚠️  ENCRYPTION_KEY not set — using dev fallback. Set this in production.");
    return Buffer.from("0".repeat(64), "hex");
  }
  if (hex.length !== 64) {
    throw new Error("[encrypt] ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32");
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string.
 * @param {string} plaintext
 * @returns {string} JSON string containing { iv, ciphertext, tag }
 */
export function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    iv:         iv.toString("hex"),
    ciphertext: encrypted.toString("hex"),
    tag:        tag.toString("hex"),
  });
}

/**
 * Decrypt a value produced by encrypt().
 * Returns null if input is null/empty/invalid.
 * @param {string|null} stored — JSON string from DB
 * @returns {string|null}
 */
export function decrypt(stored) {
  if (!stored) return null;
  try {
    const { iv, ciphertext, tag } = JSON.parse(stored);
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    return decipher.update(Buffer.from(ciphertext, "hex")) + decipher.final("utf8");
  } catch (err) {
    console.error("[encrypt] Decryption failed:", err.message);
    return null;
  }
}

/**
 * Returns true if a string looks like an encrypted blob (JSON with iv/ciphertext/tag).
 * Useful for migrating plaintext values to encrypted ones.
 */
export function isEncrypted(value) {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value);
    return !!(parsed.iv && parsed.ciphertext && parsed.tag);
  } catch {
    return false;
  }
}
