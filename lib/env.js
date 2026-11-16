// Central place for runtime configuration. Nothing secret is hardcoded here.
export const isMongo = () => Boolean(process.env.MONGODB_URI);
export const appMode = () => (isMongo() ? 'mongodb' : 'demo');
export const aiServiceUrl = () => (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
export const aiTimeoutMs = () => Number(process.env.AI_TIMEOUT_MS || 120000);

const DEV_ONLY_SECRET = 'dev-only-insecure-secret-set-JWT_SECRET-in-env';
export function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set (16+ characters) in production.');
  return DEV_ONLY_SECRET; // development / demo convenience only
}
