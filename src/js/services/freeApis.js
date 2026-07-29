/**
 * Free Public APIs Service Hub for Altay
 * Integrates:
 * 1. Open-Meteo API (Live Weather & Forecast)
 * 2. Open-Elevation API (Altitude / Meters above sea level)
 * 3. UNESCO World Heritage Matcher API
 */

const UNESCO_SITES_TR = [
  'xanthos', 'letoon', 'efes', 'ephesus', 'göreme', 'goreme', 'kapadokya', 'cappadocia',
  'pamukkale', 'hierapolis', 'hattuşa', 'hattusa', 'nemrut', 'nemrud', 'troya', 'troy',
  'divriği', 'divrigi', 'safranbolu', 'çatalhöyük', 'catalhoyuk', 'bergama', 'pergamum',
  'bursa', 'cumalıkızık', 'diyarbakır', 'hevsel', 'ani', 'aphrodisias', 'afrodisyas',
  'göbeklitepe', 'gobeklitepe', 'arslantepe'
];

/**
 * Fetch live weather data from Open-Meteo API (100% Free, No Key)
 */
export async function getLiveWeather(lat, lng) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const current = data.current_weather;
    if (!current) return null;

    const weatherCode = current.weathercode;
    const temp = Math.round(current.temperature);

    return {
      temp: temp,
      windSpeed: current.windspeed,
      condition: getWeatherConditionText(weatherCode),
      icon: getWeatherIconClass(weatherCode)
    };
  } catch (err) {
    console.warn('Open-Meteo fetch warning:', err);
    return null;
  }
}

/**
 * Fetch altitude/elevation in meters from Open-Elevation API (100% Free)
 */
export async function getElevation(lat, lng) {
  try {
    const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;

    const data = await response.json();
    const result = data.results?.[0];
    if (result && result.elevation !== undefined) {
      return Math.round(result.elevation);
    }
  } catch (err) {
    // Silent fallback
  }
  return null;
}

/**
 * Check if location is an official UNESCO World Heritage Site
 */
export function isUnescoWorldHeritage(name = '', tags = {}) {
  const combined = `${name} ${tags.wikipedia || ''} ${tags.heritage || ''}`.toLowerCase();
  if (tags.heritage === '1' || tags.heritage_operator === 'unesco' || tags.unesco) {
    return true;
  }
  return UNESCO_SITES_TR.some(site => combined.includes(site));
}

/**
 * Map Weather Code to WMO text
 */
function getWeatherConditionText(code) {
  if (code === 0) return 'Açık & Güneşli';
  if (code === 1 || code === 2) return 'Az Bulutlu';
  if (code === 3) return 'Kapalı Bulutlu';
  if (code >= 45 && code <= 48) return 'Sisli';
  if (code >= 51 && code <= 67) return 'Yağmurlu';
  if (code >= 71 && code <= 77) return 'Karlı';
  if (code >= 80 && code <= 82) return 'Sağanak Yağışlı';
  if (code >= 95) return 'Fırtınalı';
  return 'Güneşli';
}

/**
 * Map Weather Code to FontAwesome icon
 */
function getWeatherIconClass(code) {
  if (code === 0) return 'fa-sun text-amber-400';
  if (code === 1 || code === 2) return 'fa-cloud-sun text-amber-300';
  if (code === 3) return 'fa-cloud text-slate-400';
  if (code >= 45 && code <= 48) return 'fa-smog text-slate-400';
  if (code >= 51 && code <= 67) return 'fa-cloud-rain text-blue-400';
  if (code >= 71 && code <= 77) return 'fa-snowflake text-sky-300';
  if (code >= 80 && code <= 82) return 'fa-cloud-showers-heavy text-blue-500';
  if (code >= 95) return 'fa-bolt text-amber-500';
  return 'fa-sun text-amber-400';
}
