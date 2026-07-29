import { getWikipediaInfo } from './wikipedia.js';
import { getWikidataDetails } from './wikidata.js';
import { getLiveWeather, getElevation, isUnescoWorldHeritage } from './freeApis.js';

/**
 * Multi-Source Data Fusion Engine (OSM + Wikidata + Wikipedia + Wikimedia + Open-Meteo + Open-Elevation + UNESCO)
 */
export async function fetchEnrichedPoiDetails(poi, regionContext = '') {
  const poiCoords = { lat: poi.lat, lng: poi.lng };
  const tags = poi.tags || {};

  // 1. Parallel API fetches for maximum performance
  const wikidataId = tags.wikidata || tags['subject:wikidata'];
  
  const [wikidataInfo, weatherData, elevationMeters] = await Promise.all([
    wikidataId ? getWikidataDetails(wikidataId) : Promise.resolve(null),
    getLiveWeather(poi.lat, poi.lng),
    getElevation(poi.lat, poi.lng)
  ]);

  // 2. Fetch Wikipedia summary with strict region & coordinate validation
  const wikipediaTag = tags.wikipedia || (wikidataInfo?.label ? `tr:${wikidataInfo.label}` : '');
  const wikiInfo = await getWikipediaInfo(wikipediaTag, poi.name, regionContext, poiCoords);

  // 3. Check UNESCO World Heritage status
  const isUnesco = isUnescoWorldHeritage(poi.name, tags);

  // 4. Fused Image Resolution Priority
  let finalImage = '';
  if (tags.image) {
    finalImage = tags.image.startsWith('http') ? tags.image : `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(tags.image)}?width=800`;
  } else if (tags.wikimedia_commons) {
    const commonsVal = tags.wikimedia_commons.replace(/^Category:/i, '').replace(/^File:/i, '');
    finalImage = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commonsVal)}?width=800`;
  } else if (wikidataInfo?.imageUrl) {
    finalImage = wikidataInfo.imageUrl;
  } else if (wikiInfo.thumbnail) {
    finalImage = wikiInfo.thumbnail;
  }

  // 5. Fused Text Description Resolution
  let finalExtract = wikiInfo.extract;
  if (!finalExtract || finalExtract === 'Bu tarihi mekan için bilgi hazırlanmaktadır.') {
    if (wikidataInfo?.description) {
      finalExtract = `${poi.name}, ${wikidataInfo.description}.`;
    } else if (poi.description) {
      finalExtract = poi.description;
    } else {
      finalExtract = 'Bu tarihi mekan için detaylı arşiv araştırması devam etmektedir.';
    }
  }

  // 6. Fused Historical & Geographic Specs
  const specs = [];
  const inceptionVal = wikidataInfo?.inception || tags.start_date || tags['building:year'];
  if (inceptionVal) specs.push({ label: 'Dönem / Yapım Yılı', val: inceptionVal });

  const architectVal = wikidataInfo?.architect || tags.architect;
  if (architectVal) specs.push({ label: 'Mimarı / Ustası', val: architectVal });

  const civilizationVal = wikidataInfo?.civilization;
  if (civilizationVal) specs.push({ label: 'Uygarlık / Kültür', val: civilizationVal });

  if (elevationMeters !== null) specs.push({ label: 'Rakım (Deniz Seviyesi)', val: `${elevationMeters} m` });
  if (tags.historic) specs.push({ label: 'Tarihi Sınıfı', val: tags.historic.toUpperCase() });
  if (tags.heritage) specs.push({ label: 'Tescil Statüsü', val: `Tescilli Kültür Varlığı (${tags.heritage})` });

  return {
    title: poi.name,
    extract: finalExtract,
    image: finalImage,
    pageUrl: wikiInfo.pageUrl || (wikidataId ? `https://www.wikidata.org/wiki/${wikidataId}` : ''),
    specs,
    weather: weatherData,
    elevation: elevationMeters,
    isUnesco,
    wikidataInfo,
    isVerified: !!(wikidataId || tags.wikipedia || tags.heritage || isUnesco)
  };
}
