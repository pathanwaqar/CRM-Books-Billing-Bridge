const crypto = require('crypto');

/**
 * Zoho signs outgoing webhooks with a shared secret. Verifying this before
 * acting on a payload stops anyone who discovers the endpoint URL from
 * injecting fake "Deal won" or "payment received" events.
 */
function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const givenBuf = Buffer.from(signatureHeader);

  return expectedBuf.length === givenBuf.length && crypto.timingSafeEqual(expectedBuf, givenBuf);
}

module.exports = { verifySignature };
