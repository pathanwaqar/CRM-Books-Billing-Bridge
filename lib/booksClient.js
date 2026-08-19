const { getAccessToken } = require('./zohoAuth');

const API_DOMAIN = process.env.ZOHO_BOOKS_API_DOMAIN || 'https://www.zohoapis.com/books/v3';
const ORG_ID = process.env.ZOHO_BOOKS_ORG_ID;

async function zohoRequest(path, options = {}) {
  const token = await getAccessToken();
  const separator = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API_DOMAIN}${path}${separator}organization_id=${ORG_ID}`, {
    ...options,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`Books API error: ${data.message}`);
  }
  return data;
}

async function createInvoice({ customerId, lineItems, reference }) {
  return zohoRequest('/invoices', {
    method: 'POST',
    body: JSON.stringify({
      customer_id: customerId,
      line_items: lineItems,
      reference_number: reference,
    }),
  });
}

async function getInvoice(invoiceId) {
  return zohoRequest(`/invoices/${invoiceId}`);
}

module.exports = { createInvoice, getInvoice };
