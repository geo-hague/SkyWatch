
const CONTACT_EMAIL = 'm.c.hunt429@gmail.com'; // <-- CHANGE THIS to an email you control
const USER_AGENT = `SkyWatch/1.0 (personal ADS-B display; contact: ${CONTACT_EMAIL})`;

const SOURCES = [
  (lat, lon, r) => `https://api.adsb.lol/v2/point/${lat}/${lon}/${r}`,
  (lat, lon, r) => `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${r}`,
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const radiusInput = parseFloat(req.query.radius);
  if (isNaN(lat) || isNaN(lon)) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(400).json({ error: 'lat and lon query params are required' });
    return;
  }
  const radius = Math.min(Math.max(isNaN(radiusInput) ? 10 : radiusInput, 1), 250);
  const latR = lat.toFixed(4);
  const lonR = lon.toFixed(4);

  let lastErr = null;
  for (const buildUrl of SOURCES) {
    const url = buildUrl(latR, lonR, radius);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const upstream = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!upstream.ok) {
        lastErr = `HTTP ${upstream.status} from ${new URL(url).hostname}`;
        continue;
      }
      const data = await upstream.json();

      res.setHeader('Cache-Control', 'public, max-age=4, s-maxage=4, stale-while-revalidate=10');
      res.status(200).json(data);
      return;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err.name === 'AbortError' ? `timeout from ${new URL(url).hostname}` : String(err);
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(502).json({ error: 'All upstream ADS-B sources failed', detail: lastErr });
}
