/** Small input-cleaning helpers shared by routes. */
export const str = (v, max) => String(v ?? '').trim().slice(0, max);
export const cleanPhone = (v) => String(v ?? '').replace(/[^+0-9()\s-]/g, '').trim().slice(0, 20);
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || ''));

/** Only accept photos that were uploaded through our own /api/uploads endpoint. */
export function cleanPhotos(photos, max = 3) {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter((p) => p && typeof p.url === 'string' && /^\/uploads\/[A-Za-z0-9._-]+$/.test(p.url))
    .slice(0, max)
    .map((p) => ({ url: p.url, originalName: str(p.originalName, 120) }));
}
