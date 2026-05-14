import phoneCountryCodes from '../data/phoneCountryCodes.json';

/** @type {readonly { iso: string, dial: string, name: string }[]} */
export const PHONE_COUNTRY_CODES = phoneCountryCodes;

export function dialCodeForIso(iso) {
  const row = PHONE_COUNTRY_CODES.find((c) => c.iso === iso);
  return row?.dial ?? '+44';
}
