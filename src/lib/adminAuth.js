export const ADMIN_STORAGE_KEY = 'ingo_admin_signed_in';
export const FIXED_ADMIN_EMAIL = 'admin@ingo.com';
export const FIXED_ADMIN_PASSWORD = 'Admin@123';

export function isAdminSignedIn() {
  try {
    return localStorage.getItem(ADMIN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAdminSignedIn() {
  try {
    localStorage.setItem(ADMIN_STORAGE_KEY, '1');
  } catch {
    // ignore
  }
}

export function markAdminSignedOut() {
  try {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isValidAdminCredential(email, password) {
  const e = String(email || '').trim().toLowerCase();
  const p = String(password || '');
  return e === FIXED_ADMIN_EMAIL.toLowerCase() && p === FIXED_ADMIN_PASSWORD;
}
