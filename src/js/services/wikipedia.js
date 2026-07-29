import { calculateDistance } from '../utils/helpers.js';

/**
 * Wikipedia API REST Service with Region, Coordinate & Content Validation
 */

const wikiCache = new Map();

// Known Turkish provinces to prevent cross-province mismatches
const PROVINCES = [
  'adana', 'adıyaman', 'afyonkarahisar', 'ağrı', 'amasya', 'ankara', 'antalya', 'artvin', 'aydın',
  'balıkesir', 'bilecik', 'bingöl', 'bitlis', 'bolu', 'burdur', 'bursa', 'çanakkale', 'çankırı',
  'çorum', 'denizli', 'diyarbakır', 'edirne', 'elazığ', 'erzincan', 'erzurum', 'eskişehir', 'gaziantep',
  'giresun', 'gümüşhane', 'hakkari', 'hatay', 'isparta', 'mersin', 'istanbul', 'izmir', 'kars',
  'kastamonu', 'kayseri', 'kırklareli', 'kırşehir', 'kocaeli', 'konya', 'kütahya', 'malatya', 'manisa',
  'kahramanmaraş', 'mardin', 'muğla', 'muş', 'nevşehir', 'niğde', 'ordu', 'rize', 'sakarya', 'samsun',
  'siirt', 'sinop', 'sivas', 'tekirdağ', 'tokat', 'trabzon', 'tunceli', 'şanlıurfa', 'uşak', 'van',
  'yozgat', 'zonguldak', 'aksaray', 'bayburt', 'karaman', 'kırıkkale', 'batman', 'şırnak', 'bartın',
  'ardahan', 'iğdır', 'yalova', 'karabük', 'kilis', 'osmaniye', 'düzce'
];

// Generic common English & Turkish fallback words that must NEVER be queried on Wikipedia search globally
const GENERIC_TITLES = [
  'clock', 'saat', 'saat kulesi', 'tower', 'kule', 'bridge', 'köprü', 'fountain', 'çeşme',
  'gate', 'kapı', 'wall', 'sur', 'stone', 'taş', 'house', 'ev', 'building', 'bina',
  'square', 'meydan', 'park', 'parkı', 'station', 'istasyon', 'center', 'merkez',
  'tarihi kaya mezarı', 'kaya mezarı', 'antik kalıntı', 'tarihi kale & sur',
  'tarihi kale', 'tarihi mekan', 'turistik mekan', 'müze', 'tarihi ibadethane',
  'tarihi anıt', 'tarihi eser', 'tarihi bina', 'antik kent / arkeolojik alan',
  'monument', 'statue', 'memorial', 'tomb', 'ruins', 'site', 'viewpoint', 'information', 'sign', 'board'
];

/**
 * Filter out unrelated pages (sports players, software/tech apps, movies, games, coordinate distance > 35km)
 */
function isHistoryOrLocationRelated(data = {}, targetRegion = '', poiCoords = null) {
  if (!data) return false;

  const extract = data.extract || '';
  const description = data.description || '';
  const title = data.title || '';
  const combined = `${extract} ${description} ${title}`.toLowerCase();

  // Coordinate Distance Validation: If Wikipedia data has geographic coordinates, verify distance to POI
  if (data.coordinates && poiCoords && poiCoords.lat && poiCoords.lng) {
    const wikiLat = data.coordinates.lat;
    const wikiLon = data.coordinates.lon;
    const distanceKm = calculateDistance(wikiLat, wikiLon, poiCoords.lat, poiCoords.lng);
    if (distanceKm > 35) {
      // Wikipedia article represents a place more than 35km away! REJECT!
      return false;
    }
  }

  // Unrelated technology, software, sports, media keywords
  const unrelatedKeywords = [
    // Tech & Software
    'yazılım', 'uygulama', 'mobil uygulama', 'iphone', 'ipad', 'ios', 'android',
    'işletim sistemi', 'önceden yüklenmiş', 'yazılımdır', 'uygulamadır', 'şirket',
    'marka', 'teknoloji', 'akıllı telefon', 'donanım', 'apple', 'google', 'microsoft',
    'sürümünden', 'sürümü', 'platformu', 'yazılımı', 'yazılım şirketidir',
    // Media & Sports
    'video oyunu', 'oyun', 'albüm', 'single', 'dizi', 'film', 'roman', 'çizgi roman',
    'karakter', 'basketbolcu', 'futbolcu', 'voleybolcu', 'şütör', 'gard', 'forvet', 
    'spor kulübü', 'aktör', 'aktris', 'şarkıcı', 'müzisyen', 'rapçi',
    'televizyon sunucusu', 'filmografisi', 'diskografisi', 'teknik direktör',
    'doğumlu basketbolcu', 'doğumlu futbolcu', 'doğumlu oyuncu',
    'basketball player', 'footballer', 'soccer player', 'actor', 'actress', 'singer', 'software', 'application'
  ];

  for (const kw of unrelatedKeywords) {
    if (combined.includes(kw)) return false;
  }

  // Cross-province mismatch check
  if (targetRegion) {
    const regionLower = targetRegion.toLowerCase();
    for (const province of PROVINCES) {
      if (province !== regionLower && !regionLower.includes(province) && (combined.includes(`${province} ili`) || combined.includes(`${province}'de`) || combined.includes(`${province}'da`))) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Fetch Wikipedia summary and thumbnail safely
 */
export async function getWikipediaInfo(wikipediaTag, nameFallback, regionContext = '', poiCoords = null) {
  let lang = 'tr';
  let title = nameFallback;

  if (wikipediaTag && wikipediaTag.includes(':')) {
    const parts = wikipediaTag.split(':');
    lang = parts[0] || 'tr';
    title = parts.slice(1).join(':');
  } else if (wikipediaTag) {
    title = wikipediaTag;
  }

  const cacheKey = `${lang}:${title}:${regionContext}`;
  if (wikiCache.has(cacheKey)) {
    return wikiCache.get(cacheKey);
  }

  const defaultFallback = {
    title: nameFallback || title,
    extract: 'Bu tarihi mekan için bilgi hazırlanmaktadır.',
    thumbnail: '',
    pageUrl: '',
    description: ''
  };

  // Check if title is generic or common word (e.g. "Clock", "Saat Kulesi", "Tarihi Kaya Mezarı")
  const titleLower = (nameFallback || title || '').trim().toLowerCase();
  const isGeneric = !wikipediaTag && GENERIC_TITLES.some(g => titleLower === g || titleLower === `${g}s`);

  if (isGeneric) {
    wikiCache.set(cacheKey, defaultFallback);
    return defaultFallback;
  }

  try {
    // 1. Try exact Wikipedia summary endpoint
    const apiUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const response = await fetch(apiUrl);

    if (response.ok) {
      const data = await response.json();
      if (isHistoryOrLocationRelated(data, regionContext, poiCoords)) {
        const result = {
          title: data.title || title,
          extract: data.extract || 'Bu tarihi mekan için bilgi hazırlanmaktadır.',
          thumbnail: data.thumbnail?.source || data.originalimage?.source || '',
          pageUrl: data.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
          description: data.description || ''
        };

        wikiCache.set(cacheKey, result);
        return result;
      }
    }

    // 2. If explicit tag failed or wasn't provided, search with region context appended
    if (!wikipediaTag && nameFallback && !nameFallback.startsWith('Sign ') && !isGeneric) {
      const searchQuery = regionContext ? `${nameFallback} ${regionContext}` : nameFallback;
      const searchRes = await searchWikipedia(searchQuery, lang, regionContext, poiCoords);
      if (searchRes && isHistoryOrLocationRelated(searchRes.raw, regionContext, poiCoords)) {
        wikiCache.set(cacheKey, searchRes);
        return searchRes;
      }
    }
  } catch (err) {
    console.warn('Wikipedia API fetch warning:', err);
  }

  wikiCache.set(cacheKey, defaultFallback);
  return defaultFallback;
}

/**
 * Search Wikipedia by query string
 */
async function searchWikipedia(query, lang = 'tr', regionContext = '', poiCoords = null) {
  try {
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    const resp = await fetch(searchUrl);
    if (!resp.ok) return null;
    const data = await resp.json();
    const firstResult = data.query?.search?.[0];
    if (!firstResult) return null;

    // Fetch summary for first search result
    const summaryResp = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstResult.title)}`);
    if (!summaryResp.ok) return null;
    const summaryData = await summaryResp.json();

    if (!isHistoryOrLocationRelated(summaryData, regionContext, poiCoords)) {
      return null;
    }

    return {
      title: summaryData.title,
      extract: summaryData.extract || 'Bu tarihi mekan için bilgi hazırlanmaktadır.',
      thumbnail: summaryData.thumbnail?.source || summaryData.originalimage?.source || '',
      pageUrl: summaryData.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(summaryData.title)}`,
      description: summaryData.description || '',
      raw: summaryData
    };
  } catch (err) {
    return null;
  }
}
