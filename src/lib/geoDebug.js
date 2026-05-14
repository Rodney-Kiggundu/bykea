/** `?debug_geo=1` strips the param and sets localStorage (legacy; geo overlay removed). */
export function consumeDebugGeoQueryParam() {
  try {
    const u = new URL(window.location.href);
    if (u.searchParams.get('debug_geo') === '1') {
      localStorage.setItem('ingo_debug_geo', '1');
      u.searchParams.delete('debug_geo');
      const next = `${u.pathname}${u.search}${u.hash}`;
      window.history.replaceState({}, '', next);
    }
  } catch {
    // ignore
  }
}
