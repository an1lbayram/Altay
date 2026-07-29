import { state } from '../state.js';
import { CATEGORIES, formatDistance, escapeHtml } from '../utils/helpers.js';
import { centerMap } from './map.js';
import { openPoiModal } from './modal.js';
import { Storage } from '../services/storage.js';

let sidebarContainer = null;
let currentTab = 'list'; // 'list' | 'favorites'

export function renderSidebar() {
  sidebarContainer = document.getElementById('sidebar-content');
  if (!sidebarContainer) return;

  sidebarContainer.innerHTML = `
    <!-- Tabs Header -->
    <div class="flex items-center gap-1 p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-2xl mb-4">
      <button id="tab-btn-list" class="flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${currentTab === 'list' ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}">
        <i class="fa-solid fa-list-ul"></i> Yakındaki Yerler (<span id="pois-count">${state.pois.length}</span>)
      </button>
      <button id="tab-btn-fav" class="flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${currentTab === 'favorites' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}">
        <i class="fa-solid fa-bookmark text-amber-500"></i> Favorilerim (<span id="favs-count">${Storage.getFavorites().length}</span>)
      </button>
    </div>

    <!-- Tab Content -->
    <div id="sidebar-tab-content" class="space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
      ${renderTabBody()}
    </div>
  `;

  // Bind Tab Click Handlers
  const tabListBtn = document.getElementById('tab-btn-list');
  const tabFavBtn = document.getElementById('tab-btn-fav');

  if (tabListBtn) {
    tabListBtn.onclick = () => {
      currentTab = 'list';
      renderSidebar();
    };
  }

  if (tabFavBtn) {
    tabFavBtn.onclick = () => {
      currentTab = 'favorites';
      renderSidebar();
    };
  }

  bindPoiItemEvents();
}

function renderTabBody() {
  if (currentTab === 'favorites') {
    const favorites = Storage.getFavorites();
    if (favorites.length === 0) {
      return `
        <div class="text-center py-12 px-4">
          <div class="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3 text-2xl">
            <i class="fa-regular fa-bookmark"></i>
          </div>
          <h4 class="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1">Henüz Favori Eklenmedi</h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">Tarihi mekanların detay kartındaki kaydet butonuna basarak favorilerinize ekleyebilirsiniz.</p>
        </div>
      `;
    }
    return favorites.map(poi => renderPoiCardHtml(poi, true)).join('');
  }

  // 'list' tab
  if (state.isLoading) {
    return Array(4).fill(0).map(() => `
      <div class="p-4 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 animate-pulse space-y-3">
        <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
        <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
      </div>
    `).join('');
  }

  if (state.pois.length === 0) {
    return `
      <div class="text-center py-12 px-4">
        <div class="w-16 h-16 rounded-full bg-teal-100 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-3 text-2xl">
          <i class="fa-solid fa-map-location-dot"></i>
        </div>
        <h4 class="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1">Tarihi Yer Bulunamadı</h4>
        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">Seçilen tarama yarıçapı veya kategoride kayıtlı yer bulunamadı. Yarıçapı artırmayı deneyin.</p>
      </div>
    `;
  }

  return state.pois.map(poi => renderPoiCardHtml(poi, false)).join('');
}

function renderPoiCardHtml(poi, isFavoriteItem = false) {
  const categoryInfo = CATEGORIES[poi.category] || CATEGORIES.historic;
  const isFav = Storage.isFavorite(poi.id);

  return `
    <div data-id="${poi.id}" class="poi-card group p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 hover:bg-teal-50/50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer flex items-start gap-3">
      <div class="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform mt-0.5">
        <i class="fa-solid ${categoryInfo.icon} text-lg"></i>
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-1 mb-1">
          <span class="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
            ${escapeHtml(poi.category)}
          </span>
          ${poi.distance !== undefined ? `<span class="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1"><i class="fa-solid fa-location-arrow text-[9px]"></i> ${formatDistance(poi.distance)}</span>` : ''}
        </div>

        <h4 class="font-bold text-xs text-slate-900 dark:text-slate-100 truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
          ${escapeHtml(poi.name)}
        </h4>

        <div class="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/50">
          <button data-action="center" data-id="${poi.id}" class="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
            <i class="fa-solid fa-location-dot"></i> Haritada Göster
          </button>
          <button data-action="detail" data-id="${poi.id}" class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1">
            <i class="fa-solid fa-circle-info"></i> Detay <i class="fa-solid fa-chevron-right text-[9px]"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

function bindPoiItemEvents() {
  const cards = sidebarContainer.querySelectorAll('.poi-card');
  cards.forEach(card => {
    const id = card.dataset.id;
    const poi = state.pois.find(p => p.id === id) || Storage.getFavorites().find(p => p.id === id);
    if (!poi) return;

    const centerBtn = card.querySelector('[data-action="center"]');
    const detailBtn = card.querySelector('[data-action="detail"]');

    if (centerBtn) {
      centerBtn.onclick = (e) => {
        e.stopPropagation();
        centerMap(poi.lat, poi.lng, 16);
      };
    }

    if (detailBtn) {
      detailBtn.onclick = (e) => {
        e.stopPropagation();
        openPoiModal(poi);
      };
    }

    card.onclick = () => {
      centerMap(poi.lat, poi.lng, 16);
      openPoiModal(poi);
    };
  });
}
