const { getDeal, updateDeal } = require('../../lib/crmClient');
const { createInvoice } = require('../../lib/booksClient');
const { findByDealId, createMapping } = require('../../lib/mapping');
const { verifySignature } = require('../../lib/webhookVerify');

/**
 * Triggered by a Zoho CRM outgoing webhook when a Deal's Stage changes.
 * Only acts on "Closed Won" — everything else is acknowledged and ignored.
 */
module.exports = async (event, context) => {
  const rawBody = event.body || JSON.stringify(event);

  if (!verifySignature(rawBody, event.headers?.['x-zoho-signature'], process.env.CRM_WEBHOOK_SECRET)) {
    context.closeWithFailure({ error: 'Invalid webhook signature' });
    return;
  }

  const payload = JSON.parse(rawBody);
  const dealId = payload.ids?.[0] || payload.id;

  try {
    const existing = await findByDealId(context, dealId);
    if (existing) {
      console.log(`Deal ${dealId} already mapped to invoice ${existing.invoiceId}, skipping (idempotent)`);
      context.closeWithSuccess();
      return;
    }

    const deal = await getDeal(dealId);
    if (deal.Stage !== 'Closed Won') {
      context.closeWithSuccess();
      return;
    }

    const lineItems = (deal.Product_Details || []).map((p) => ({
      name: p.product?.name || 'Item',
      rate: p.Total || 0,
      quantity: p.quantity || 1,
    }));

    let invoice = null;
    let status = 'synced';

    try {
      invoice = await createInvoice({
        customerId: deal.Books_Customer_ID,
        lineItems,
        reference: `CRM Deal ${dealId}`,
      });
      await updateDeal(dealId, {
        Invoice_ID: invoice.invoice.invoice_id,
        Payment_Status: 'Invoiced',
      });
    } catch (err) {
      // Don't drop the event — record it as failed so retry-scheduler
      // picks it up instead of the Deal silently never getting invoiced.
      status = 'failed';
      console.error(`Invoice creation failed for Deal ${dealId}:`, err.message);
    }

    await createMapping(context, {
      dealId,
      invoiceId: invoice?.invoice?.invoice_id || null,
      status,
    });

    context.closeWithSuccess();
  } catch (err) {
    console.error(err);
    context.closeWithFailure({ error: err.message });
  }
};
