const { getAccessToken } = require('./zohoAuth');

const API_DOMAIN = process.env.ZOHO_CRM_API_DOMAIN || 'https://www.zohoapis.com';

async function zohoRequest(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${API_DOMAIN}${path}`, {
    ...options,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`CRM API error (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function getDeal(dealId) {
  const data = await zohoRequest(`/crm/v6/Deals/${dealId}`);
  return data.data[0];
}

async function updateDeal(dealId, fields) {
  return zohoRequest(`/crm/v6/Deals/${dealId}`, {
    method: 'PUT',
    body: JSON.stringify({ data: [{ id: dealId, ...fields }] }),
  });
}

module.exports = { getDeal, updateDeal };
