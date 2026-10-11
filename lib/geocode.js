// Souřadnice města pro mapu cest (OpenStreetMap Nominatim, max 1 dotaz za schválení článku). Ukládá se jen přibližná poloha (město).
export async function geocodePlace(place) {
  const q = String(place || '').trim().slice(0, 80);
  if (!q) return null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'parisien.cz-school-project/1.0 (info@parisien.cz)' }, signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j[0]) return null;
    return { lat: Math.round(Number(j[0].lat) * 100) / 100, lon: Math.round(Number(j[0].lon) * 100) / 100 };   // přesnost ~1 km
  } catch { return null; }
}
