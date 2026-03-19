/**
 * slugify("Jessica M") → "jessica-m"
 */
export function slugify(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * appendUtm(url, params) → URL string with UTM params appended.
 * Preserves existing query string. Skips null/empty url. Returns url unchanged if malformed.
 */
export function appendUtm(url, { source, medium, campaign, content, term } = {}) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (source)   u.searchParams.set('utm_source',   source);
    if (medium)   u.searchParams.set('utm_medium',   medium);
    if (campaign) u.searchParams.set('utm_campaign', campaign);
    if (content)  u.searchParams.set('utm_content',  content);
    if (term)     u.searchParams.set('utm_term',     term);
    return u.toString();
  } catch {
    return url;
  }
}
