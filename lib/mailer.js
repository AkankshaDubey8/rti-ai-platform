// Email notifications. Every message is recorded in the email_outbox collection.
// With SMTP_HOST configured (and the optional "nodemailer" package installed) it is sent; otherwise it is stored as "not_sent_no_smtp".
export const smtpConfigured = () => Boolean(process.env.SMTP_HOST);

export async function sendEmail(store, { to, subject, text, user = null }) {
  const row = await store.insert('email_outbox', { to, subject, text, user, status: 'not_sent_no_smtp', error: '' });
  if (!smtpConfigured()) return row;
  try {
    const nodemailer = (await import('nodemailer')).default;
    const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === '1',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
    await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
    return await store.update('email_outbox', row.id, { status: 'sent' });
  } catch (e) {
    return store.update('email_outbox', row.id, { status: 'failed', error: String(e.message || e).slice(0, 300) });
  }
}
export const baseUrl = () => (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
