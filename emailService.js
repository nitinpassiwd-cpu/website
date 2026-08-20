// backend/services/emailService.js
//
// Sends the post-purchase confirmation email with the secure download link.
// Uses SMTP via nodemailer, configured entirely through environment
// variables — works with Gmail, SendGrid, Postmark, Amazon SES, Mailgun,
// Resend, or any standard SMTP provider.

const nodemailer = require("nodemailer");

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === "true", // true for port 465, false for 587/25
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/**
 * Send the "your ebook is ready" confirmation email.
 * @param {{ to: string, name: string, downloadUrl: string }} opts
 */
async function sendPurchaseConfirmationEmail({ to, name, downloadUrl }) {
  if (!process.env.EMAIL_HOST || process.env.EMAIL_HOST === "smtp.yourprovider.com") {
    // Email isn't configured yet — log instead of throwing, so the rest of
    // the purchase flow (payment + download access) still works while you
    // finish setting up SMTP credentials.
    console.warn(
      "[emailService] EMAIL_HOST is not configured — skipping email send. " +
        `Would have emailed: ${to} → ${downloadUrl}`
    );
    return { skipped: true };
  }

  const transporter = getTransporter();
  const productName = process.env.PRODUCT_NAME || "100 AI Tools That Can Save You 10 Hours Every Week";
  const supportEmail = process.env.SUPPORT_EMAIL || "support@yourdomain.com";
  const greetingName = name ? name.split(" ")[0] : "there";

  const html = `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color:#16202C;">
    <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color:#0E7C7B; font-weight:bold; margin-bottom: 8px;">Purchase confirmed</p>
    <h1 style="font-size: 24px; margin: 0 0 16px;">Your ebook is ready, ${greetingName}.</h1>
    <p style="font-size: 15px; line-height: 1.6;">Thank you for your purchase. Your payment has been received and verified.</p>
    <div style="border: 1px solid #E4E7EA; border-radius: 10px; padding: 16px 20px; margin: 24px 0; background:#F7F5F0;">
      <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color:#4B5563; margin:0 0 6px;">Your purchase</p>
      <p style="font-size: 17px; font-weight: bold; margin: 0;">${productName}</p>
    </div>
    <p style="text-align:center; margin: 32px 0;">
      <a href="${downloadUrl}" style="background:#1B2A41; color:#ffffff; text-decoration:none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: bold; display:inline-block;">Download your ebook</a>
    </p>
    <p style="font-size: 13px; color:#4B5563; line-height:1.6;">This secure download link will expire after a set time for your protection. If it expires, just reply to this email and we'll help you get access again.</p>
    <p style="font-size: 13px; color:#4B5563; line-height:1.6;">Questions? Contact us anytime at <a href="mailto:${supportEmail}" style="color:#0E7C7B;">${supportEmail}</a>.</p>
  </div>`;

  const text = `Your ebook is ready, ${greetingName}.

Thank you for your purchase. Your payment has been received and verified.

Your purchase: ${productName}

Download your ebook: ${downloadUrl}

This secure download link will expire after a set time for your protection.

Questions? Contact us at ${supportEmail}.`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `"100 AI Tools" <no-reply@yourdomain.com>`,
    to,
    subject: `Your Ebook Is Ready — ${productName}`,
    text,
    html,
  });

  return { skipped: false };
}

module.exports = { sendPurchaseConfirmationEmail };
