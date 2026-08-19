# Webhook Payloads & Data Model

## Data Store schema

Catalyst Data Store table schemas are created in the Catalyst Console, not via API. Create one table before deploying:

### `DealInvoiceMap`

| Column | Type | Notes |
|---|---|---|
| `dealId` | Text | CRM Deal ID. Unique per row — this is the idempotency key. |
| `invoiceId` | Text | Books Invoice ID once created (null until the first successful sync). |
| `status` | Text | `pending` \| `synced` \| `failed` |
| `retryCount` | Number | Incremented by `retry-scheduler` on each failed retry attempt. |
| `lastPaymentStatus` | Text | Last known Books invoice status (`sent`, `partially_paid`, `paid`, `overdue`). |

Add a unique index on `dealId` in the Console so a race between two webhook deliveries can't create two rows for the same Deal.

## CRM outgoing webhook (Deal stage change)

Configured in CRM under Setup → Automation → Actions → Webhooks, fired on the "Closed Won" workflow rule.

```json
{
  "module": "Deals",
  "operation": "edit",
  "ids": ["4876876000000462001"],
  "resource_uri": "/crm/v6/Deals/4876876000000462001"
}
```

Header sent alongside the payload:

```
x-zoho-signature: 5f2b3c1a9e...   (HMAC-SHA256 of the raw body, using CRM_WEBHOOK_SECRET)
```

## Books outgoing webhook (payment recorded)

Configured in Books under Settings → Automation → Webhooks, on the "Payment Received" event.

```json
{
  "data": {
    "invoice": {
      "invoice_id": "3982000000123456",
      "status": "paid",
      "total": 1200.00,
      "balance": 0
    }
  },
  "event_type": "invoice_payment_added"
}
```

Header sent alongside the payload:

```
x-zoho-signature: 9a71e0d4b2...   (HMAC-SHA256 of the raw body, using BOOKS_WEBHOOK_SECRET)
```

## Sync state machine

```
Deal "Closed Won"
        │
        ▼
  no mapping row? ──▶ create Books invoice ──▶ mapping.status = "synced"
        │                       │
        │                  API call fails
        │                       ▼
        │              mapping.status = "failed" (retryCount = 0)
        │                       │
        │            retry-scheduler runs every 15 min
        │                       ▼
        │           retryCount < 5? retry invoice creation
        │                       │
        │            still failing after 5 tries → left for manual review
        ▼
  mapping row exists ──▶ skip (idempotent)

Books payment webhook arrives
        │
        ▼
  look up mapping by invoiceId ──▶ update Deal.Payment_Status ──▶ mapping.status = "synced"

Reconciliation (retry-scheduler, every run)
        │
        ▼
  for every "synced" mapping with an invoiceId, re-fetch the invoice from
  Books and re-write Deal.Payment_Status — catches any payment webhook
  that was missed while the function was down.
```
