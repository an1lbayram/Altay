# 🗺️ HistoriaMap - Interaktif Tarih & Kültürel Miras Harita Uygulaması

**HistoriaMap**, çevrenizdeki ve dünya genelindeki tarihi eserleri, antik kentleri, müzeleri, kale & surları ve anıtları interaktif harita üzerinde keşfetmenizi sağlayan modern, yüksek performanslı bir Web & PWA uygulamasıdır.

![HistoriaMap](public/favicon.svg)

---

## ✨ Özellikler

- 📍 **Otomatik & Canlı Konum Tespiti**: Cihazınızın GPS'ini kullanarak yakınınızdaki tarihi mekanları anında listeler.
- 🔍 **Arama & Otomatik Tamamlama**: Şehir, ilçe veya mekan ismi ile hızlı arama (Nominatim Geocoding API).
- 🏷️ **Kategori Filtreleme**: Tarihi Eser, Müze, Kale & Sur, Antik Kent, İbadethane ve Anıt kategorilerine göre anlık filtreleme.
- 🎯 **Dinamik Tarama Yarıçapı Slider'ı**: 1 km ile 50 km arasında istediğiniz alanı tarayın.
- 📍 **Marker Cluster (Kümeleme)**: Yüzlerce mekanı haritada kasmadan, akıcı şekilde gösterir.
- 🎨 **Özel SVG Harita İkonları**: Kategori bazlı renkli ve ikonlu özel harita pinleri.
- 🗺️ **Katman Değiştirici (Tile Switcher)**: Standart Sokak Haritası, Esri Uydu Görüntüsü ve Gece Modu (Dark Map).
- 📖 **Wikipedia & Overpass API Entegrasyonu**: Detaylı tarihi açıklamalar, fotoğraflar ve Wikipedia makale bağlantıları.
- 🔊 **Sesli Rehber (Text-to-Speech)**: Türkçe yapay zeka sesli anlatım ile mekan bilgilerini dinleyin.
- 🔖 **Favoriler (Bookmarks)**: Beğendiğiniz tarihi mekanları kaydedin ve istediğiniz zaman kolayca erişin (LocalStorage).
- 🌙 **Karanlık / Aydınlık Mod**: Göz yormayan modern Glassmorphism tasarım ve tema desteği.
- 📱 **PWA & Mobil Uyumlu**: Masaüstü, tablet ve mobil cihazlarda uygulama gibi çalışır (Offline Servis Worker & Manifest).
- 🗺️ **Google Maps Yol Tarifi**: Tek tıkla haritada seçilen mekana yol tarifi alma.

---

## 🛠️ Kullanılan Teknolojiler

- **Core**: HTML5, Modern ES Modules (JavaScript)
- **Bundler**: [Vite 8](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & Glassmorphism UI
- **Maps**: [Leaflet.js](https://leafletjs.com/) & [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster)
- **Data APIs**: OpenStreetMap Overpass API, Nominatim Geocoding API, Wikipedia REST API
- **PWA**: Web App Manifest & Service Worker
- **Icons**: FontAwesome 6 Free

---

## 🚀 Yerel Geliştirme

```bash
# 1. Depoyu klonlayın
git clone https://github.com/KULLANICI_ADI/HistoriaMap.git
cd HistoriaMap

# 2. Bağımlılıkları yükleyin
npm install

# 3. Geliştirici sunucusunu başlatın
npm run dev
```

---

## 📦 Üretim Derlemesi (Production Build)

```bash
npm run build
```
Derlenen dosyalar `dist/` klasörüne çıktı olarak verilir.

---

## 🌐 Vercel Deployment Guide

1. Projeyi GitHub'a push edin.
2. [Vercel Dashboard](https://vercel.com/dashboard) üzerine gidin.
3. **New Project** butonuna basın ve `HistoriaMap` reposunu seçin.
4. Framework Preset: **Vite**
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. **Deploy** butonuna tıklayın! `vercel.json` yapılandırması otomatik olarak Vercel tarafından algılanacaktır.

---

## 📄 Lisans

MIT License © 2026 HistoriaMap
