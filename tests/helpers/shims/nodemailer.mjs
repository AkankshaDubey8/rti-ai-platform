// Offline nodemailer stand-in that records messages instead of sending them.
export const sent = (globalThis.__sentMail ||= []);
export default { createTransport: () => ({ sendMail: async (m) => { sent.push(m); return { messageId: `shim-${sent.length}` }; } }) };
