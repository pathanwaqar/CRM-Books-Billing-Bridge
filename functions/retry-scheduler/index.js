const { findNeedingAttention, updateMapping } = require('../../lib/mapping');
const { createInvoice, getInvoice } = require('../../lib/booksClient');
const { getDeal, updateDeal } = require('../../lib/crmClient');

const MAX_RETRIES = 5;

/**
 * Scheduled function (see catalyst-config.json) that does two jobs:
 *  1. Retry: any mapping that failed to get an invoice created gets another attempt.
 *  2. Reconciliation: any mapping that already has an invoice gets its real
 *     payment status re-checked in Books and re-synced to CRM, in case a
 *     payment webhook was ever missed or arrived while the function was down.
 */
module.exports = async (event, context) => {
  const mappings = await findNeedingAttention(context);
  console.log(`Retry scheduler: ${mappings.length} mapping(s) need attention`);

  for (const mapping of mappings) {
    if ((mapping.retryCount || 0) >= MAX_RETRIES) {
      console.error(`Mapping ${mapping.ROWID} exceeded max retries (${MAX_RETRIES}), needs manual review`);
      continue;
    }

    try {
      if (!mapping.invoiceId) {
        await retryInvoiceCreation(context, mapping);
      } else {
        await reconcilePaymentStatus(context, mapping);
      }
    } catch (err) {
      console.error(`Retry failed for mapping ${mapping.ROWID}:`, err.message);
      await updateMapping(context, mapping.ROWID, {
        status: 'failed',
        retryCount: (mapping.retryCount || 0) + 1,
      });
    }
  }

  context.closeWithSuccess();
};

async function retryInvoiceCreation(context, mapping) {
  const deal = await getDeal(mapping.dealId);
  const invoice = await createInvoice({
    customerId: deal.Books_Customer_ID,
    lineItems: (deal.Product_Details || []).map((p) => ({
      name: p.product?.name || 'Item',
      rate: p.Total || 0,
      quantity: p.quantity || 1,
    })),
    reference: `CRM Deal ${mapping.dealId}`,
  });

  await updateDeal(mapping.dealId, { Invoice_ID: invoice.invoice.invoice_id });
  await updateMapping(context, mapping.ROWID, {
    invoiceId: invoice.invoice.invoice_id,
    status: 'synced',
  });
}

async function reconcilePaymentStatus(context, mapping) {
  const invoice = await getInvoice(mapping.invoiceId);
  await updateDeal(mapping.dealId, { Payment_Status: invoice.invoice.status });
  await updateMapping(context, mapping.ROWID, {
    status: 'synced',
    lastPaymentStatus: invoice.invoice.status,
  });
}
