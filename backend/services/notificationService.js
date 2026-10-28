// Notification service architecture for email + WhatsApp.
// Runs in DEMO MODE (logs to console, returns demo:true) whenever the
// relevant provider credentials are not set in the environment. It never
// reports a message as actually sent unless the provider call succeeded.

const emailConfigured = Boolean(
  process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS
);
const whatsappConfigured = Boolean(
  process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
);

const nodemailer = require('nodemailer');

let transporter = null;
if (emailConfigured) {
  const port = Number(process.env.EMAIL_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    // Port 465 (e.g. Gmail SSL) uses implicit TLS; 587 upgrades with STARTTLS.
    secure: port === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

async function sendEmail({ to, subject, html }) {
  if (!transporter) {
    console.log(`[DEMO MODE] Email not sent (no provider configured). To: ${to} | Subject: ${subject}`);
    return { demo: true, sent: false };
  }
  await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
  return { demo: false, sent: true };
}

async function sendWhatsApp({ to, message }) {
  if (!whatsappConfigured) {
    console.log(`[DEMO MODE] WhatsApp not sent (no provider configured). To: ${to} | Message: ${message}`);
    return { demo: true, sent: false };
  }
  const url = `${process.env.WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WhatsApp API error: ${res.status} ${text}`);
  }
  return { demo: false, sent: true };
}

// Named events used across controllers. Each simply fans out to the two
// channels above - swap in real templates per business requirements.
const events = {
  itemReceived: (item, customer) =>
    notifyBoth(customer, `Item ${item.itemId} (${item.name}) has been received into HR Warehouse.`),
  saleProposalCreated: (proposal, owner) =>
    notifyBoth(owner, `A new sale proposal ${proposal.proposalNumber} is awaiting your review.`),
  approvalDecision: (proposal, owner) =>
    notifyBoth(owner, `Sale proposal ${proposal.proposalNumber} was ${proposal.status}.`),
  invoiceGenerated: (invoice, buyer) =>
    notifyBoth(buyer, `Invoice ${invoice.invoiceNumber} for ₹${invoice.grandTotal} has been generated.`),
  paymentReminder: (invoice, buyer) =>
    notifyBoth(buyer, `Reminder: ₹${invoice.balanceDue} is outstanding on invoice ${invoice.invoiceNumber}.`),
  dispatchScheduled: (dispatch, buyer) =>
    notifyBoth(buyer, `Your order is scheduled for dispatch (${dispatch.dispatchNumber}).`),
  deliveryConfirmed: (dispatch, buyer) =>
    notifyBoth(buyer, `Delivery confirmed for dispatch ${dispatch.dispatchNumber}. Thank you!`),
};

async function notifyBoth(party, message) {
  const results = {};
  if (party && party.email) {
    results.email = await sendEmail({ to: party.email, subject: 'HR Warehouse Notification', html: `<p>${message}</p>` }).catch((e) => ({ error: e.message }));
  }
  if (party && party.phone) {
    results.whatsapp = await sendWhatsApp({ to: party.phone, message }).catch((e) => ({ error: e.message }));
  }
  return results;
}

module.exports = { sendEmail, sendWhatsApp, events, emailConfigured, whatsappConfigured };
