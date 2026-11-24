import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildIndex, isCompound } from '../extension/dictionary.js';

const source = fileURLToPath(new URL('../dictionary-source/', import.meta.url));
const target = fileURLToPath(new URL('../extension/data/', import.meta.url));
const read = (name) => readFile(join(source, name), 'utf8');

const [vntk, viet74k, blocked, existing, preferred] = await Promise.all([
  read('vntk-dictionary.json'),
  read('Viet74K.txt'),
  read('tu_cam.txt'),
  readFile(join(target, 'nguoi_choi.txt'), 'utf8'),
  readFile(join(target, 'von_tu_may.txt'), 'utf8'),
]);

const normalize = (value) => value.normalize('NFC').trim().replace(/\s+/gu, ' ');
const lines = (value) => value.split(/\r?\n/u);
const blockedWords = new Set(lines(blocked).map((word) => normalize(word).toLocaleLowerCase('vi')));
function extractCompounds(entries) {
  const words = new Set();
  for (const entry of entries) {
    const word = normalize(entry);
    if (word !== word.toLocaleLowerCase('vi') || blockedWords.has(word)) continue;
    if (isCompound(word)) words.add(word);
  }
  return [...words].sort();
}

const headwords = Object.keys(JSON.parse(vntk));
const extractedVntk = extractCompounds(headwords);
const extractedViet74k = extractCompounds(lines(viet74k));
if (!extractedVntk.length || !extractedViet74k.length) throw new Error('Không trích được mục từ từ dữ liệu nguồn.');

await Promise.all([
  writeFile(join(target, 'vntk-tu-ghep.txt'), `${extractedVntk.join('\n')}\n`),
  writeFile(join(target, 'viet74k-tu-ghep.txt'), `${extractedViet74k.join('\n')}\n`),
  copyFile(join(source, 'VNTK-LICENSE.txt'), join(target, 'VNTK-LICENSE.txt')),
  copyFile(join(source, 'VIET74K-LICENSE.txt'), join(target, 'VIET74K-LICENSE.txt')),
]);

const original = buildIndex([existing, preferred].join('\n'));
const combined = buildIndex([existing, preferred, ...extractedVntk, ...extractedViet74k].join('\n'));
const count = (index) => [...index.values()].reduce((size, words) => size + words.length, 0);
console.log(`VNTK: ${headwords.length} mục gốc, ${extractedVntk.length} cụm hai tiếng.`);
console.log(`Viet74K: ${lines(viet74k).filter(Boolean).length} dòng gốc, ${extractedViet74k.length} cụm hai tiếng.`);
console.log(`Dùng trong game: ${count(combined)} cụm, bổ sung ${count(combined) - count(original)} cụm từ hai nguồn mới.`);
