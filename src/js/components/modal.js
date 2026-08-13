import { fetchEnrichedPoiDetails } from '../services/dataFusion.js';
import { speakText, stopSpeech, isAudioGuidePlaying } from './tts.js';
import { Storage } from '../services/storage.js';
import { showToast } from './toast.js';
import { formatDistance, escapeHtml } from '../utils/helpers.js';
import { state } from '../state.js';
import { centerMap } from './map.js';

let modalEl = null;

export function initModal() {
  if (modalEl) return;

  modalEl = document.createElement('div');
  modalEl.id = 'poi-detail-modal';
  modalEl.className = 'fixed inset-0 z-[9990] flex items-center justify-center p-4 sm:p-6 opacity-0 pointer-events-none transition-all duration-300 backdrop-blur-md bg-slate-950/60';

  modalEl.innerHTML = `
    <div class="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800 transition-all transform scale-95 duration-300" id="modal-container">
      
      <!-- Hero Header Image -->
      <div class="relative h-56 w-full bg-slate-800 overflow-hidden group">
        <img id="modal-image" src="" alt="" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent"></div>
        
        <!-- Close Button -->
        <button id="modal-close-btn" class="absolute top-4 right-4 bg-slate-900/60 hover:bg-slate-900 text-white w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-lg" aria-label="Kapat">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <!-- Category, UNESCO & Weather Badges -->
        <div class="absolute top-4 left-4 flex flex-wrap items-center gap-1.5 max-w-[80%]">
          <span id="modal-category-badge" class="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-teal-500/90 text-white backdrop-blur-md shadow-md">
            Category
          </span>
          <span id="modal-unesco-badge" class="hidden px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-500/90 text-white backdrop-blur-md shadow-md items-center gap-1">
            <i class="fa-solid fa-landmark-flag"></i> UNESCO Mirası
          </span>
          <span id="modal-verified-badge" class="hidden px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-500/90 text-white backdrop-blur-md shadow-md items-center gap-1">
            <i class="fa-solid fa-circle-check"></i> Doğrulanmış Eser
          </span>
          <span id="modal-weather-badge" class="hidden px-2.5 py-1 text-[11px] font-semibold rounded-full bg-slate-900/80 text-amber-300 backdrop-blur-md shadow-md items-center gap-1">
            <i id="modal-weather-icon" class="fa-solid fa-sun"></i> <span id="modal-weather-temp">--°C</span>
          </span>
          <span id="modal-distance-badge" class="px-3 py-1 text-xs font-medium rounded-full bg-slate-900/80 text-teal-300 backdrop-blur-md shadow-md flex items-center gap-1">
            <i class="fa-solid fa-location-arrow text-[10px]"></i> <span id="modal-distance-text">0 km</span>
          </span>
        </div>

        <!-- Title -->
        <div class="absolute bottom-4 left-5 right-5">
          <h2 id="modal-title" class="text-2xl font-black text-white tracking-tight leading-snug drop-shadow-md">
            Title
          </h2>
        </div>
      </div>

      <!-- Content Body -->
      <div class="p-6 space-y-4 max-h-[55vh] overflow-y-auto">
        <!-- Audio Reader Control -->
        <div class="flex items-center justify-between p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md">
              <i class="fa-solid fa-volume-high text-lg"></i>
            </div>
            <div>
              <h4 class="text-xs font-bold text-teal-900 dark:text-teal-200">Sesli Rehber</h4>
              <p class="text-[11px] text-teal-700 dark:text-teal-400">Türkçe sesli anlatım</p>
            </div>
          </div>
          <button id="modal-audio-btn" class="bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-2">
            <i class="fa-solid fa-play"></i> Dinle
          </button>
        </div>

        <!-- Extract Description -->
        <div id="modal-description" class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          Yükleniyor...
        </div>

        <!-- Historical Specs Grid ("Tarihi Künye") -->
        <div id="modal-specs-container" class="hidden pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <h4 class="text-xs font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
            <i class="fa-solid fa-scroll"></i> Tarihi Künye
          </h4>
          <div id="modal-specs-grid" class="grid grid-cols-2 gap-2 text-xs"></div>
        </div>

        <!-- Nearby Historical Heritage Carousel -->
        <div id="modal-nearby-container" class="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <h4 class="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <i class="fa-solid fa-compass"></i> Yakındaki Diğer Eserler
          </h4>
          <div id="modal-nearby-list" class="flex gap-2 overflow-x-auto no-scrollbar py-1"></div>
        </div>
      </div>

      <!-- Footer Controls -->
      <div class="p-5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <button id="modal-bookmark-btn" class="flex-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2.5 px-4 rounded-xl transition-all text-xs flex items-center justify-center gap-2">
          <i class="fa-regular fa-bookmark"></i> Kaydet
        </button>

        <a id="modal-maps-link" href="#" target="_blank" rel="noopener noreferrer" class="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-all text-xs flex items-center justify-center gap-2 shadow-md">
          <i class="fa-solid fa-diamond-turn-right"></i> Yol Tarifi
        </a>

        <button id="modal-share-btn" class="w-10 h-10 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center transition-all" aria-label="Paylaş">
          <i class="fa-solid fa-share-nodes"></i>
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modalEl);

  // Close handlers
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closePoiModal();
  });
  document.getElementById('modal-close-btn').onclick = closePoiModal;
}

export async function openPoiModal(poi) {
  initModal();

  const container = document.getElementById('modal-container');
  const titleEl = document.getElementById('modal-title');
  const categoryBadge = document.getElementById('modal-category-badge');
  const unescoBadge = document.getElementById('modal-unesco-badge');
  const verifiedBadge = document.getElementById('modal-verified-badge');
  const weatherBadge = document.getElementById('modal-weather-badge');
  const weatherIcon = document.getElementById('modal-weather-icon');
  const weatherTemp = document.getElementById('modal-weather-temp');
  const distanceText = document.getElementById('modal-distance-text');
  const imageEl = document.getElementById('modal-image');
  const descEl = document.getElementById('modal-description');
  const specsContainer = document.getElementById('modal-specs-container');
  const specsGrid = document.getElementById('modal-specs-grid');
  const nearbyList = document.getElementById('modal-nearby-list');
  const audioBtn = document.getElementById('modal-audio-btn');
  const bookmarkBtn = document.getElementById('modal-bookmark-btn');
  const mapsLink = document.getElementById('modal-maps-link');
  const shareBtn = document.getElementById('modal-share-btn');

  // Set default values
  titleEl.textContent = poi.name;
  categoryBadge.textContent = poi.category || 'Tarihi Konum';
  distanceText.textContent = formatDistance(poi.distance);
  imageEl.src = 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?q=80&w=600&auto=format&fit=crop';
  descEl.innerHTML = '<div class="flex items-center gap-2 text-slate-500"><i class="fa-solid fa-spinner animate-spin"></i> Özgür API ağlarından veriler çekiliyor...</div>';

  mapsLink.href = `https://www.google.com/maps/dir/?api=1&destination=${poi.lat},${poi.lng}`;

  // Update Bookmark state
  const updateBookmarkUI = () => {
    const isFav = Storage.isFavorite(poi.id);
    if (isFav) {
      bookmarkBtn.className = 'flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 px-4 rounded-xl transition-all text-xs flex items-center justify-center gap-2 shadow-md';
      bookmarkBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Kaydedildi';
    } else {
      bookmarkBtn.className = 'flex-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2.5 px-4 rounded-xl transition-all text-xs flex items-center justify-center gap-2';
      bookmarkBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i> Kaydet';
    }
  };
  updateBookmarkUI();

  bookmarkBtn.onclick = () => {
    const { isAdded } = Storage.toggleFavorite(poi);
    updateBookmarkUI();
    showToast(isAdded ? `"${poi.name}" favorilere eklendi.` : `"${poi.name}" favorilerden çıkarıldı.`, isAdded ? 'success' : 'info');
  };

  // Share action
  shareBtn.onclick = async () => {
    const shareData = {
      title: poi.name,
      text: `${poi.name} - Altay ile keşfedin!`,
      url: window.location.href
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      navigator.clipboard.writeText(`${poi.name} (${poi.lat}, ${poi.lng})`);
      showToast('Konum bilgisi panoya kopyalandı.', 'success');
    }
  };

  // Render Nearby POIs strip
  const nearbyPois = state.pois.filter(p => p.id !== poi.id).slice(0, 5);
  if (nearbyPois.length > 0) {
    nearbyList.innerHTML = nearbyPois.map(n => `
      <button data-id="${n.id}" class="nearby-item flex-shrink-0 w-36 p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-left hover:border-teal-500 transition-all">
        <span class="text-[9px] font-bold text-teal-600 dark:text-teal-400 uppercase truncate block">${escapeHtml(n.category)}</span>
        <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">${escapeHtml(n.name)}</span>
        <span class="text-[10px] text-slate-400 block mt-1"><i class="fa-solid fa-location-arrow text-[8px]"></i> ${formatDistance(n.distance)}</span>
      </button>
    `).join('');

    nearbyList.querySelectorAll('.nearby-item').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const target = state.pois.find(p => p.id === id);
        if (target) {
          centerMap(target.lat, target.lng, 16);
          openPoiModal(target);
        }
      };
    });
  } else {
    nearbyList.innerHTML = '<span class="text-xs text-slate-400 italic">Yakında başka eser bulunamadı.</span>';
  }

  // Fetch Multi-Source Fused Data (OSM + Wikidata + Wikipedia + Wikimedia + Open-Meteo + Open-Elevation + UNESCO)
  const regionContext = state.currentRegionName || state.searchQuery || '';
  const enriched = await fetchEnrichedPoiDetails(poi, regionContext);

  if (enriched.image) {
    imageEl.src = enriched.image;
  }

  // Handle UNESCO Badge
  if (enriched.isUnesco) {
    unescoBadge.classList.remove('hidden');
    unescoBadge.classList.add('inline-flex');
  } else {
    unescoBadge.classList.add('hidden');
    unescoBadge.classList.remove('inline-flex');
  }

  // Handle Verified Badge
  if (enriched.isVerified) {
    verifiedBadge.classList.remove('hidden');
    verifiedBadge.classList.add('inline-flex');
  } else {
    verifiedBadge.classList.add('hidden');
    verifiedBadge.classList.remove('inline-flex');
  }

  // Handle Live Weather Badge (Open-Meteo API)
  if (enriched.weather) {
    weatherTemp.textContent = `${enriched.weather.temp}°C ${enriched.weather.condition}`;
    weatherIcon.className = `fa-solid ${enriched.weather.icon}`;
    weatherBadge.classList.remove('hidden');
    weatherBadge.classList.add('inline-flex');
  } else {
    weatherBadge.classList.add('hidden');
    weatherBadge.classList.remove('inline-flex');
  }

  let textContent = enriched.extract || 'Bu tarihi mekan için detaylı arşiv araştırması devam etmektedir.';
  descEl.innerHTML = `
    <p class="mb-3">${escapeHtml(textContent)}</p>
    ${enriched.pageUrl ? `<a href="${enriched.pageUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400">Arşiv Kaynağında Devamını Oku <i class="fa-solid fa-arrow-right text-[10px]"></i></a>` : ''}
  `;

  // Render "Tarihi Künye" (Fused Specs Grid)
  if (enriched.specs && enriched.specs.length > 0) {
    specsGrid.innerHTML = enriched.specs.map(s => `
      <div class="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
        <span class="text-[10px] font-semibold text-slate-400 block uppercase">${escapeHtml(s.label)}</span>
        <span class="font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">${escapeHtml(s.val)}</span>
      </div>
    `).join('');
    specsContainer.classList.remove('hidden');
  } else {
    specsContainer.classList.add('hidden');
  }

  // Audio Guide Handler
  let isPlaying = false;
  audioBtn.onclick = () => {
    if (isPlaying || isAudioGuidePlaying()) {
      stopSpeech();
      isPlaying = false;
      audioBtn.innerHTML = '<i class="fa-solid fa-play"></i> Dinle';
    } else {
      const speechSuccess = speakText(`${poi.name}. ${textContent}`, () => {
        audioBtn.innerHTML = '<i class="fa-solid fa-play"></i> Dinle';
        isPlaying = false;
      });
      if (speechSuccess) {
        isPlaying = true;
        audioBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Durdur';
      } else {
        showToast('Tarayıcınız sesli okumayı desteklemiyor.', 'warning');
      }
    }
  };

  // Show Modal
  modalEl.classList.remove('opacity-0', 'pointer-events-none');
  container.classList.remove('scale-95');
  container.classList.add('scale-100');
}

export function closePoiModal() {
  stopSpeech();
  if (!modalEl) return;
  const container = document.getElementById('modal-container');
  if (container) {
    container.classList.remove('scale-100');
    container.classList.add('scale-95');
  }
  modalEl.classList.add('opacity-0', 'pointer-events-none');
}
