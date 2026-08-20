// backend/utils/downloadToken.js
//
// Creates and verifies a signed, time-limited token used to authorize
// ebook downloads. This is what stands between "payment succeeded" and
// "customer can read the file" — nobody can construct a valid token
// without knowing DOWNLOAD_TOKEN_SECRET, which only lives on the server.
//
// Token shape (before encoding):  `${orderId}.${expiresAtMs}`
// Final token:                    base64url(payload) + "." + hmacSignature

const crypto = require("crypto");

function getSecret() {
  const secret = process.env.DOWNLOAD_TOKEN_SECRET;
  if (!secret || secret === "REPLACE_WITH_A_LONG_RANDOM_SECRET") {
    throw new Error(
      "DOWNLOAD_TOKEN_SECRET is not configured. Set a real random secret in backend/.env before accepting payments."
    );
  }
  return secret;
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/**
 * Create a signed download token for a paid order.
 * @param {string} orderId - Razorpay order id (or internal order id) tied to a verified payment.
 * @param {number} expiryHours - how many hours the link should remain valid.
 * @returns {string} opaque token safe to put in a URL query string.
 */
function createDownloadToken(orderId, expiryHours = 48) {
  const expiresAt = Date.now() + expiryHours * 60 * 60 * 1000;
  const payload = `${orderId}.${expiresAt}`;
  const encodedPayload = base64url(payload);
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify a download token.
 * @param {string} token
 * @returns {{ valid: boolean, orderId?: string, reason?: string }}
 */
function verifyDownloadToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { valid: false, reason: "Malformed token." };
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return { valid: false, reason: "Malformed token." };
  }

  const expectedSignature = sign(encodedPayload);

  // Constant-time comparison to avoid timing attacks.
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, reason: "Invalid signature." };
  }

  const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  const [orderId, expiresAtStr] = payload.split(".");
  const expiresAt = Number(expiresAtStr);

  if (!orderId || Number.isNaN(expiresAt)) {
    return { valid: false, reason: "Malformed token payload." };
  }

  if (Date.now() > expiresAt) {
    return { valid: false, reason: "This download link has expired." };
  }

  return { valid: true, orderId };
}

module.exports = { createDownloadToken, verifyDownloadToken };
