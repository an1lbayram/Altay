/**
 * Helper Utility Functions
 */

/**
 * Calculate distance between two coordinates in kilometers using Haversine formula
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Format distance string for display
 */
export function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Escape HTML to prevent XSS attacks
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Debounce helper function for search inputs
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Categories Definition with Icons & Colors
 */
export const CATEGORIES = {
  all: { id: 'all', name: 'Tümü', icon: 'fa-layer-group', color: 'teal' },
  historic: { id: 'historic', name: 'Tarihi Eser', icon: 'fa-landmark', color: 'amber' },
  museum: { id: 'museum', name: 'Müze', icon: 'fa-building-columns', color: 'indigo' },
  castle: { id: 'castle', name: 'Kale & Sur', icon: 'fa-chess-rook', color: 'emerald' },
  ancient: { id: 'ancient', name: 'Antik Kent', icon: 'fa-archway', color: 'orange' },
  religion: { id: 'religion', name: 'İbadethane', icon: 'fa-place-of-worship', color: 'rose' },
  monument: { id: 'monument', name: 'Anıt & Heykel', icon: 'fa-monument', color: 'sky' },
};

/**
 * Categorize POI based on OpenStreetMap tags
 */
export function getPoiCategory(tags = {}) {
  if (tags.tourism === 'museum') return 'museum';
  if (tags.historic === 'castle' || tags.historic === 'fort' || tags.historic === 'citywalls') return 'castle';
  if (tags.historic === 'archaeological_site' || tags.historic === 'ruins') return 'ancient';
  if (tags.amenity === 'place_of_worship' || tags.historic === 'church' || tags.historic === 'mosque') return 'religion';
  if (tags.historic === 'monument' || tags.historic === 'memorial') return 'monument';
  return 'historic';
}
