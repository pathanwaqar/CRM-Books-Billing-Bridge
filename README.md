# CRM → Books Billing Bridge

An automation service that connects **Zoho CRM** and **Zoho Books**, turning a won Deal into an invoice automatically and reconciling payment status back into CRM, demonstrating cross-product business process automation.

## Overview

Sales and finance workflows usually live in two different Zoho products. This project closes that gap: when a Deal is marked `Closed Won` in CRM, the bridge automatically creates a matching Estimate/Invoice in Zoho Books, and listens for payment webhooks from Books to update the Deal record back in CRM.

## Architecture

```
   Zoho CRM                         Bridge Service                     Zoho Books
┌───────────────┐    webhook    ┌─────────────────────┐    API     ┌──────────────┐
│ Deal: Stage =  │ ───────────▶ │  Catalyst Function   │ ─────────▶ │ Create        │
│ "Closed Won"   │               │  (Node.js)           │            │ Invoice/      │
└───────────────┘               │                      │            │ Estimate      │
                                 │  - maps Deal→Invoice │            └──────┬───────┘
                                 │  - line items from   │                   │
                                 │    Deal products     │           payment webhook
                                 │  - stores mapping in │                   │
                                 │    Catalyst Data     │◀──────────────────┘
                                 │    Store             │
                                 └──────────┬───────────┘
                                            │ update Deal
                                            ▼
                                    Zoho CRM (Deal.Payment_Status,
                                    Deal.Invoice_ID)
```

## Tech Stack

- **Runtime:** Node.js on Zoho Catalyst Functions
- **Persistence:** Zoho Catalyst Data Store (CRM Deal ↔ Books Invoice ID mapping)
- **APIs:** Zoho CRM REST API v6, Zoho Books API v3
- **Auth:** OAuth 2.0 (multi-scope: `ZohoCRM.modules.ALL`, `ZohoBooks.fullaccess.all`)

## Zoho Services / APIs Used

| Step | Zoho Product | API Used |
|---|---|---|
| Trigger | Zoho CRM | Outgoing Webhook on Deal stage change |
| Invoice creation | Zoho Books | Estimates API / Invoices API |
| Payment tracking | Zoho Books | Payments API + webhook on payment received |
| Status sync back | Zoho CRM | Records API (update Deal fields) |
| ID mapping storage | Zoho Catalyst | Data Store (ZCQL) |

## Key Features

- Auto-creates a Books Invoice from a CRM Deal's line items/products
- Idempotent processing (won't double-invoice a Deal that already has one)
- Listens for Books payment webhooks and reflects `Paid` / `Partially Paid` / `Overdue` status back onto the CRM Deal
- Retry queue for failed API calls (stored in Data Store, retried by a scheduled Function)
- Structured logging for every sync event for auditability

## Getting Started

### Prerequisites

- Zoho CRM and Zoho Books accounts in the same organization (or connected via OAuth)
- Zoho API Console credentials with CRM + Books scopes
- Zoho Catalyst project (free tier)

### Installation

```bash
git clone https://github.com/<your-username>/crm-books-billing-bridge.git
cd crm-books-billing-bridge
catalyst init
npm install
```

### Environment Variables

```
ZOHO_CLIENT_ID=your-client-id
ZOHO_CLIENT_SECRET=your-client-secret
ZOHO_REFRESH_TOKEN=your-refresh-token
ZOHO_BOOKS_ORG_ID=your-books-organization-id
CRM_WEBHOOK_SECRET=your-webhook-secret
BOOKS_WEBHOOK_SECRET=your-webhook-secret
```

### Run Locally

```bash
catalyst serve
```

### Deploy

```bash
catalyst deploy
```

## Project Structure

```
crm-books-billing-bridge/
├── functions/
│   ├── crm-deal-webhook/       # Receives CRM Deal stage-change webhook
│   ├── books-payment-webhook/  # Receives Books payment webhook
│   └── retry-scheduler/        # Scheduled job: retries + reconciliation (every 15 min)
├── lib/
│   ├── zohoAuth.js             # OAuth refresh-token → access-token exchange (cached)
│   ├── crmClient.js
│   ├── booksClient.js
│   ├── mapping.js              # Deal ↔ Invoice ID mapping + idempotency, via Data Store
│   └── webhookVerify.js        # HMAC signature verification for both webhooks
├── catalyst.json
├── .env.example
└── docs/
    └── webhook-payloads.md     # Sample payloads, Data Store schema, sync state machine
```

## Roadmap

- [ ] Support partial invoicing for multi-milestone Deals
- [ ] Add Slack alert on failed reconciliation after N retries
- [ ] Extend mapping to Zoho Subscriptions for recurring Deals

---

## Author

**Waqar Pathan**
Email: pathanwaqar26@gmail.com
