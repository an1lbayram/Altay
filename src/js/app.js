import { state } from './state.js';
import { initMap, updateUserMarker, centerMap, renderPoiMarkers, switchMapTile, resizeMap } from './components/map.js';
import { fetchPOIs } from './services/overpass.js';
import { searchLocation, getRegionFromCoords } from './services/nominatim.js';
import { showToast } from './components/toast.js';
import { renderSidebar } from './components/sidebar.js';
import { Storage } from './services/storage.js';
import { initLoader } from './components/loader.js';
import { debounce, CATEGORIES, escapeHtml } from './utils/helpers.js';

// DOM Cache
const dom = {};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  cacheDOM();
  applyInitialTheme();
  registerServiceWorker();
  initLoader();

  // Initialize Map
  initMap('map');

  // Bind Events
  bindEvents();

  // Initial Geolocation
  getUserGeolocation();

  // Subscribe to state updates
  state.subscribe((key, value) => {
    if (key === 'pois' || key === 'isLoading') {
      renderSidebar();
    }
  });
}

function cacheDOM() {
  dom.searchInput = document.getElementById('searchInput');
  dom.searchSuggestions = document.getElementById('searchSuggestions');
  dom.locateBtn = document.getElementById('locateBtn');
  dom.radiusSlider = document.getElementById('radiusSlider');
  dom.radiusValue = document.getElementById('radiusValue');
  dom.categoryContainer = document.getElementById('categoryContainer');
  dom.themeToggleBtn = document.getElementById('themeToggleBtn');
  dom.layerToggleBtn = document.getElementById('layerToggleBtn');
  dom.layerMenu = document.getElementById('layerMenu');
  dom.sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  dom.sidebar = document.getElementById('sidebar');
  dom.pwaInstallBtn = document.getElementById('pwaInstallBtn');
  dom.logoReloadBtn = document.getElementById('logoReloadBtn');
  dom.titleReloadBtn = document.getElementById('titleReloadBtn');
}

function applyInitialTheme() {
  const savedTheme = Storage.getThemeMode();
  state.set('themeMode', savedTheme);
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && import.meta.env?.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('SW Registration failed:', err);
      });
    });
  }
}

function bindEvents() {
  // Logo / Title click: reload app (moved from inline onclick to keep CSP script-src free of 'unsafe-inline')
  const reloadHandler = () => window.location.reload();
  dom.logoReloadBtn?.addEventListener('click', reloadHandler);
  dom.titleReloadBtn?.addEventListener('click', reloadHandler);

  // Search Autocomplete & Action
  const handleAutocomplete = debounce(async (query) => {
    if (!query || query.trim().length < 2) {
      dom.searchSuggestions.classList.add('hidden');
      return;
    }

    try {
      const results = await searchLocation(query);
      if (results.length === 0) {
        dom.searchSuggestions.classList.add('hidden');
        return;
      }

      dom.searchSuggestions.innerHTML = results.map(item => `
        <button data-lat="${item.lat}" data-lng="${item.lng}" data-name="${escapeHtml(item.shortName)}" data-city="${escapeHtml(item.cityName)}" class="suggestion-item w-full text-left px-4 py-2.5 hover:bg-teal-50 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-none text-xs font-medium">
          <i class="fa-solid fa-location-dot text-teal-600 dark:text-teal-400"></i>
          <span class="truncate text-slate-800 dark:text-slate-200">${escapeHtml(item.name)}</span>
        </button>
      `).join('');

      dom.searchSuggestions.classList.remove('hidden');

      // Click on suggestion
      dom.searchSuggestions.querySelectorAll('.suggestion-item').forEach(btn => {
        btn.onclick = () => {
          const lat = parseFloat(btn.dataset.lat);
          const lng = parseFloat(btn.dataset.lng);
          const name = btn.dataset.name;
          const cityName = btn.dataset.city || name;

          dom.searchInput.value = name;
          dom.searchSuggestions.classList.add('hidden');

          state.set('searchQuery', name);
          state.set('currentRegionName', cityName);
          state.set('userLocation', { lat, lng });
          state.set('isRealUserLocation', false);
          updateUserMarker(lat, lng);
          centerMap(lat, lng, 14);
          loadPoisForLocation(lat, lng);
          showToast(`"${name}" konumuna gidildi.`, 'success');
        };
      });
    } catch (err) {
      dom.searchSuggestions.classList.add('hidden');
    }
  }, 350);

  dom.searchInput.addEventListener('input', (e) => handleAutocomplete(e.target.value));

  dom.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = dom.searchInput.value.trim();
      if (val) {
        dom.searchSuggestions.classList.add('hidden');
        Storage.addSearchHistory(val);
        state.set('searchQuery', val);
        state.set('currentRegionName', val);
        handleAutocomplete(val);
      }
    }
  });

  // Close search suggestions on click outside
  document.addEventListener('click', (e) => {
    if (dom.searchInput && dom.searchSuggestions && !dom.searchInput.contains(e.target) && !dom.searchSuggestions.contains(e.target)) {
      dom.searchSuggestions.classList.add('hidden');
    }
  });

  // Locate Me Button
  dom.locateBtn.addEventListener('click', () => {
    getUserGeolocation();
  });

  // Radius Slider
  dom.radiusSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    dom.radiusValue.textContent = val;
    state.set('radius', val);
  });

  dom.radiusSlider.addEventListener('change', () => {
    loadPoisForLocation(state.userLocation.lat, state.userLocation.lng);
  });

  // Render Category Pills
  renderCategoryPills();

  // Theme Toggle (Light / Dark)
  dom.themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    const newMode = isDark ? 'dark' : 'light';
    Storage.setThemeMode(newMode);
    state.set('themeMode', newMode);
    showToast(isDark ? 'Karanlık Mod aktif.' : 'Aydınlık Mod aktif.', 'info');
  });

  // Layer Switcher Menu Toggle
  dom.layerToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.layerMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    if (dom.layerMenu) dom.layerMenu.classList.add('hidden');
  });

  dom.layerMenu.querySelectorAll('[data-tile]').forEach(btn => {
    btn.onclick = () => {
      const tileKey = btn.dataset.tile;
      switchMapTile(tileKey);
      showToast(`Harita görünümü: ${tileKey.toUpperCase()}`, 'info');
    };
  });

  // Sidebar Toggle (Mobile Drawer)
  dom.sidebarToggleBtn.addEventListener('click', () => {
    dom.sidebar.classList.toggle('translate-x-full');
  });

  // Handle map resizing on window resize / mobile orientation change
  window.addEventListener('resize', debounce(() => resizeMap(), 150));
  window.addEventListener('orientationchange', () => {
    setTimeout(resizeMap, 250);
  });

  // PWA Deferred Prompt Handler
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (dom.pwaInstallBtn) {
      dom.pwaInstallBtn.classList.remove('hidden');
      dom.pwaInstallBtn.onclick = () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => {
          deferredPrompt = null;
          dom.pwaInstallBtn.classList.add('hidden');
        });
      };
    }
  });
}

function renderCategoryPills() {
  if (!dom.categoryContainer) return;

  dom.categoryContainer.innerHTML = Object.values(CATEGORIES).map(cat => `
    <button data-category="${cat.id}" class="category-pill flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${state.category === cat.id ? 'bg-teal-600 text-white shadow-md scale-105' : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'}">
      <i class="fa-solid ${cat.icon}"></i>
      <span>${cat.name}</span>
    </button>
  `).join('');

  dom.categoryContainer.querySelectorAll('.category-pill').forEach(btn => {
    btn.onclick = () => {
      const categoryId = btn.dataset.category;
      state.set('category', categoryId);
      renderCategoryPills();
      loadPoisForLocation(state.userLocation.lat, state.userLocation.lng);
    };
  });
}

function getUserGeolocation() {
  if (!navigator.geolocation) {
    showToast('Tarayıcınız konum servisini desteklemiyor.', 'error');
    loadPoisForLocation(state.userLocation.lat, state.userLocation.lng);
    return;
  }

  showToast('Konumunuz belirleniyor...', 'info');

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      state.set('userLocation', { lat: latitude, lng: longitude });
      state.set('isRealUserLocation', true);

      // Detect region name from GPS coords
      const regionName = await getRegionFromCoords(latitude, longitude);
      if (regionName) {
        state.set('currentRegionName', regionName);
      }

      updateUserMarker(latitude, longitude);
      centerMap(latitude, longitude, 15);
      loadPoisForLocation(latitude, longitude);
      showToast('Mevcut konumunuz yüklendi.', 'success');
    },
    (err) => {
      showToast('Konum izni verilemedi. Varsayılan konum (İstanbul) gösteriliyor.', 'warning');
      loadPoisForLocation(state.userLocation.lat, state.userLocation.lng);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function loadPoisForLocation(lat, lng) {
  state.set('isLoading', true);
  try {
    // Determine region if not yet set
    if (!state.currentRegionName) {
      const region = await getRegionFromCoords(lat, lng);
      if (region) state.set('currentRegionName', region);
    }

    const pois = await fetchPOIs({
      lat,
      lng,
      radius: state.radius,
      category: state.category
    });

    state.set('pois', pois);
    renderPoiMarkers(pois);
    showToast(`${pois.length} adet tarihi yer bulundu.`, 'success');
  } catch (err) {
    if (err.name !== 'AbortError') {
      showToast('Mekan verileri çekilirken bir sorun oluştu.', 'error');
    }
  } finally {
    state.set('isLoading', false);
  }
}
