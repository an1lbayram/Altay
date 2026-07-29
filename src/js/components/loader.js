import { state } from '../state.js';

let loaderEl = null;

export function initLoader() {
  if (loaderEl) return;

  loaderEl = document.createElement('div');
  loaderEl.id = 'altay-global-loader';
  loaderEl.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4 opacity-0 pointer-events-none transition-all duration-300 backdrop-blur-lg bg-slate-950/50 dark:bg-slate-950/70 select-none';

  loaderEl.innerHTML = `
    <div class="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl max-w-sm w-full text-center transform scale-90 transition-all duration-300 space-y-5" id="loader-card">
      
      <!-- Glowing Animated Icon Container -->
      <div class="relative w-20 h-20 mx-auto flex items-center justify-center">
        <!-- Outer Glowing Ring -->
        <div class="absolute inset-0 rounded-full bg-teal-500/20 dark:bg-teal-400/20 animate-ping"></div>
        
        <!-- Rotating Gradient Spinner Ring -->
        <div class="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-500 border-r-teal-400 dark:border-t-teal-400 dark:border-r-amber-400 animate-spin"></div>
        
        <!-- Inner Brand Compass Icon -->
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center text-white text-2xl shadow-lg shadow-teal-500/30">
          <i class="fa-solid fa-map-location-dot animate-bounce"></i>
        </div>
      </div>

      <!-- Loading Texts -->
      <div class="space-y-1.5">
        <h3 id="loader-title" class="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
          Tarihi Eserler Taranıyor...
        </h3>
        <p id="loader-subtitle" class="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Overpass & Kültür Mirası Ağı taranıyor
        </p>
      </div>

      <!-- Shimmer Progress Line -->
      <div class="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div class="bg-gradient-to-r from-teal-500 via-amber-400 to-teal-400 h-full w-full animate-pulse"></div>
      </div>

    </div>
  `;

  document.body.appendChild(loaderEl);

  // Subscribe to state isLoading changes
  state.subscribe((key, value) => {
    if (key === 'isLoading') {
      if (value) {
        showLoader();
      } else {
        hideLoader();
      }
    }
  });
}

export function showLoader(customTitle = null, customSubtitle = null) {
  initLoader();
  const card = document.getElementById('loader-card');
  const titleEl = document.getElementById('loader-title');
  const subtitleEl = document.getElementById('loader-subtitle');

  const regionName = state.currentRegionName || state.searchQuery || '';
  if (customTitle) {
    titleEl.textContent = customTitle;
  } else if (regionName) {
    titleEl.textContent = `"${regionName}" Taranıyor...`;
  } else {
    titleEl.textContent = 'Tarihi Eserler Taranıyor...';
  }

  if (customSubtitle) {
    subtitleEl.textContent = customSubtitle;
  } else {
    subtitleEl.textContent = 'Overpass & Kültür Mirası Veri Ağına Bağlanılıyor';
  }

  loaderEl.classList.remove('opacity-0', 'pointer-events-none');
  if (card) {
    card.classList.remove('scale-90');
    card.classList.add('scale-100');
  }
}

export function hideLoader() {
  if (!loaderEl) return;
  const card = document.getElementById('loader-card');
  if (card) {
    card.classList.remove('scale-100');
    card.classList.add('scale-90');
  }
  loaderEl.classList.add('opacity-0', 'pointer-events-none');
}
