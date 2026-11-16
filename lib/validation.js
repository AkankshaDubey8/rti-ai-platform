// Input validation (pure functions). Each returns { ok, value } or { ok:false, errors:{field:message} }.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const finish = (errors, value) => (Object.keys(errors).length ? { ok: false, errors } : { ok: true, value });

export function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Use at least 8 characters.';
  if (pw.length > 128) return 'Use 128 characters or fewer.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Include at least one letter and one number.';
  return null;
}

export function validateRegister(b = {}) {
  const errors = {}; const name = str(b.name); const email = str(b.email).toLowerCase();
  if (name.length < 2 || name.length > 80) errors.name = 'Enter your full name (2-80 characters).';
  if (!EMAIL.test(email)) errors.email = 'Enter a valid email address.';
  const pw = validatePassword(b.password); if (pw) errors.password = pw;
  return finish(errors, { name, email, password: b.password });
}

export function validateLogin(b = {}) {
  const errors = {}; const email = str(b.email).toLowerCase();
  if (!EMAIL.test(email)) errors.email = 'Enter a valid email address.';
  if (!b.password) errors.password = 'Enter your password.';
  return finish(errors, { email, password: b.password });
}

export function validateApplication(b = {}) {
  const errors = {}; const subject = str(b.subject); const description = str(b.description);
  const referenceInfo = str(b.referenceInfo); const department = str(b.department) || null;
  if (subject.length < 5 || subject.length > 200) errors.subject = 'Subject must be 5-200 characters.';
  if (description.length < 20 || description.length > 5000) errors.description = 'Describe the information you need in 20-5000 characters.';
  if (referenceInfo.length > 500) errors.referenceInfo = 'Reference information must be 500 characters or fewer.';
  const parse = (v) => { if (typeof v !== 'string') return v && typeof v === 'object' ? v : null; try { return JSON.parse(v); } catch { return null; } };
  const ap = parse(b.applicant); const tr = parse(b.translation);
  const applicant = ap ? { name: str(ap.name).slice(0, 80), phone: str(ap.phone).slice(0, 20), address: str(ap.address).slice(0, 300) } : null;
  if (applicant?.phone && !/^[0-9+()\-\s]{6,20}$/.test(applicant.phone)) errors.applicantPhone = 'Enter a valid phone number.';
  if (applicant && applicant.name.length < 2) errors.applicantName = 'Enter the applicant name.';
  const translation = tr && str(tr.text) ? { text: str(tr.text).slice(0, 5000), engine: str(tr.engine).slice(0, 100) } : null;
  return finish(errors, { subject, description, referenceInfo, department, applicant, translation });
}

export function validateProfile(b = {}) {
  const errors = {}; const name = str(b.name); const phone = str(b.phone);
  if (name.length < 2 || name.length > 80) errors.name = 'Enter a name of 2-80 characters.';
  if (phone && !/^[0-9+()\-\s]{6,20}$/.test(phone)) errors.phone = 'Enter a valid phone number.';
  return finish(errors, { name, phone });
}

export function validateDepartment(b = {}, validCategories = []) {
  const errors = {}; const name = str(b.name);
  if (name.length < 3 || name.length > 120) errors.name = 'Name must be 3-120 characters.';
  const categories = (Array.isArray(b.categories) ? b.categories : []).filter((c) => validCategories.includes(c));
  if (!categories.length) errors.categories = 'Select at least one category.';
  return finish(errors, {
    name, description: str(b.description).slice(0, 500), categories, active: b.active !== false,
    contact: { email: str(b.contact?.email), phone: str(b.contact?.phone), address: str(b.contact?.address).slice(0, 300) },
  });
}

export function validateRecord(b = {}, validCategories = []) {
  const errors = {}; const title = str(b.title); const applicationSummary = str(b.applicationSummary); const responseSummary = str(b.responseSummary);
  if (title.length < 5) errors.title = 'Enter a title (5+ characters).';
  if (applicationSummary.length < 15) errors.applicationSummary = 'Summarise the original application (15+ characters).';
  if (responseSummary.length < 15) errors.responseSummary = 'Summarise the response (15+ characters).';
  if (!validCategories.includes(b.category)) errors.category = 'Choose a category.';
  return finish(errors, { title, applicationSummary, responseSummary, category: b.category, department: str(b.department) || null });
}

// ---- file uploads ----
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES = 5;
const TYPES = {
  'application/pdf': { ext: 'pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  'image/png': { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
  'image/jpeg': { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  'text/plain': { ext: 'txt', magic: null },
};
export const ALLOWED_TYPES_LABEL = 'PDF, PNG, JPG or TXT, up to 5 MB each';

export function validateFile({ name, type, size, bytes }) {
  const t = TYPES[type];
  if (!t) return { ok: false, error: `${name}: unsupported file type. Use ${ALLOWED_TYPES_LABEL}.` };
  if (size > MAX_FILE_BYTES) return { ok: false, error: `${name}: file is larger than 5 MB.` };
  if (size === 0) return { ok: false, error: `${name}: file is empty.` };
  if (t.magic && !t.magic.every((b, i) => bytes[i] === b)) return { ok: false, error: `${name}: file content does not match its type.` };
  if (!t.magic && bytes.slice(0, 2000).includes(0)) return { ok: false, error: `${name}: not a plain text file.` };
  return { ok: true, ext: t.ext };
}
export const safeFileName = (name) => String(name || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 120);
