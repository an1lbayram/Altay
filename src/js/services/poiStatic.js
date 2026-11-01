import { calculateDistance } from '../utils/helpers.js';
import { matchesCategory } from './poiCategories.js';

/**
 * Turkiye icin onceden hazirlanmis OpenStreetMap verisi (public/data/poi).
 *
 * scripts/build_poi_data.py tarafindan uretilir, haftalik is akisi gunceller. Turkiye'de
 * canli Overpass'a hic gidilmez: herkese acik Overpass ornekleri IP basina gunluk kota
 * uyguluyor ve sik sik yanit vermiyor. Veri 0,5 derecelik hucrelere bolunmus durumda;
 * bir arama yalnizca dairenin degdigi hucreleri indirir.
 *
 * Bicim: index.json -> { cellSize, layers: ['core','worship'], cells: { "73_58": [core, worship] } }
 *        <katman>/<hucre>.json -> [[tur('n'|'w'|'r'), id, enlem, boylam, etiketler], ...]
 */
export const DATA_BASE = '/data/poi';
const KM_PER_DEG_LAT = 111.32;
const TYPES = { n: 'node', w: 'way', r: 'relation' };

let indexPromise = null;
const cellPromises = new Map();

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  }
}

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Kucuk ve paylasilan istekler: tek bir aramanin iptali digerlerini bozmasin diye sinyal
// verilmiyor; basarisiz olursa onbellekten cikip sonraki aramada tekrar deneniyor.
function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetchJson(`${DATA_BASE}/index.json`).then((index) => {
      const valid = index && typeof index.cellSize === 'number' && index.cells && typeof index.cells === 'object';
      if (!valid) indexPromise = null;
      return valid ? index : null;
    });
  }
  return indexPromise;
}

function loadCell(path) {
  if (!cellPromises.has(path)) {
    cellPromises.set(
      path,
      fetchJson(`${DATA_BASE}/${path}.json`).then((rows) => {
        if (!Array.isArray(rows)) cellPromises.delete(path);
        return Array.isArray(rows) ? rows : null;
      })
    );
  }
  return cellPromises.get(path);
}

export function cellKey(lat, lng, cellSize) {
  return `${Math.floor(lat / cellSize)}_${Math.floor(lng / cellSize)}`;
}

function toOverpassElement([t, id, lat, lon, tags]) {
  const type = TYPES[t] || 'node';
  return type === 'node' ? { type, id, lat, lon, tags } : { type, id, center: { lat, lon }, tags };
}

/**
 * Arama merkezi kapsam icindeyse (Turkiye) Overpass bicimindeki elemanlari doner,
 * degilse veya veri yuklenemezse null doner - o zaman cagiran Overpass'a gecer.
 */
export async function fetchStaticElements({ lat, lng, radiusKm, category = 'all', signal }) {
  const index = await loadIndex();
  throwIfAborted(signal);
  if (!index) return null;

  const size = index.cellSize;
  if (!index.cells[cellKey(lat, lng, size)]) return null;

  const layerNames = Array.isArray(index.layers) ? index.layers : ['core', 'worship'];
  const wanted = category === 'religion' ? layerNames : layerNames.filter((l) => l !== 'worship');

  const dLat = radiusKm / KM_PER_DEG_LAT;
  const dLng = radiusKm / (KM_PER_DEG_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const paths = [];
  for (let i = Math.floor((lat - dLat) / size); i <= Math.floor((lat + dLat) / size); i++) {
    for (let j = Math.floor((lng - dLng) / size); j <= Math.floor((lng + dLng) / size); j++) {
      const counts = index.cells[`${i}_${j}`];
      if (!counts) continue;
      wanted.forEach((layer) => {
        if (counts[layerNames.indexOf(layer)] > 0) paths.push(`${layer}/${i}_${j}`);
      });
    }
  }

  const cells = await Promise.all(paths.map(loadCell));
  throwIfAborted(signal);
  if (cells.some((rows) => rows === null)) return null;

  const elements = [];
  for (const rows of cells) {
    for (const row of rows) {
      const tags = row[4] || {};
      if (!matchesCategory(tags, category)) continue;
      if (calculateDistance(lat, lng, row[2], row[3]) > radiusKm) continue;
      elements.push(toOverpassElement(row));
    }
  }
  return elements;
}

/** Testler icin: modul onbellegini sifirlar. */
export function _resetStaticCache() {
  indexPromise = null;
  cellPromises.clear();
}
