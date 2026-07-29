import L from 'leaflet';
import { getPoiCategory } from './helpers.js';

const categoryColorMap = {
  all: '#0d9488',
  historic: '#d97706',
  museum: '#4f46e5',
  castle: '#059669',
  ancient: '#ea580c',
  religion: '#e11d48',
  monument: '#0284c7'
};

const categoryIconMap = {
  all: 'fa-layer-group',
  historic: 'fa-landmark',
  museum: 'fa-building-columns',
  castle: 'fa-chess-rook',
  ancient: 'fa-archway',
  religion: 'fa-place-of-worship',
  monument: 'fa-monument'
};

/**
 * Creates custom SVG DivIcon for Leaflet markers based on POI category
 */
export function createCustomMarkerIcon(poi) {
  const categoryKey = getPoiCategory(poi.tags);
  const color = categoryColorMap[categoryKey] || categoryColorMap.historic;
  const iconClass = categoryIconMap[categoryKey] || categoryIconMap.historic;

  const html = `
    <div style="position: relative; width: 36px; height: 46px; cursor: pointer; filter: drop-shadow(0 6px 8px rgba(0,0,0,0.3));">
      <svg width="36" height="46" viewBox="0 0 36 46" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 0C8.05887 0 0 8.05887 0 18C0 29.25 18 46 18 46C18 46 36 29.25 36 18C36 8.05887 27.9411 0 18 0Z" fill="${color}"/>
        <circle cx="18" cy="18" r="13" fill="#FFFFFF"/>
      </svg>
      <div style="position: absolute; top: 7px; left: 0; width: 36px; text-align: center; color: ${color}; font-size: 14px;">
        <i class="fa-solid ${iconClass}"></i>
      </div>
    </div>
  `;

  return L.divIcon({
    html: html,
    className: 'custom-poi-marker',
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -42]
  });
}

/**
 * User location pulsing marker
 */
export const userLocationIcon = L.divIcon({
  html: `
    <div class="user-marker-pin">
      <div class="user-marker-pulse"></div>
    </div>
  `,
  className: 'custom-user-location-marker',
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});
