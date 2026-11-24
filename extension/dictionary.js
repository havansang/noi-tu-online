const initial = '(?:b|c|ch|d|đ|g|gh|gi|h|k|kh|l|m|n|ng|ngh|nh|p|ph|qu|r|s|t|th|tr|v|x)?';
const vowels = '(?:a|ai|ao|au|ay|e|eo|eu|i|ia|ie|ieu|iu|o|oa|oai|oao|oay|oe|oeo|oi|oo|u|ua|uai|uao|uay|ue|ueu|ui|uo|uoi|uou|uu|uy|uya|uye|uyu|y|ya|ye|yeu)';
const final = '(?:c|ch|m|n|ng|nh|p|t)?';
const syllablePattern = new RegExp(`^${initial}${vowels}${final}$`, 'u');

function normalize(value) {
  return value.normalize('NFC').trim().toLocaleLowerCase('vi').replace(/\s+/gu, ' ');
}

export function isCompound(word) {
  const syllables = word.split(' ');
  return syllables.length === 2 && syllables.every((syllable) => {
    const base = syllable.normalize('NFD').replace(/[\u0300\u0301\u0302\u0303\u0306\u0309\u031B\u0323]/gu, '');
    return syllablePattern.test(base);
  });
}

export function buildIndex(text) {
  const index = new Map();
  const words = new Set(text.split(/\r?\n/u).map(normalize));

  for (const word of words) {
    if (!isCompound(word)) continue;
    const first = word.slice(0, word.indexOf(' '));
    if (!index.has(first)) index.set(first, []);
    index.get(first).push(word);
  }

  return index;
}
