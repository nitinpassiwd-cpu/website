// backend/routes/payment.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const { createOrder, verifyPayment, downloadEbook } = require("../controllers/paymentController");

const router = express.Router();

// Basic abuse protection on the payment-related endpoints.
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a few minutes." },
});

router.post("/create-order", paymentLimiter, createOrder);
router.post("/verify-payment", paymentLimiter, verifyPayment);
router.get("/download", downloadEbook);

module.exports = router;
