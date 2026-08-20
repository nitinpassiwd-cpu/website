// backend/controllers/paymentController.js
//
// This is the security-critical part of the whole project.
//
// FLOW:
//   1. createOrder      — backend asks Razorpay for an order (server-side, using the secret key)
//   2. (frontend opens Razorpay Checkout using the order id + PUBLIC key id)
//   3. verifyPayment     — *** SERVER-SIDE SIGNATURE VERIFICATION HAPPENS HERE ***
//                          Only after this succeeds does the customer get a
//                          download token. The frontend's "payment success"
//                          callback is NEVER trusted on its own.
//   4. downloadEbook     — validates the signed token and streams the real
//                          file from a non-public folder.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Razorpay = require("razorpay");

const { saveOrder, getOrder, markOrderPaid } = require("../services/orderStore");
const { createDownloadToken, verifyDownloadToken } = require("../utils/downloadToken");
const { sendPurchaseConfirmationEmail } = require("../services/emailService");

function getRazorpayInstance() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || key_id === "YOUR_RAZORPAY_KEY_ID" || !key_secret || key_secret === "YOUR_RAZORPAY_KEY_SECRET") {
    throw new Error("Razorpay keys are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env");
  }
  return new Razorpay({ key_id, key_secret });
}

/**
 * POST /api/create-order
 * Creates a Razorpay order using the price defined server-side (PRODUCT_PRICE).
 * The frontend never gets to choose or override the price — that would let
 * a tampered client pay ₹1 for the ebook.
 */
async function createOrder(req, res) {
  try {
    const razorpay = getRazorpayInstance();
    const priceInRupees = Number(process.env.PRODUCT_PRICE || 99);
    const currency = process.env.PRODUCT_CURRENCY || "INR";

    const order = await razorpay.orders.create({
      amount: Math.round(priceInRupees * 100), // Razorpay expects paise
      currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        product: process.env.PRODUCT_NAME || "100 AI Tools That Can Save You 10 Hours Every Week",
      },
    });

    saveOrder({
      razorpayOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID, // public key — safe to send to browser
      productName: process.env.PRODUCT_NAME || "100 AI Tools That Can Save You 10 Hours Every Week",
    });
  } catch (err) {
    console.error("[createOrder] error:", err.message);
    res.status(500).json({ error: "Could not create order. Please try again." });
  }
}

/**
 * POST /api/verify-payment
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, name, email, phone }
 *
 * *** THIS IS WHERE SERVER-SIDE PAYMENT VERIFICATION HAPPENS ***
 * We recompute the HMAC-SHA256 signature ourselves using the SECRET key
 * (which never touches the browser) and compare it to what Razorpay sent.
 * Only an exact match proves the payment is genuine and untampered.
 */
async function verifyPayment(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, name, email, phone } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment details." });
    }
    if (!email) {
      return res.status(400).json({ error: "Email is required to deliver the ebook." });
    }

    const order = getOrder(razorpay_order_id);
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    // --- Recompute the expected signature server-side ---
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    const isValid =
      expectedSignature.length === razorpay_signature.length &&
      crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpay_signature));

    if (!isValid) {
      console.warn("[verifyPayment] signature mismatch for order", razorpay_order_id);
      return res.status(400).json({ error: "Payment verification failed. If you were charged, contact support." });
    }

    // Signature is valid → payment is genuine. Now, and only now, grant access.
    markOrderPaid(razorpay_order_id, { paymentId: razorpay_payment_id, email, name, phone });

    const expiryHours = Number(process.env.DOWNLOAD_LINK_EXPIRY_HOURS || 48);
    const token = createDownloadToken(razorpay_order_id, expiryHours);
    const downloadUrl = `${process.env.WEBSITE_DOMAIN || ""}/api/download?token=${token}`;

    // Email delivery does not block the response — the customer can also
    // download immediately from the Thank You page.
    sendPurchaseConfirmationEmail({ to: email, name, downloadUrl }).catch((err) =>
      console.error("[verifyPayment] email send failed:", err.message)
    );

    res.json({
      success: true,
      downloadUrl: `/api/download?token=${token}`,
      productName: process.env.PRODUCT_NAME || "100 AI Tools That Can Save You 10 Hours Every Week",
    });
  } catch (err) {
    console.error("[verifyPayment] error:", err.message);
    res.status(500).json({ error: "Something went wrong verifying your payment." });
  }
}

/**
 * GET /api/download?token=...
 * Validates the signed, time-limited token and streams the real file from
 * a folder that is never served publicly. The file path itself is never
 * exposed to the frontend.
 */
async function downloadEbook(req, res) {
  const { token } = req.query;
  const result = verifyDownloadToken(token);

  if (!result.valid) {
    return res.status(403).send(`Access denied: ${result.reason || "invalid link."}`);
  }

  const order = getOrder(result.orderId);
  if (!order || order.status !== "paid") {
    return res.status(403).send("Access denied: no verified payment found for this link.");
  }

  const filePath = path.resolve(__dirname, "..", process.env.EBOOK_FILE_PATH || "../protected/100-ai-tools-ebook.pdf");

  if (!fs.existsSync(filePath)) {
    console.error("[downloadEbook] file not found at", filePath);
    return res.status(500).send("The ebook file is temporarily unavailable. Please contact support.");
  }

  res.download(filePath, "100-AI-Tools-That-Can-Save-You-10-Hours-Every-Week.pdf");
}

module.exports = { createOrder, verifyPayment, downloadEbook };
