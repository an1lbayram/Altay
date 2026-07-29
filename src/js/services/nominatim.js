/**
 * Nominatim Geocoding API Service
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

/**
 * Search location by string query
 */
export async function searchLocation(query) {
  if (!query || !query.trim()) return [];

  const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(query.trim())}&addressdetails=1&limit=5&accept-language=tr,en`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AltayApp/1.0 (https://an1lbayram-github-io.vercel.app/)'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim HTTP Error ${response.status}`);
    }

    const data = await response.json();

    return data.map(item => {
      const address = item.address || {};
      const cityName = address.city || address.town || address.province || address.state || address.county || item.name || '';
      return {
        name: item.display_name,
        shortName: item.name || item.display_name.split(',')[0],
        cityName: cityName,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type,
        class: item.class
      };
    });
  } catch (err) {
    console.error('Nominatim search failed:', err);
    throw err;
  }
}

/**
 * Reverse geocode coordinates to get City/District name
 */
export async function getRegionFromCoords(lat, lng) {
  const url = `${NOMINATIM_REVERSE_URL}?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=tr,en`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AltayApp/1.0 (https://an1lbayram-github-io.vercel.app/)'
      }
    });

    if (!response.ok) return '';

    const data = await response.json();
    const address = data.address || {};
    return address.city || address.town || address.province || address.state || address.county || '';
  } catch (err) {
    return '';
  }
}
