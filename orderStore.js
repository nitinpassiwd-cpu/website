// backend/services/orderStore.js
//
// Minimal persistence layer for orders, backed by a local JSON file.
// This is enough to run and test the full purchase flow, but a JSON file
// is NOT safe for concurrent production traffic.
//
// BEFORE GOING LIVE: replace this module with a real database
// (Postgres, MySQL, MongoDB, etc.) while keeping the same function
// signatures (getOrder / saveOrder / markOrderPaid) so nothing else
// in the app has to change.

const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "..", "data", "orders.json");

function readAll() {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

function writeAll(data) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

/**
 * Create a pending order record right after a Razorpay order is created.
 */
function saveOrder(order) {
  const all = readAll();
  all[order.razorpayOrderId] = {
    ...order,
    status: "created",
    createdAt: new Date().toISOString(),
  };
  writeAll(all);
  return all[order.razorpayOrderId];
}

function getOrder(razorpayOrderId) {
  const all = readAll();
  return all[razorpayOrderId] || null;
}

/**
 * Mark an order as paid ONLY after the backend has verified the Razorpay
 * signature server-side. Never call this from anything triggered purely
 * by frontend/browser state.
 */
function markOrderPaid(razorpayOrderId, { paymentId, email, name, phone }) {
  const all = readAll();
  if (!all[razorpayOrderId]) return null;
  all[razorpayOrderId] = {
    ...all[razorpayOrderId],
    status: "paid",
    paymentId,
    email,
    name,
    phone,
    paidAt: new Date().toISOString(),
  };
  writeAll(all);
  return all[razorpayOrderId];
}

module.exports = { saveOrder, getOrder, markOrderPaid };
