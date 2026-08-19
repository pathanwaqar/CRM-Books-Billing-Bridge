const catalystSDK = require('zcatalyst-sdk-node');

const TABLE = 'DealInvoiceMap';

function table(context) {
  return catalystSDK.initialize(context).datastore().table(TABLE);
}

function zcql(context) {
  return catalystSDK.initialize(context).zcql();
}

/**
 * The idempotency guard. Webhooks are "at least once" delivery, so the same
 * Deal-won event can legitimately arrive twice. Before creating an invoice,
 * every path checks whether a mapping row already exists for the Deal.
 */
async function findByDealId(context, dealId) {
  const rows = await zcql(context).executeZCQLQuery(
    `SELECT * FROM ${TABLE} WHERE dealId = '${dealId}'`
  );
  return rows.length ? rows[0][TABLE] : null;
}

async function findByInvoiceId(context, invoiceId) {
  const rows = await zcql(context).executeZCQLQuery(
    `SELECT * FROM ${TABLE} WHERE invoiceId = '${invoiceId}'`
  );
  return rows.length ? rows[0][TABLE] : null;
}

async function createMapping(context, { dealId, invoiceId, status }) {
  return table(context).insertRow({ dealId, invoiceId, status, retryCount: 0 });
}

async function updateMapping(context, rowId, patch) {
  return table(context).updateRow({ ROWID: rowId, ...patch });
}

/**
 * Everything the retry-scheduler function needs to sweep on each run:
 * rows that never got an invoice created (`pending`/`failed`, no invoiceId)
 * get retried, and rows that already synced get their payment status
 * re-checked against Books (reconciliation), in case a payment webhook
 * was ever missed while a function instance was down.
 */
async function findNeedingAttention(context) {
  const rows = await zcql(context).executeZCQLQuery(
    `SELECT * FROM ${TABLE} WHERE status = 'pending' OR status = 'failed' OR status = 'synced'`
  );
  return rows.map((r) => r[TABLE]);
}

module.exports = { findByDealId, findByInvoiceId, createMapping, updateMapping, findNeedingAttention };
