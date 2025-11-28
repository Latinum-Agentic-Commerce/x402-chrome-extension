# x402 Payment Protocol Playground (Chrome Extension + Demo Server)

## Overview

This repository demonstrates a **v1‑compliant** x402 implementation (using the `scheme`, `network`, `maxAmountRequired`, `payTo`, and related fields) and serves as a playground for building Chrome‑extension based payment flows.

We are already leveraging the core v1 protocol, and as part of our roadmap we plan to adopt **x402 v2**, which introduces an optional `basket` field for a structured representation of multiple line‑items.

- The extension listens for `402` responses, stores the request details, and shows a UI where the user can view the invoice items and click **Pay Now** (later you can hook this up to MetaMask).

The goal is to provide a **minimal, fully‑functional playground** for experimenting with the x402 protocol, testing integration with wallets, and building richer payment‑gated experiences.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Running the Server](#running-the-server)
4. [Loading the Chrome Extension](#loading-the-chrome-extension)
5. [Using the Demo](#using-the-demo)
6. [Architecture Overview](#architecture-overview)
7. [Key x402 Features Implemented](#key-x402-features-implemented)
8. [Extending / Next Steps](#extending--next-steps)
9. [Troubleshooting](#troubleshooting)
10. [License](#license)

---

## Prerequisites

- **Node.js** ≥ 24 (the server uses native ES‑module‑compatible syntax).  
- **npm** (or `pnpm`/`yarn` – any works).  
- **Google Chrome** (or any Chromium‑based browser that supports Manifest V3 extensions).  
- (Optional) **MetaMask** or another EIP‑3009‑compatible wallet if you want to implement the actual payment flow.

---

## Installation

```bash
# Clone the repo (if you haven't already)
git clone https://github.com/your‑username/x402_wpp.git
cd x402_wpp

# Install dependencies (express, x402‑express, cors, dotenv, uuid)
npm install
```

Create a `.env` file at the project root with your merchant address (use a testnet address for development):

```dotenv
# .env
MERCHANT_ADDRESS=0x1234567890123456789012345678901234567890
PORT=3001   # optional – defaults to 3001
```

---

## Running the Server

```bash
# Start the demo server (it will listen on http://localhost:3001)
node server_x402.js
```
You should see a banner like:
```
╔════════════════════════════════════════╗
║   X402 Payment Server Running          ║
╠════════════════════════════════════════╣
║ URL: http://localhost:3001           ║
║ Merchant: 0x12345678...               ║
║ Protocol: x402 (Real Blockchain)       ║
╚════════════════════════════════════════╝
```
The server provides three static pages (`/`, `/checkout`, `/index.html`) and a `/pay` endpoint that returns a **402** response with the full `PaymentRequirements` payload.

---

## Loading the Chrome Extension

1. Open `chrome://extensions/` in Chrome.
2. Enable **Developer mode** (toggle in the top‑right).
3. Click **Load unpacked** and select the **root folder** of this repository (`x402_wpp`).
4. The extension icon (a small “x402” logo) should appear next to the address bar.

The extension has the following permissions (see `manifest.json`):
- `webRequest` + `extraHeaders` – to capture response headers.
- `storage` – to persist captured requests.
- `notifications` – optional toast when a 402 is captured.
- `scripting` – to inject MetaMask‑related scripts when the user clicks **Pay Now**.

---

## Using the Demo

1. With the server running, open `http://localhost:3001/` in a new tab.
2. Click the **Checkout** button on the page – this triggers a `POST /pay` request.
3. The server responds with **HTTP 402** and the x402 JSON body.
4. The Chrome extension automatically captures the request and shows a **popup** listing the invoice items, total amount, and a **Pay Now** button.
5. (Future work) Clicking **Pay Now** will invoke MetaMask to sign a payment payload and resend the request with an `X‑PAYMENT` header.
6. You can view stored requests by opening the extension popup again – each request card includes a delete button.

### Inspecting the data
Open the extension popup’s DevTools (`Right‑click → Inspect popup`). In the **Console** you can run:
```js
chrome.storage.local.get({requests: []}, ({requests}) => console.log(requests));
```
You’ll see objects containing:
- `url` (includes `?paymentId=…`)
- `paymentId`
- `expiresAt`
- `paymentStatusUrl`
- `responseHeaders` (including `X‑Invoice‑Items`)

---

## Architecture Overview

```
+-------------------+        +-------------------+        +-------------------+
|   Chrome UI      | <---> | Background script | <---> |  Express server   |
| (popup.html/js)  |        | (webRequest)      |        | (server_x402.js) |
+-------------------+        +-------------------+        +-------------------+
```

- **Background script** (`background.js`) listens for any `402` response, stores the request in `chrome.storage.local`, and fires a notification.
- **Popup UI** (`popup.html`/`popup.js`) reads the stored requests, parses the `X‑Invoice‑Items` header (or the `extra` field), and renders a list of invoices.
- **Server** (`server_x402.js`) implements the x402 protocol using **Express** and **x402‑express** (middleware disabled for the demo). It generates a unique `paymentId`, an expiration timestamp, and a status‑polling endpoint.

---

## Key x402 Features Implemented

| Feature | Implementation |
|---------|----------------|
| **PaymentRequirements JSON** | Returned from `/pay` with all mandatory fields (`scheme`, `network`, `maxAmountRequired`, `resource`, `payTo`, `asset`, `maxTimeoutSeconds`, `x402Version`). |
| **`WWW‑Authenticate: x402` header** | Added to the 402 response so the background script can recognise the protocol. |
| **`X‑Invoice‑Items` header** | Mirrors the `extra` payload for quick UI parsing. |
| **Unique `paymentId`** | Generated with `uuidv4()`, included in the JSON body and as a query‑string on the `resource` URL. |
| **`expiresAt`** | ISO‑8601 timestamp (10‑minute expiry) – can be used by the UI to disable late payments. |
| **`paymentStatusUrl`** | Simple GET endpoint (`/payment-status/:paymentId`) that returns the stored status (`pending` by default). |
| **In‑memory pending‑payment store** | `const pendingPayments = {}` – demo only; replace with a DB for production. |
| **Delete‑button per request** | Implemented in `popup.js` to remove entries from `chrome.storage`. |

---

## Extending / Next Steps

1. **Enable the x402‑express middleware** – uncomment the middleware block to let the server automatically enforce payment before serving protected resources.
2. **Integrate a real facilitator** (`@coinbase/x402` or a self‑hosted facilitator) to verify and settle payments on‑chain.
3. **Persist pending payments** – replace the in‑memory `pendingPayments` map with a database (SQLite, PostgreSQL, etc.).
4. **Complete the MetaMask flow** – use `ethers.js` or `web3.js` to construct an `X‑PAYMENT` header, sign it with the user's wallet, and resend the original request.
5. **Add UI polish** – dark mode, micro‑animations, toast notifications for payment success/failure.
6. **Automated tests** – add unit tests for the server (`npm test`) and integration tests for the extension using Chrome’s testing tools.
## Proposal for x402 v2

### Add an optional `basket` field to `PaymentRequirements`

**Why:** Provides a structured, typed representation of multiple line‑items, eliminating the need for ad‑hoc `extra` objects or custom headers. Improves interoperability, UI consistency, and future‑proofs the protocol for taxes, discounts, and per‑item metadata.

**Schema (JSON‑Schema):**

```json
{
  "$id": "https://x402.org/spec/v2/basket.schema.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Basket",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["name", "price"],
    "properties": {
      "name": { "type": "string" },
      "price": { "type": "string", "description": "Amount in the smallest unit of the asset." },
      "quantity": { "type": "integer", "minimum": 1, "default": 1 },
      "tax": { "type": "string" },
      "discount": { "type": "string" },
      "metadata": { "type": "object", "additionalProperties": true }
    },
    "additionalProperties": false
  }
}
```

**Mapping to existing fields**

| x402 `basket` item | Existing x402 field | Description |
|--------------------|---------------------|-------------|
| `name` | `extra.name` or `product_data.name` (Stripe) | Human‑readable title |
| `price` | `price_data.unit_amount` (cents) | Smallest‑unit amount |
| `quantity` | `quantity` | Number of units |
| `tax` | `tax_rates` / `automatic_tax` | Tax amount (optional) |
| `discount` | `discounts` | Discount amount (optional) |
| `metadata` | `product_data.metadata` or `session.metadata` | Arbitrary key‑value pairs |

**Integration steps**

1. Servers include `basket` in the `PaymentRequirements` JSON when they have multiple items.  
2. Clients (e.g., our Chrome extension) read `basket` first; fall back to `extra` or `X‑Invoice‑Items` for legacy support.  
3. The `resource` URL may contain a `paymentId` query‑string for correlation; the basket is stored server‑side for verification.

**Backwards compatibility**

* The field is **optional**; existing implementations that ignore it continue to work.  
* `x402Version` should be bumped to `2.0` (or `2.x`) when the field is first shipped.

---

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Extension popup shows no requests after checkout | Background script not listening (permissions missing) | Verify `manifest.json` includes `webRequest`, `extraHeaders`, and that the extension is reloaded after changes. |
| `curl` to `/pay` returns 200 instead of 402 | `paymentMiddleware` still enabled with a mis‑configured route | Ensure the middleware block is commented out (as in the demo) or that the route matches `/pay`. |
| `paymentId` missing in response | `uuid` package not installed or import missing | Run `npm install uuid` and ensure `const { v4: uuidv4 } = require('uuid');` is present at the top of `server_x402.js`. |
| Server crashes on start | `.env` missing `MERCHANT_ADDRESS` | Add a valid address to `.env` and restart. |

---

## License

This project is provided **as‑is** for educational and prototyping purposes. Feel free to fork, modify, and use it in your own applications. The underlying x402 protocol is open‑source under the MIT license (see the official Coinbase `x402` repository for details).

---

*Happy hacking with x402!*
