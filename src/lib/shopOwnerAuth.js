const SHOP_OWNER_STORAGE = 'ingo_shop_owner_signed_in';
const PROFILE_KEY = 'ingo_shop_owner_profile';

function clearShopOwnerKeysFrom(storage) {
  try {
    storage.removeItem(SHOP_OWNER_STORAGE);
    storage.removeItem(PROFILE_KEY);
  } catch {
    // ignore
  }
}

function getActiveShopOwnerStorage() {
  try {
    if (sessionStorage.getItem(SHOP_OWNER_STORAGE) === '1') return sessionStorage;
    if (localStorage.getItem(SHOP_OWNER_STORAGE) === '1') return localStorage;
    return null;
  } catch {
    return null;
  }
}

/**
 * Table-based shop owner session (no Supabase Auth).
 * @param {object} profile
 * @param {{ rememberMe?: boolean }} [options] - `true`: persist until logout (localStorage). `false`: tab session only (sessionStorage). Omit: update active store, else localStorage.
 */
export function saveShopOwnerSession(profile, options = {}) {
  const { rememberMe } = options;
  let targetStorage;
  if (rememberMe === true) {
    targetStorage = localStorage;
    clearShopOwnerKeysFrom(sessionStorage);
  } else if (rememberMe === false) {
    targetStorage = sessionStorage;
    clearShopOwnerKeysFrom(localStorage);
  } else {
    targetStorage = getActiveShopOwnerStorage() || localStorage;
    const other = targetStorage === localStorage ? sessionStorage : localStorage;
    clearShopOwnerKeysFrom(other);
  }

  try {
    targetStorage.setItem(SHOP_OWNER_STORAGE, '1');
    if (profile && typeof profile === 'object') {
      targetStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    }
  } catch {
    // ignore
  }
}

export function getShopOwnerSession() {
  try {
    for (const storage of [sessionStorage, localStorage]) {
      const raw = storage.getItem(PROFILE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') continue;
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearShopOwnerSession() {
  clearShopOwnerKeysFrom(localStorage);
  clearShopOwnerKeysFrom(sessionStorage);
}

export { SHOP_OWNER_STORAGE };

export function isShopOwnerSignedIn() {
  try {
    if (sessionStorage.getItem(SHOP_OWNER_STORAGE) !== '1' && localStorage.getItem(SHOP_OWNER_STORAGE) !== '1') {
      return false;
    }
    return !!getShopOwnerSession();
  } catch {
    return false;
  }
}
