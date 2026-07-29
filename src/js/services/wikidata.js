/**
 * Wikidata SPARQL & Entity REST Service for verified historical knowledge
 */

const wikidataCache = new Map();

/**
 * Fetch structured Wikidata entity details by ID (e.g. "Q12808544")
 */
export async function getWikidataDetails(wikidataId) {
  if (!wikidataId || !wikidataId.startsWith('Q')) return null;

  if (wikidataCache.has(wikidataId)) {
    return wikidataCache.get(wikidataId);
  }

  try {
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(wikidataId)}.json`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const entity = data.entities?.[wikidataId];
    if (!entity) return null;

    const claims = entity.claims || {};
    const labels = entity.labels || {};
    const descriptions = entity.descriptions || {};

    // Extract Turkish or English label & description
    const label = labels.tr?.value || labels.en?.value || '';
    const description = descriptions.tr?.value || descriptions.en?.value || '';

    // Extract Image (Property P18)
    let imageUrl = '';
    const imageClaim = claims.P18?.[0];
    if (imageClaim && imageClaim.mainsnak?.datavalue?.value) {
      const fileName = imageClaim.mainsnak.datavalue.value;
      imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=800`;
    }

    // Extract Inception / Construction Date (Property P571 or P580)
    let inception = '';
    const inceptionClaim = claims.P571?.[0] || claims.P580?.[0];
    if (inceptionClaim && inceptionClaim.mainsnak?.datavalue?.value?.time) {
      const timeStr = inceptionClaim.mainsnak.datavalue.value.time;
      const year = parseInt(timeStr.replace(/^[+-]/, '').split('-')[0]);
      if (timeStr.startsWith('-')) {
        inception = `M.Ö. ${year}`;
      } else {
        inception = `${year}`;
      }
    }

    // Extract Architect (Property P84)
    let architect = '';
    const architectClaim = claims.P84?.[0];
    if (architectClaim && architectClaim.mainsnak?.datavalue?.value?.id) {
      architect = architectClaim.mainsnak.datavalue.value.id;
    }

    // Extract Culture / Civilization (Property P2596 or P1700)
    let civilization = '';
    if (description.toLowerCase().includes('likya') || label.toLowerCase().includes('likya')) civilization = 'Likya Uygarlığı';
    else if (description.toLowerCase().includes('roma') || label.toLowerCase().includes('roma')) civilization = 'Roma İmparatorluğu';
    else if (description.toLowerCase().includes('bizans') || label.toLowerCase().includes('bizans')) civilization = 'Bizans Dönemi';
    else if (description.toLowerCase().includes('osmanlı') || label.toLowerCase().includes('osmanlı')) civilization = 'Osmanlı İmparatorluğu';
    else if (description.toLowerCase().includes('selçuklu') || label.toLowerCase().includes('selçuklu')) civilization = 'Selçuklu Dönemi';
    else if (description.toLowerCase().includes('antik yunan') || label.toLowerCase().includes('yunan')) civilization = 'Antik Yunan';

    const result = {
      id: wikidataId,
      label,
      description,
      imageUrl,
      inception,
      architect,
      civilization
    };

    wikidataCache.set(wikidataId, result);
    return result;
  } catch (err) {
    console.warn('Wikidata fetch warning:', err);
    return null;
  }
}
