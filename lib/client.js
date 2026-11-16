// Browser-side helpers.
export class ApiError extends Error {
  constructor(message, status, details) { super(message); this.status = status; this.details = details || {}; }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const res = await fetch(path, {
    method, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'The request could not be completed.', res.status, data.details);
  return data;
}

export const fmtDate = (v, withTime = false) => {
  if (!v) return '-';
  const d = new Date(v);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
};
export const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const HOME = { citizen: '/citizen', officer: '/officer', admin: '/admin' };

// Multipart upload with real progress events (fetch cannot report upload progress).
export function uploadForm(url, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url); xhr.withCredentials = true; xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => { const d = xhr.response || {}; xhr.status >= 200 && xhr.status < 300 ? resolve(d) : reject(new ApiError(d.error || 'The upload could not be completed.', xhr.status, d.details)); };
    xhr.onerror = () => reject(new ApiError('Network error while uploading. Check your connection and try again.', 0));
    xhr.send(form);
  });
}
