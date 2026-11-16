// Mongoose models. Collection names match the specification: users, applications, departments,
// historical_records, response_drafts, notifications, status_history, audit_logs (+ settings).
import mongoose from 'mongoose';
const { Schema } = mongoose;
const ref = (to, extra = {}) => ({ type: Schema.Types.ObjectId, ref: to, ...extra });
const define = (name, collection, schema, indexes = []) => {
  if (mongoose.models[name]) return mongoose.models[name];
  const s = new Schema(schema, { timestamps: true, collection });
  indexes.forEach((i) => s.index(...i));
  return mongoose.model(name, s);
};

export const ROLES = ['citizen', 'officer', 'admin'];
export const STATUS_VALUES = ['submitted', 'ai_completed', 'draft_generated', 'assigned', 'under_review', 'awaiting_approval', 'response_issued', 'rejected', 'closed'];

const User = define('User', 'users', {
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ROLES, required: true, default: 'citizen' },
  active: { type: Boolean, default: true },
  department: ref('Department', { default: null }),
  phone: { type: String, default: '' },
  tokenVersion: { type: Number, default: 0 },
  isDemo: { type: Boolean, default: false },
}, [[{ role: 1 }]]);

const Application = define('Application', 'applications', {
  applicationId: { type: String, required: true, unique: true },
  citizen: ref('User', { required: true }),
  subject: { type: String, required: true, minlength: 5, maxlength: 200 },
  description: { type: String, required: true, minlength: 20, maxlength: 5000 },
  referenceInfo: { type: String, default: '', maxlength: 500 },
  selectedDepartment: ref('Department', { default: null }),
  category: { type: String, default: 'Other' },
  department: ref('Department', { default: null }),
  aiAnalysis: { type: Schema.Types.Mixed, default: null },
  status: { type: String, enum: STATUS_VALUES, default: 'submitted' },
  assignedOfficer: ref('User', { default: null }),
  documents: [{ id: String, originalName: String, storedName: String, mimeType: String, size: Number, storage: { type: String, default: 'local' }, extracted: Schema.Types.Mixed }],
  applicant: { type: Schema.Types.Mixed, default: null },
  language: { type: String, default: 'en' },
  translation: { type: Schema.Types.Mixed, default: null },
  rejectionReason: { type: String, default: '' },
  finalResponse: { type: String, default: '' },
  respondedAt: { type: Date, default: null },
  isDemo: { type: Boolean, default: false },
}, [[{ status: 1 }], [{ citizen: 1 }], [{ assignedOfficer: 1 }], [{ department: 1 }], [{ createdAt: -1 }]]);

const Department = define('Department', 'departments', {
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  categories: [{ type: String }],
  contact: { email: String, phone: String, address: String },
  active: { type: Boolean, default: true },
  isDemo: { type: Boolean, default: false },
});

const HistoricalRecord = define('HistoricalRecord', 'historical_records', {
  recordId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  department: ref('Department', { default: null }),
  category: { type: String, required: true },
  applicationSummary: { type: String, required: true },
  responseSummary: { type: String, required: true },
  embedding: { type: [Number], default: [] },
  embeddingModel: { type: String, default: '' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  isDemo: { type: Boolean, default: true },
}, [[{ category: 1 }], [{ department: 1 }]]);

const ResponseDraft = define('ResponseDraft', 'response_drafts', {
  application: ref('Application', { required: true }),
  generated: { type: Schema.Types.Mixed, default: null },
  currentText: { type: String, default: '' },
  generationMode: { type: String, default: 'template-fallback' },
  llmError: { type: String, default: '' },
  retrievedRecords: [{ record: ref('HistoricalRecord'), recordId: String, title: String, similarity: Number }],
  officerEdits: [{ editedBy: ref('User'), editedByName: String, editedAt: Date, note: String }],
  checklist: { type: Schema.Types.Mixed, default: {} },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'issued'], default: 'pending' },
  reviewRemarks: { type: String, default: '' },
  approvedBy: ref('User', { default: null }),
  approvedAt: { type: Date, default: null },
  issuedAt: { type: Date, default: null },
  version: { type: Number, default: 1 },
}, [[{ application: 1 }]]);

const Notification = define('Notification', 'notifications', {
  recipient: ref('User', { required: true }),
  message: { type: String, required: true },
  type: { type: String, default: 'info' },
  application: ref('Application', { default: null }),
  read: { type: Boolean, default: false },
}, [[{ recipient: 1, read: 1, createdAt: -1 }]]);

const StatusHistory = define('StatusHistory', 'status_history', {
  application: ref('Application', { required: true }),
  previousStatus: { type: String, default: null },
  newStatus: { type: String, required: true },
  updatedBy: ref('User', { default: null }),
  updatedByName: { type: String, default: 'System' },
  remarks: { type: String, default: '' },
}, [[{ application: 1, createdAt: 1 }]]);

const AuditLog = define('AuditLog', 'audit_logs', {
  user: ref('User', { default: null }),
  userName: { type: String, default: 'System' },
  role: { type: String, default: 'system' },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, default: '' },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, [[{ createdAt: -1 }], [{ action: 1 }]]);

const Setting = define('Setting', 'settings', { key: { type: String, required: true, unique: true }, value: Schema.Types.Mixed });

const ApplicationDraft = define('ApplicationDraft', 'application_drafts', {
  user: ref('User', { required: true }), title: { type: String, default: 'Untitled draft' }, step: { type: Number, default: 0 }, data: { type: Schema.Types.Mixed, default: {} },
}, [[{ user: 1, updatedAt: -1 }]]);
const InternalNote = define('InternalNote', 'internal_notes', {
  application: ref('Application', { required: true }), author: ref('User', { required: true }), authorName: String, text: { type: String, required: true, maxlength: 2000 },
}, [[{ application: 1, createdAt: 1 }]]);
const Feedback = define('Feedback', 'feedback', {
  application: ref('Application', { required: true, unique: true }), citizen: ref('User', { required: true }), rating: { type: Number, min: 1, max: 5, required: true }, comment: { type: String, default: '', maxlength: 1000 },
});
const SupportTicket = define('SupportTicket', 'support_tickets', {
  name: String, email: String, subject: String, message: String, user: ref('User', { default: null }), status: { type: String, enum: ['open', 'resolved'], default: 'open' },
}, [[{ status: 1, createdAt: -1 }]]);
const EmailOutbox = define('EmailOutbox', 'email_outbox', {
  to: String, subject: String, text: String, user: ref('User', { default: null }), status: { type: String, enum: ['sent', 'failed', 'not_sent_no_smtp'], default: 'not_sent_no_smtp' }, error: { type: String, default: '' },
}, [[{ createdAt: -1 }]]);
const PasswordReset = define('PasswordReset', 'password_resets', {
  user: ref('User', { required: true }), tokenHash: { type: String, required: true, unique: true }, expiresAt: { type: Date, required: true }, used: { type: Boolean, default: false },
});
const UserPrefs = define('UserPrefs', 'user_prefs', {
  user: ref('User', { required: true, unique: true }), language: { type: String, default: 'en' }, theme: { type: String, default: 'system' }, textSize: { type: String, default: 'normal' },
  emailNotifications: { type: Boolean, default: true }, recentlyViewed: [{ applicationId: String, at: Date }], searchHistory: [String],
});

export const COLLECTIONS = {
  application_drafts: ApplicationDraft, internal_notes: InternalNote, feedback: Feedback, support_tickets: SupportTicket, email_outbox: EmailOutbox, password_resets: PasswordReset, user_prefs: UserPrefs,
  users: User, applications: Application, departments: Department, historical_records: HistoricalRecord,
  response_drafts: ResponseDraft, notifications: Notification, status_history: StatusHistory, audit_logs: AuditLog, settings: Setting,
};
