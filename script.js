// frontend/script.js
//
// Handles: fetching public config, the buy button → buyer form → Razorpay
// checkout flow, server-side verification call, redirect to Thank You page,
// FAQ accordion, and analytics event tracking.
//
// SECURITY NOTE: this file never sees RAZORPAY_KEY_SECRET. The only key
// used here is RAZORPAY_KEY_ID, which is public by design. The actual
// payment verification happens on the backend (see backend/controllers/
// paymentController.js → verifyPayment).

(function () {
  "use strict";

  const API_BASE = ""; // same-origin. Set e.g. "https://api.yourdomain.com" if backend is hosted separately.

  // All "Get the ebook" buttons link directly to this Razorpay Payment
  // Link (see frontend/index.html). Change it in one place if it ever
  // needs updating — search index.html for this URL.
  const RAZORPAY_PAYMENT_LINK = "https://rzp.io/rzp/J03YhKCo";

  let CONFIG = {
    razorpayKeyId: "YOUR_RAZORPAY_KEY_ID",
    productName: "100 AI Tools That Can Save You 10 Hours Every Week",
    price: 99,
    currency: "INR",
    supportEmail: "support@yourdomain.com",
  };

  /* ---------------------------------------------------------------------
     ANALYTICS — thin wrapper so we call one function everywhere.
     Fill in YOUR_GOOGLE_ANALYTICS_ID / YOUR_META_PIXEL_ID in index.html's
     <head>, or serve them via /api/config (see loadConfig below) and this
     file will inject the snippets automatically.
  --------------------------------------------------------------------- */
  function track(eventName, params) {
    try {
      if (window.gtag) window.gtag("event", eventName, params || {});
      if (window.fbq) window.fbq("track", mapToMetaEvent(eventName), params || {});
      console.debug("[analytics]", eventName, params || {});
    } catch (e) {
      /* analytics must never break the purchase flow */
    }
  }

  function mapToMetaEvent(name) {
    const map = {
      page_view: "PageView",
      view_content: "ViewContent",
      initiate_checkout: "InitiateCheckout",
      purchase: "Purchase",
      download: "Lead", // Meta has no native "Download" standard event
    };
    return map[name] || name;
  }

  function injectAnalyticsScripts() {
    if (CONFIG.googleAnalyticsId && CONFIG.googleAnalyticsId !== "YOUR_GOOGLE_ANALYTICS_ID") {
      const s1 = document.createElement("script");
      s1.async = true;
      s1.src = `https://www.googletagmanager.com/gtag/js?id=${CONFIG.googleAnalyticsId}`;
      document.head.appendChild(s1);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", CONFIG.googleAnalyticsId);
    }

    if (CONFIG.metaPixelId && CONFIG.metaPixelId !== "YOUR_META_PIXEL_ID") {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script','https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', CONFIG.metaPixelId);
      /* eslint-enable */
    }

    track("page_view");
  }

  /* ---------------------------------------------------------------------
     CONFIG — pull public, non-secret settings from the backend so price /
     product name / key id live in ONE place (backend/.env).
  --------------------------------------------------------------------- */
  async function loadConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      if (!res.ok) throw new Error("config fetch failed");
      const data = await res.json();
      CONFIG = { ...CONFIG, ...data };
    } catch (err) {
      console.warn("Using fallback config — could not reach /api/config:", err.message);
    }
    renderPrice();
    injectAnalyticsScripts();
  }

  function renderPrice() {
    const formatted = `₹${CONFIG.price}`;
    ["price-display", "price-display-2", "price-display-3"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = formatted;
    });
    const supportLink = document.getElementById("support-link");
    if (supportLink) {
      supportLink.textContent = CONFIG.supportEmail;
      supportLink.href = `mailto:${CONFIG.supportEmail}`;
    }
  }

  /* ---------------------------------------------------------------------
     BUY BUTTONS
     Every "Get the ebook" / "Get Instant Access" button is now a plain
     link straight to the Razorpay Payment Link (opens in a new tab).
     Razorpay's hosted checkout page collects the customer's name, email,
     phone and payment details itself — no custom order-creation or
     signature-verification call is needed on this page for that flow.
     We still fire an analytics event on click so ad platforms see intent.
  --------------------------------------------------------------------- */
  function initBuyButtons() {
    document.querySelectorAll("[data-cta]").forEach((el) => {
      el.addEventListener("click", () => {
        track("view_content", { cta: el.dataset.cta });
        track("initiate_checkout", { value: CONFIG.price, currency: CONFIG.currency, cta: el.dataset.cta });
      });
    });
  }

  /* ---------------------------------------------------------------------
     FAQ ACCORDION
  --------------------------------------------------------------------- */
  function initFaq() {
    document.querySelectorAll(".faq__item").forEach((item) => {
      const btn = item.querySelector(".faq__q");
      btn.addEventListener("click", () => {
        const isOpen = item.classList.contains("open");
        document.querySelectorAll(".faq__item.open").forEach((i) => i.classList.remove("open"));
        if (!isOpen) item.classList.add("open");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadConfig();
    initBuyButtons();
    initFaq();
  });
})();
