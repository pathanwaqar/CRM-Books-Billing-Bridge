const TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';

let cachedToken = null; // { access_token, expires_at }

/**
 * Zoho OAuth uses a long-lived refresh token to mint short-lived access
 * tokens. This caches the access token in memory for the life of the
 * function instance and refreshes it a minute before it actually expires,
 * so every CRM/Books call doesn't re-authenticate from scratch.
 */
async function getAccessToken() {
  if (cachedToken && cachedToken.expires_at > Date.now() + 60_000) {
    return cachedToken.access_token;
  }

  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const res = await fetch(`${TOKEN_URL}?${params.toString()}`, { method: 'POST' });
  const data = await res.json();

  if (data.error) {
    throw new Error(`Zoho OAuth refresh failed: ${data.error}`);
  }

  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return cachedToken.access_token;
}

module.exports = { getAccessToken };
