import {readFileSync, writeFileSync} from 'node:fs';
import {normalizeRussianText} from './quran-russian-text.mjs';
let changedBlocks = 0, removedHyphens = 0, changedFiles = 0;
for (let surah = 1; surah <= 114; surah++) {
 for (const tafsir of [false, true]) {
  const path = `assets/quran/${tafsir ? 'tafsir/' : ''}${surah}.json`;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  let changed = false;
  for (const entry of tafsir ? data.blocks : data.verses) {
   const key = tafsir ? 'text' : 'translation', original = entry[key];
   entry[key] = normalizeRussianText(original);
   if (entry[key] !== original) {
    changed = true; changedBlocks++;
    removedHyphens += original.split('-').length - entry[key].split('-').length;
   }
  }
  if (changed) {writeFileSync(path, JSON.stringify(data)); changedFiles++;}
 }
}
console.log({changedFiles, changedBlocks, removedHyphens});
