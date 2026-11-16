// Local file storage for supporting documents (kept outside /public so every download goes through an authorised API route).
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const root = () => process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const STORED = /^[a-f0-9]{24}\.(pdf|png|jpg|txt)$/;
const APP_DIR = /^RTI-\d{4}-[A-Z0-9]{6}$/;

export async function saveFile(applicationId, bytes, ext) {
  if (!APP_DIR.test(applicationId)) throw new Error('Invalid application id');
  const dir = path.join(root(), applicationId);
  await fs.mkdir(dir, { recursive: true });
  const id = randomBytes(12).toString('hex');
  const storedName = `${id}.${ext}`;
  await fs.writeFile(path.join(dir, storedName), bytes);
  return { id, storedName };
}
export async function readStoredFile(applicationId, storedName) {
  if (!APP_DIR.test(applicationId) || !STORED.test(storedName)) throw new Error('Invalid file reference');
  return fs.readFile(path.join(root(), applicationId, storedName));
}
