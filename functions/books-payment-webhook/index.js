const { updateDeal } = require('../../lib/crmClient');
const { getInvoice } = require('../../lib/booksClient');
const { findByInvoiceId, updateMapping } = require('../../lib/mapping');
const { verifySignature } = require('../../lib/webhookVerify');

/**
 * Triggered by a Zoho Books webhook when a payment is recorded against an
 * invoice. Looks up which Deal that invoice belongs to (via the mapping
 * table written by crm-deal-webhook) and reflects the status back onto it.
 */
module.exports = async (event, context) => {
  const rawBody = event.body || JSON.stringify(event);

  if (!verifySignature(rawBody, event.headers?.['x-zoho-signature'], process.env.BOOKS_WEBHOOK_SECRET)) {
    context.closeWithFailure({ error: 'Invalid webhook signature' });
    return;
  }

  const payload = JSON.parse(rawBody);
  const invoiceId = payload.data?.invoice?.invoice_id || payload.invoice_id;

  try {
    const mapping = await findByInvoiceId(context, invoiceId);
    if (!mapping) {
      console.warn(`No Deal mapped to invoice ${invoiceId}, ignoring`);
      context.closeWithSuccess();
      return;
    }

    const invoice = await getInvoice(invoiceId);
    const paymentStatus = invoice.invoice.status; // 'paid' | 'partially_paid' | 'overdue' | 'sent'

    await updateDeal(mapping.dealId, { Payment_Status: paymentStatus });
    await updateMapping(context, mapping.ROWID, {
      status: 'synced',
      lastPaymentStatus: paymentStatus,
    });

    context.closeWithSuccess();
  } catch (err) {
    console.error(err);
    context.closeWithFailure({ error: err.message });
  }
};
