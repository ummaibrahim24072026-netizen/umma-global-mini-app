/* Repair typesetting only: retain lexical hyphens, punctuation and paragraphs. */
const lexicalHyphens = new Set([
 'какое-то','кому-нибудь','во-вторых','во-первых','что-либо','такого-то',
 'кто-либо','по-доброму','кому-либо','кто-нибудь','какой-то','чью-либо',
 'чего-нибудь','в-третьих','из-за','аль-кура','зуль-карнейна','зуль-карнейну','ас-саламу'
]);
// These unspaced line-break artifacts were individually reviewed in the corpus.
const brokenWords = new Map([
 'по-ступает','по-коритесь','кото-рые','повеле-ния','оказан-ной','жили-щах',
 'ва-ми','явля-ется','па-губные'
].map(word => [word, word.replaceAll('-', '')]));
export function normalizeRussianText(text) {
 let result = text.replaceAll('\u00ad', '');
 const wrap = /([А-Яа-яЁё]+)-\s+([А-Яа-яЁё]+)/gu;
 let previous;
 do {
  previous = result;
  result = result.replace(wrap, (match, left, right) =>
   left === 'Я' && right === 'Аллах' ? match : left + (lexicalHyphens.has(`${left}-${right}`.toLowerCase()) ? '-' : '') + right);
 } while (result !== previous);
 return result.replace(/[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)+/gu,
  word => brokenWords.get(word) || word);
}
