// backend/server.js
require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const paymentRoutes = require("./routes/payment");

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: process.env.WEBSITE_DOMAIN || "*",
  })
);

// --- Public, non-secret configuration the frontend needs at runtime. ---
// Keeps every credential/placeholder in ONE place (backend/.env) instead
// of duplicated inside frontend JS files.
app.get("/api/config", (req, res) => {
  res.json({
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    productName: process.env.PRODUCT_NAME || "100 AI Tools That Can Save You 10 Hours Every Week",
    price: Number(process.env.PRODUCT_PRICE || 99),
    currency: process.env.PRODUCT_CURRENCY || "INR",
    googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID || "",
    metaPixelId: process.env.META_PIXEL_ID || "",
    supportEmail: process.env.SUPPORT_EMAIL || "support@yourdomain.com",
  });
});

app.use("/api", paymentRoutes);

// --- Serve the static frontend (single-server deployment) ---
// If you deploy the frontend separately (e.g. Vercel/Netlify) and the
// backend elsewhere (e.g. Render/Railway), you can delete this block —
// just make sure WEBSITE_DOMAIN and CORS are set correctly.
const frontendDir = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendDir));
app.get("/thank-you", (req, res) => res.sendFile(path.join(frontendDir, "thank-you.html")));
app.get("/", (req, res) => res.sendFile(path.join(frontendDir, "index.html")));

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
