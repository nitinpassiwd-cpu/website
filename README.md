# 100 AI Tools — Ebook Sales Website

A sales website for **"100 AI Tools That Can Save You 10 Hours Every Week"**, with every "Get the ebook" button linking directly to a Razorpay Payment Link for checkout.

```
Sales Page → "Get the Ebook" button → Razorpay Payment Link (hosted checkout) → Payment
```

---

## 1. How payment works right now

Every buy button on the site (`nav`, hero, final CTA, sticky mobile bar) is a plain link to your Razorpay Payment Link:

```
https://rzp.io/rzp/J03YhKCo
```

This opens Razorpay's own hosted checkout page in a new tab, where Razorpay collects the customer's name, email, phone and payment details, and processes the payment itself. There is nothing to configure on this site for that part — it already works.

**To change the payment link:** open `frontend/index.html` and replace every occurrence of `https://rzp.io/rzp/J03YhKCo` (there are 4 — nav, hero, final CTA, sticky bar) with your new link.

**To change what happens after payment:** set the Payment Link's redirect URL in your Razorpay Dashboard (Payment Links → your link → Advanced options) to point at `https://yourdomain.com/thank-you.html`, so customers land on this project's Thank You page after paying.

### Ebook download on the Thank You page
`frontend/thank-you.html` has a **Download Your Ebook (PDF)** button that links directly to `frontend/downloads/100-ai-tools-ebook.pdf` (already included) and downloads it in one click — no query parameters, tokens, or backend calls needed.

**Note on access control:** because checkout now happens on Razorpay's own hosted page, this project has no way to confirm on the Thank You page that a given visitor actually paid — it relies on only paying customers reaching that URL (via the Payment Link's redirect setting above). Anyone who guesses or shares the `thank-you.html` link could also download the PDF from it. This is a reasonable trade-off for a simple, low-friction ₹99 product; if you later want the download itself gated behind a verified payment, see Section 4 for re-enabling the optional backend's signed, expiring download tokens.

**To update the ebook file:** replace `frontend/downloads/100-ai-tools-ebook.pdf` with your latest PDF, keeping the same filename (or update the `href` in `thank-you.html` if you rename it).

### About the backend folder
This project still includes a full Express backend (`backend/`) with Razorpay **order-based** checkout, server-side signature verification, signed download tokens, and email delivery — built for a scenario where you want the ebook delivered automatically and securely right after payment, without manually emailing each buyer. It is **not wired to the buy buttons anymore** now that they link straight to a Payment Link instead. You can safely ignore the `backend/` folder if you're delivering the ebook manually (e.g. Razorpay's own post-payment email, or you emailing buyers yourself). If you later want automatic, secure ebook delivery again, see Section 4 below.

---

## 2. Project structure

```
ebook-sales-page/
├── frontend/
│   ├── index.html        ← sales page (buy buttons link to your Payment Link)
│   ├── thank-you.html    ← post-purchase page with direct PDF download button
│   ├── style.css
│   ├── script.js         ← analytics + FAQ accordion
│   ├── downloads/
│   │   └── 100-ai-tools-ebook.pdf   ← the real ebook file, downloaded directly from thank-you.html
│   └── assets/
│       └── ebook-cover.png
│
├── backend/               ← optional — only needed for automatic secure delivery (see Section 4)
│   ├── server.js
│   ├── routes/payment.js
│   ├── controllers/paymentController.js
│   ├── services/
│   ├── utils/downloadToken.js
│   ├── data/orders.json
│   └── .env.example
│
├── protected/
│   └── 100-ai-tools-ebook.pdf
│
├── package.json
└── README.md
```

---

## 3. Running the site

The sales page is now plain static HTML/CSS/JS — no backend is required to make the buy buttons work.

**Simplest option:** open `frontend/index.html` directly in a browser, or upload the `frontend/` folder to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, or your existing hosting).

If you still want the price shown on the page to be pulled from one place instead of edited by hand in `index.html`, you can optionally run the backend just for its `/api/config` endpoint — see Section 4.

---

## 4. Optional: automatic, secure ebook delivery (advanced)

A Razorpay Payment Link is simple, but it won't automatically email a secure download link the way the earlier backend-driven flow did. If you want that back:

1. `cd ebook-sales-page && npm install`
2. `cp backend/.env.example backend/.env` and fill in `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `PRODUCT_PRICE=99`, SMTP details, etc. (full table in Section 8).
3. In `frontend/script.js` and `frontend/index.html`, swap the 4 direct payment-link buttons back to calling `POST /api/create-order` → Razorpay Checkout JS → `POST /api/verify-payment`, the way the previous version of this project worked. The backend code for this is untouched and ready — only the frontend wiring was simplified.
4. `npm start` to run the combined server.

If you'd rather keep the simple Payment Link approach but still want buyers to land on a nice Thank You page, just set the Payment Link's redirect URL (Section 1) — no backend needed for that.

---

## 5. Optional backend setup (only if you enable automatic secure delivery)

### Requirements
Node.js 18+ and a Razorpay account (https://razorpay.com).

### Install
```bash
cd ebook-sales-page
npm install
```

### Configure environment variables
```bash
cp backend/.env.example backend/.env
```
Then open `backend/.env` and fill in every value — see the full table in **Section 8** below.

### Add the real ebook file
Place your finished PDF at:
```
protected/100-ai-tools-ebook.pdf
```
(or change `EBOOK_FILE_PATH` in `.env` to point elsewhere).

### Run locally
```bash
npm start
```
Visit `http://localhost:4242`. The backend also serves the frontend statically, so one server runs the whole site during development.

### Test the flow without real money
Razorpay's **Test Mode** keys (from the same dashboard) let you complete full checkouts with test cards — no real charges. Use test keys until you're ready to go live, then swap in live keys.

---

## 6. Deployment (for the optional backend, or to host the static frontend)

You can deploy as **one combined server** (simplest) or split frontend/backend.

### Option A — single server (recommended to start)
Deploy the whole `ebook-sales-page/` folder to any Node host: Render, Railway, Fly.io, a VPS, etc.
- Start command: `npm start`
- Set all variables from `backend/.env` in your host's environment variable settings (don't upload `.env` itself).
- Make sure `protected/` and `backend/data/` are on persistent storage (not wiped on redeploy) if you're using the JSON order store.
- Point your domain's DNS at the host, then set `WEBSITE_DOMAIN=https://yourdomain.com` in the environment variables.

### Option B — split frontend/backend
- Deploy `frontend/` as a static site (Netlify, Vercel, Cloudflare Pages).
- Deploy `backend/` as a Node service (Render, Railway, etc.).
- In `frontend/script.js`, set `API_BASE` to your backend's URL (currently same-origin `""`).
- In `backend/server.js`, the CORS `origin` is read from `WEBSITE_DOMAIN` — set it to your frontend's real domain.

### Production checklist
- [ ] Use **live** Razorpay keys, not test keys.
- [ ] Set a long, random `DOWNLOAD_TOKEN_SECRET` (see command in `.env.example`).
- [ ] Replace the JSON file order store (`backend/services/orderStore.js`) with a real database — it works for testing and low volume, but isn't safe under concurrent traffic. Swap the internals; the function signatures (`saveOrder`, `getOrder`, `markOrderPaid`) are designed to stay the same.
- [ ] Confirm `protected/` is genuinely not reachable — try visiting `https://yourdomain.com/protected/100-ai-tools-ebook.pdf` directly after deploying. It should 404, since only `frontend/` is served statically (see `backend/server.js`).
- [ ] Set up real SMTP credentials so confirmation emails actually send (until configured, the app logs a warning and skips email — it won't crash the purchase flow).
- [ ] Update every placeholder in Section 8 below.

---

## 7. Razorpay dashboard setup (only needed if you use the optional backend)

1. Create an account at https://dashboard.razorpay.com.
2. Go to **Settings → API Keys** and generate a **Test Mode** key pair first.
3. Copy the **Key ID** and **Key Secret** into `backend/.env` (see Section 8).
4. Test a full purchase using [Razorpay's test cards](https://razorpay.com/docs/payments/payments/test-card-upi-details/).
5. When ready to accept real payments, complete Razorpay's KYC/activation, generate **Live Mode** keys, and replace the test keys in your environment variables.

---

## 8. Exactly where to enter your credentials (only needed if you use the optional backend)

Everything lives in **`backend/.env`** (copied from `backend/.env.example`). Nothing else needs editing for the site to function — `script.js` and `index.html` pull price, product name, and analytics IDs from the backend automatically via `GET /api/config`.

| Placeholder | Where | What to put there |
|---|---|---|
| `RAZORPAY_KEY_ID` | `backend/.env` | From Razorpay Dashboard → Settings → API Keys. Safe to expose publicly. |
| `RAZORPAY_KEY_SECRET` | `backend/.env` | Same page. **Keep private** — never put this in any frontend file. |
| `PRODUCT_PRICE` | `backend/.env` | Price in whole rupees, e.g. `99`. Drives both the Razorpay order amount and every "₹…" shown on the site. |
| `PRODUCT_NAME` | `backend/.env` | Defaults to the ebook's real title — change only if you rename the product. |
| `EBOOK_FILE_PATH` | `backend/.env` | Path to your real PDF, e.g. `../protected/100-ai-tools-ebook.pdf`. |
| `DOWNLOAD_TOKEN_SECRET` | `backend/.env` | A long random string. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. |
| `DOWNLOAD_LINK_EXPIRY_HOURS` | `backend/.env` | How long a download link stays valid, e.g. `48`. |
| `WEBSITE_DOMAIN` | `backend/.env` | Your real domain, e.g. `https://100aitools.com`. Used for CORS and email links. |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASS` / `EMAIL_FROM` | `backend/.env` | Your SMTP provider's details (Gmail, SendGrid, Postmark, SES, Mailgun, Resend, etc). |
| `SUPPORT_EMAIL` | `backend/.env` | Shown on the site and in emails, e.g. `support@100aitools.com`. |
| `GOOGLE_ANALYTICS_ID` | `backend/.env` | From Google Analytics → Admin → Data Streams. |
| `META_PIXEL_ID` | `backend/.env` | From Meta Events Manager → your Pixel → Settings. |
| SEO tags (`YOUR_DOMAIN.com`, `og:image`) | `frontend/index.html` `<head>` | Replace the canonical URL, Open Graph URL, and `og:image` path with your real domain and a real image once you have one. |

---

## 9. Analytics events already wired up

`frontend/script.js` fires these through both `gtag` and `fbq` automatically once you set `GOOGLE_ANALYTICS_ID` / `META_PIXEL_ID`:

| Event | Fires when |
|---|---|
| `page_view` | Sales page loads |
| `view_content` | Any "Get the ebook" button is clicked |
| `initiate_checkout` | Same click — the customer is about to leave for Razorpay's hosted checkout page |

Since checkout now happens entirely on Razorpay's own page, this site can't natively fire a `purchase` event (it never sees the payment result). If you need purchase tracking, set up **Razorpay's webhook** to notify your analytics/CRM, or re-enable the optional backend flow in Section 4, which does receive a verified payment result and can fire `purchase` itself.

No tracking IDs are hardcoded — both are read from `/api/config` if the optional backend is running; otherwise set them directly in `frontend/index.html`'s `<head>`.

---

## 10. A note on the JSON order store (optional backend only)

`backend/services/orderStore.js` uses a local `orders.json` file so the entire flow — order creation, signature verification, download tokens — works out of the box without setting up a database. It is genuinely functional, but:

- It is **not safe** for concurrent writes at real scale.
- It has no backup/replication.

Before real launch traffic, replace it with Postgres, MySQL, MongoDB, or a managed equivalent (Supabase, PlanetScale, Firebase, etc.), keeping the same three functions (`saveOrder`, `getOrder`, `markOrderPaid`) so `paymentController.js` doesn't need to change.

---

## 11. Support

This is a template — if something in your specific Razorpay account, SMTP provider, or hosting platform behaves differently than described here, check that provider's docs first; the placeholders above are intentionally generic so they work with any provider in each category.
