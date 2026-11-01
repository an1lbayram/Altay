/**
 * Kategori tanimlari - tek kaynak.
 *
 * Ayni kurallar iki yerde uygulaniyor: Overpass sorgusunda (sunucu filtreler) ve Turkiye icin
 * onceden hazirlanmis veride (istemci filtreler, poiStatic.js). Ikisi ayrismasin diye desenler
 * burada duruyor. Overpass'taki `~` buyuk/kucuk harf duyarli ve capasiz (alt dize) eslesir;
 * RegExp karsiliklari da oyle.
 */
const PATTERNS = {
  castle: 'castle|fort|citywalls|fortress|tower',
  ancient: 'archaeological_site|ruins|tomb|rock_cut_tomb|aqueduct|amphitheatre',
  religion: 'church|mosque|monastery|synagogue',
};

const REGEX = Object.fromEntries(Object.entries(PATTERNS).map(([k, v]) => [k, new RegExp(v)]));

/**
 * Overpass QL filtre ifadeleri. `around` ornegin "around:5000,41.0,28.9".
 */
export function overpassFilter(category, around) {
  switch (category) {
    case 'museum':
      return `nwr["tourism"="museum"](${around});`;
    case 'castle':
      return `nwr["historic"~"${PATTERNS.castle}"](${around});`;
    case 'ancient':
      return `nwr["historic"~"${PATTERNS.ancient}"](${around});`;
    case 'religion':
      return `nwr["amenity"="place_of_worship"](${around}); nwr["historic"~"${PATTERNS.religion}"](${around});`;
    case 'monument':
      return `nwr["historic"="monument"](${around}); nwr["historic"="memorial"]["wikipedia"](${around});`;
    default:
      // 'all' veya 'historic'
      return `
        nwr["historic"](${around});
        nwr["tourism"="museum"](${around});
        nwr["tourism"="attraction"](${around});
      `;
  }
}

/**
 * overpassFilter ile birebir ayni secimi etiketler uzerinden yapar.
 */
export function matchesCategory(tags, category) {
  const historic = tags.historic;
  const hasHistoric = historic !== undefined;
  switch (category) {
    case 'museum':
      return tags.tourism === 'museum';
    case 'castle':
      return hasHistoric && REGEX.castle.test(historic);
    case 'ancient':
      return hasHistoric && REGEX.ancient.test(historic);
    case 'religion':
      return tags.amenity === 'place_of_worship' || (hasHistoric && REGEX.religion.test(historic));
    case 'monument':
      return historic === 'monument' || (historic === 'memorial' && tags.wikipedia !== undefined);
    default:
      return hasHistoric || tags.tourism === 'museum' || tags.tourism === 'attraction';
  }
}
