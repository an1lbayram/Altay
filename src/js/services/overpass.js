import { calculateDistance, getPoiCategory } from '../utils/helpers.js';

const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter'
];

let activeAbortController = null;

/**
 * Fetch POIs around a given lat/lng and radius (in km) using optimized nwr queries
 */
export async function fetchPOIs({ lat, lng, radius, category = 'all' }) {
  if (activeAbortController) {
    activeAbortController.abort();
  }
  activeAbortController = new AbortController();

  // Cap max radius to 50km for API stability
  const radiusMeters = Math.min(radius, 50) * 1000;
  
  // Construct targeted Overpass QL Query focusing on true history & heritage
  let filterStr;
  switch (category) {
    case 'museum':
      filterStr = `nwr["tourism"="museum"](around:${radiusMeters},${lat},${lng});`;
      break;
    case 'castle':
      filterStr = `nwr["historic"~"castle|fort|citywalls|fortress|tower"](around:${radiusMeters},${lat},${lng});`;
      break;
    case 'ancient':
      filterStr = `nwr["historic"~"archaeological_site|ruins|tomb|rock_cut_tomb|aqueduct|amphitheatre"](around:${radiusMeters},${lat},${lng});`;
      break;
    case 'religion':
      filterStr = `nwr["amenity"="place_of_worship"](around:${radiusMeters},${lat},${lng}); nwr["historic"~"church|mosque|monastery|synagogue"](around:${radiusMeters},${lat},${lng});`;
      break;
    case 'monument':
      filterStr = `nwr["historic"="monument"](around:${radiusMeters},${lat},${lng}); nwr["historic"="memorial"]["wikipedia"](around:${radiusMeters},${lat},${lng});`;
      break;
    default:
      // 'all' or 'historic'
      filterStr = `
        nwr["historic"](around:${radiusMeters},${lat},${lng});
        nwr["tourism"="museum"](around:${radiusMeters},${lat},${lng});
        nwr["tourism"="attraction"](around:${radiusMeters},${lat},${lng});
      `;
      break;
  }

  const query = `[out:json][timeout:30];(${filterStr});out center;`;

  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'AltayApp/1.0 (https://an1lbayram-github-io.vercel.app/)'
        },
        body: `data=${encodeURIComponent(query)}`,
        // Combine the shared cancellation controller (used to abort stale requests when the
        // user changes location/category) with a per-endpoint 15s timeout so a slow/unresponsive
        // Overpass mirror doesn't hang the request indefinitely.
        signal: AbortSignal.any([activeAbortController.signal, AbortSignal.timeout(15000)])
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const text = await response.text();
      if (!text || text.startsWith('<')) {
        throw new Error('Invalid JSON response');
      }

      const data = JSON.parse(text);
      if (!data || !data.elements) {
        return [];
      }

      // Process & clean elements
      const processedPOIs = data.elements
        .map(el => {
          const poiLat = el.lat || el.center?.lat;
          const poiLng = el.lon || el.center?.lon;
          if (!poiLat || !poiLng) return null;

          const tags = el.tags || {};
          let name = tags.name || tags['name:tr'] || tags['name:en'] || tags.alt_name || tags.official_name;

          // Skip generic signboards, guideposts, hotels/safaris or info boards
          if (name && (name.startsWith('Sign ') || name.startsWith('Tabela ') || name.includes('Hotel') || name.includes('Safari') || name.includes('Adrenalin'))) return null;
          if (tags.information === 'board' || tags.information === 'guidepost' || tags.historic === 'boundary_stone') return null;

          // Normalize generic English landmark names
          if (name) {
            const nameLower = name.trim().toLowerCase();
            if (nameLower === 'clock' || nameLower === 'clock tower') name = 'Tarihi Saat Kulesi';
            else if (nameLower === 'bridge' || nameLower === 'old bridge') name = 'Tarihi Köprü';
            else if (nameLower === 'amfi tiyatro') name = 'Antik Amfitiyatro';
          }

          // Exclude modern 21st-century park memorials (e.g. modern park monuments, modern busts without historic heritage)
          if (tags.historic === 'memorial' && !tags.wikipedia && !tags.historic_period) {
            if (tags['memorial:type'] === 'bust' || (name && (name.includes('Özgecan') || name.includes('Parkı')) && !tags.wikipedia)) {
              return null;
            }
          }

          // Generate friendly fallback name for unnamed historic elements
          if (!name) {
            if (tags.historic === 'tomb' || tags.historic === 'rock_cut_tomb') name = 'Tarihi Kaya Mezarı';
            else if (tags.historic === 'ruins') name = 'Antik Kalıntı';
            else if (tags.historic === 'archaeological_site') name = 'Antik Kent / Arkeolojik Alan';
            else if (tags.historic === 'castle' || tags.historic === 'fort') name = 'Tarihi Kale & Sur';
            else if (tags.historic === 'memorial' || tags.historic === 'monument') name = 'Tarihi Anıt';
            else if (tags.amenity === 'place_of_worship' || tags.historic === 'mosque' || tags.historic === 'church') name = 'Tarihi İbadethane';
            else if (tags.tourism === 'museum') name = 'Müze';
            else if (tags.tourism === 'attraction' && tags.historic) name = 'Tarihi Turistik Mekan';
            else if (tags.historic) name = `Tarihi Eser (${tags.historic})`;
            else return null; // Skip minor unclassified non-historic tourism nodes
          }

          const dist = calculateDistance(lat, lng, poiLat, poiLng);

          return {
            id: `${el.type}-${el.id}`,
            osmId: el.id,
            osmType: el.type,
            name: name,
            lat: poiLat,
            lng: poiLng,
            tags: tags,
            category: getPoiCategory(tags),
            distance: dist,
            wikipedia: tags.wikipedia || '',
            image: tags.image || tags.wikimedia_commons || '',
            description: tags.description || tags.note || ''
          };
        })
        .filter(item => item !== null)
        .sort((a, b) => a.distance - b.distance);

      return processedPOIs;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw err;
      }
      lastError = err;
      console.warn(`Endpoint ${endpoint} failed, trying next...`, err);
    }
  }

  throw lastError || new Error('Tarihi mekan verileri çekilemedi.');
}
