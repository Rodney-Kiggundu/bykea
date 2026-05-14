/** In-app default: GBP (UK) */
export function formatGBP(value) {
  const n = Number(value);
  if (value == null || Number.isNaN(n)) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(0);
  }
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

export const FMT_GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
