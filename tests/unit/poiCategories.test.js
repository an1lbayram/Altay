import { describe, it, expect } from 'vitest';
import { matchesCategory, overpassFilter } from '../../src/js/services/poiCategories.js';

describe('matchesCategory (Overpass filtreleriyle ayni secim)', () => {
  it('all: historic anahtari olan her sey + muze + turistik yer', () => {
    expect(matchesCategory({ historic: 'tomb' }, 'all')).toBe(true);
    expect(matchesCategory({ historic: '' }, 'all')).toBe(true); // Overpass ["historic"] = anahtar var
    expect(matchesCategory({ tourism: 'museum' }, 'all')).toBe(true);
    expect(matchesCategory({ tourism: 'attraction' }, 'all')).toBe(true);
    expect(matchesCategory({ amenity: 'place_of_worship' }, 'all')).toBe(false);
    expect(matchesCategory({ tourism: 'hotel' }, 'all')).toBe(false);
  });

  it('castle/ancient/religion desenleri Overpass ~ gibi capasiz alt dize eslesir', () => {
    expect(matchesCategory({ historic: 'castle' }, 'castle')).toBe(true);
    expect(matchesCategory({ historic: 'watchtower' }, 'castle')).toBe(true);
    expect(matchesCategory({ historic: 'Castle' }, 'castle')).toBe(false); // buyuk/kucuk harf duyarli
    expect(matchesCategory({ historic: 'rock_cut_tomb' }, 'ancient')).toBe(true);
    expect(matchesCategory({ historic: 'archaeological_site' }, 'ancient')).toBe(true);
    expect(matchesCategory({ historic: 'monument' }, 'ancient')).toBe(false);
    expect(matchesCategory({ historic: 'mosque' }, 'religion')).toBe(true);
    expect(matchesCategory({ amenity: 'place_of_worship' }, 'religion')).toBe(true);
    expect(matchesCategory({ tourism: 'museum' }, 'castle')).toBe(false);
  });

  it('museum ve monument', () => {
    expect(matchesCategory({ tourism: 'museum' }, 'museum')).toBe(true);
    expect(matchesCategory({ historic: 'museum' }, 'museum')).toBe(false);
    expect(matchesCategory({ historic: 'monument' }, 'monument')).toBe(true);
    expect(matchesCategory({ historic: 'memorial', wikipedia: 'tr:X' }, 'monument')).toBe(true);
    expect(matchesCategory({ historic: 'memorial' }, 'monument')).toBe(false);
  });
});

describe('overpassFilter', () => {
  it('kategori desenlerini ve around ifadesini sorguya koyar', () => {
    const around = 'around:5000,41,29';
    expect(overpassFilter('castle', around)).toBe('nwr["historic"~"castle|fort|citywalls|fortress|tower"](around:5000,41,29);');
    expect(overpassFilter('religion', around)).toContain('nwr["amenity"="place_of_worship"](around:5000,41,29);');
    expect(overpassFilter('all', around)).toContain('nwr["tourism"="attraction"](around:5000,41,29);');
  });
});
