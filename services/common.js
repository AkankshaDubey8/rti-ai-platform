import { HttpError } from '../lib/errors.js';
import { canTransition, statusLabel } from '../lib/workflow.js';
import { baseUrl, sendEmail } from '../lib/mailer.js';

export const DEFAULT_SETTINGS = { platformName: 'RTI Assist (academic demo)', announcement: '', autoAssign: true, allowRegistrations: true, similarRecordsCount: 3, responseDeadlineDays: 30 };

export async function getSettings(store) {
  const out = { ...DEFAULT_SETTINGS };
  for (const r of await store.find('settings')) out[r.key] = r.value;
  return out;
}

export const audit = (store, actor, action, entityType, entityId, metadata = {}) =>
  store.insert('audit_logs', { user: actor?.id ?? null, userName: actor?.name ?? 'System', role: actor?.role ?? 'system', action, entityType, entityId: String(entityId ?? ''), metadata });

// In-app notification, plus an email (outbox / SMTP) unless the user turned email notifications off. Email problems never break a workflow.
export async function notify(store, recipient, message, type = 'info', application = null) {
  if (!recipient) return null;
  const row = await store.insert('notifications', { recipient, message, type, application, read: false });
  try {
    const [user, prefs, app] = await Promise.all([store.get('users', recipient), store.findOne('user_prefs', { user: recipient }), application ? store.get('applications', application) : null]);
    if (user && prefs?.emailNotifications !== false) {
      const role = user.role === 'citizen' ? '/citizen' : '/officer';
      const link = app ? `\n\nOpen it: ${baseUrl()}${role}/applications/${app.applicationId}` : '';
      await sendEmail(store, { to: user.email, subject: `RTI Assist: ${message.slice(0, 80)}`, text: `${message}${link}\n\nThis message is from RTI Assist, an independent academic project.`, user: user.id });
    }
  } catch (e) { console.error('[notify-email]', e.message); }
  return row;
}

// The only way application status changes: validates the transition, updates the application and records history.
export async function transition(store, app, to, actor, remarks = '', patch = {}) {
  if (!canTransition(app.status, to)) throw new HttpError(409, `This application cannot move from "${statusLabel(app.status)}" to "${statusLabel(to)}".`);
  const updated = await store.update('applications', app.id, { status: to, ...patch });
  await store.insert('status_history', { application: app.id, previousStatus: app.status, newStatus: to, updatedBy: actor?.id ?? null, updatedByName: actor?.name ?? 'System (automated)', remarks });
  return updated;
}

export async function nameMaps(store) {
  const [depts, users] = await Promise.all([store.find('departments', {}, { sort: { name: 1 } }), store.find('users', {}, { sort: { name: 1 } })]);
  return { depts, users, dept: Object.fromEntries(depts.map((d) => [d.id, d.name])), user: Object.fromEntries(users.map((u) => [u.id, u.name])) };
}
