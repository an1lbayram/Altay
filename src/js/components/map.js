import L from 'leaflet';
import 'leaflet.markercluster';
import { state } from '../state.js';
import { createCustomMarkerIcon, userLocationIcon } from '../utils/icons.js';
import { formatDistance, escapeHtml } from '../utils/helpers.js';
import { Storage } from '../services/storage.js';
import { openPoiModal } from './modal.js';

let map = null;
let tileLayers = {};
let currentTileLayer = null;
let markerClusterGroup = null;
let userMarker = null;

const TILE_CONFIGS = {
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abc',
    maxZoom: 19
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    subdomains: '',
    maxZoom: 19
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    subdomains: 'abc',
    maxZoom: 17
  }
};

export function resizeMap() {
  if (map) {
    map.invalidateSize();
  }
}

export function initMap(containerId = 'map') {
  map = L.map(containerId, {
    zoomControl: false,
    attributionControl: false
  }).setView([state.userLocation.lat, state.userLocation.lng], 14);

  // Initialize tile layers
  Object.keys(TILE_CONFIGS).forEach(key => {
    const config = TILE_CONFIGS[key];
    tileLayers[key] = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom || 19,
      subdomains: config.subdomains || 'abc',
      crossOrigin: true
    });
  });

  const activeTileKey = Storage.getMapTile() || 'streets';
  currentTileLayer = tileLayers[activeTileKey] || tileLayers.streets;
  currentTileLayer.addTo(map);

  // Force Leaflet container size recalculation after DOM layout settles
  requestAnimationFrame(() => {
    if (map) map.invalidateSize();
  });
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 300);

  // Initialize Marker Cluster Group with custom options
  markerClusterGroup = L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    maxClusterRadius: 45,
    disableClusteringAtZoom: 17
  });

  map.addLayer(markerClusterGroup);

  // Custom Zoom Control position
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

  // Render initial user location marker
  updateUserMarker(state.userLocation.lat, state.userLocation.lng);

  return map;
}

export function switchMapTile(tileKey) {
  if (!map || !tileLayers[tileKey]) return;
  if (currentTileLayer) map.removeLayer(currentTileLayer);
  currentTileLayer = tileLayers[tileKey];
  currentTileLayer.addTo(map);
  Storage.setMapTile(tileKey);
  state.set('mapTheme', tileKey);
}

export function updateUserMarker(lat, lng) {
  if (!map) return;
  const latlng = [lat, lng];

  if (userMarker) {
    userMarker.setLatLng(latlng);
  } else {
    userMarker = L.marker(latlng, { icon: userLocationIcon })
      .addTo(map)
      .bindPopup('<div class="p-2 text-center text-xs font-bold text-teal-700 dark:text-teal-400"><i class="fa-solid fa-crosshairs me-1"></i> Konumunuz</div>');
    // Leaflet's divIcon markers get role="button" but only set a JS `.alt` property
    // (meaningless on a <div>, invisible to screen readers) — set a real aria-label instead.
    userMarker.getElement()?.setAttribute('aria-label', 'Mevcut konumunuz');
  }
}

export function centerMap(lat, lng, zoom = 15) {
  if (!map) return;
  map.flyTo([lat, lng], zoom, {
    animate: true,
    duration: 1.2
  });
}

export function renderPoiMarkers(pois) {
  if (!map || !markerClusterGroup) return;

  markerClusterGroup.clearLayers();

  pois.forEach(poi => {
    const markerIcon = createCustomMarkerIcon(poi);
    const marker = L.marker([poi.lat, poi.lng], { icon: markerIcon });

    // Same divIcon aria-label fix as the user marker; bound before adding to the cluster
    // group since clustered markers only get a DOM element once individually rendered.
    marker.on('add', () => {
      marker.getElement()?.setAttribute('aria-label', poi.name);
    });

    const googleMapsDirUrl = `https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lng}`;
    const distanceText = formatDistance(poi.distance);

    const popupHtml = `
      <div class="w-64 p-3 font-sans">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <span class="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
            ${escapeHtml(poi.category)}
          </span>
          <span class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
            <i class="fa-solid fa-location-arrow text-[10px]"></i> ${distanceText}
          </span>
        </div>
        <h4 class="font-bold text-sm text-slate-900 dark:text-white leading-tight mb-2">
          ${escapeHtml(poi.name)}
        </h4>
        <div class="flex items-center gap-2 mt-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button id="popup-btn-${poi.id}" class="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm">
            <i class="fa-solid fa-circle-info"></i> Detaylar
          </button>
          <a href="${googleMapsDirUrl}" target="_blank" rel="noopener noreferrer" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 p-2 rounded-lg transition-colors text-xs flex items-center justify-center" title="Yol Tarifi">
            <i class="fa-solid fa-diamond-turn-right text-teal-600 dark:text-teal-400"></i>
          </a>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);

    marker.on('popupopen', () => {
      setTimeout(() => {
        const btn = document.getElementById(`popup-btn-${poi.id}`);
        if (btn) {
          btn.onclick = () => openPoiModal(poi);
        }
      }, 0);
    });

    markerClusterGroup.addLayer(marker);
  });
}
