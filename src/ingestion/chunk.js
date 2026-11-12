// Token estimation: ~4 characters per token (typical for English). This is a rough heuristic;
// real tokenizers differ by language and content, so chunk sizes are approximate.
export const CHARS_PER_TOKEN = 4;
export const estimateTokens = (text) => Math.ceil(text.length / CHARS_PER_TOKEN);

function hardSplit(str, max) {
  const out = [];
  let rest = str.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max);
    if (cut < max * 0.5) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

// Splits text into units no longer than maxUnit: paragraphs first, then sentences, then words.
function toUnits(text, maxUnit) {
  const units = [];
  for (const para of text.split(/\n{2,}/)) {
    const p = para.trim();
    if (!p) continue;
    const pieces =
      p.length <= maxUnit
        ? [p]
        : (p.match(/[^.!?]+[.!?]*|[.!?]+/g) ?? [p])
            .map((s) => s.trim())
            .filter(Boolean)
            .flatMap((s) => (s.length > maxUnit ? hardSplit(s, maxUnit) : [s]));
    pieces.forEach((piece, i) => units.push({ text: piece, sep: i === 0 ? '\n\n' : ' ' }));
  }
  return units;
}

// Last `n` characters of text, moved forward to a word boundary so we never start mid-word.
function overlapTail(text, n) {
  if (n <= 0) return '';
  let tail = text.slice(-n);
  const startsMidWord = !/\s/.test(text.charAt(text.length - n - 1) || ' ');
  const firstSpace = tail.search(/\s/);
  if (startsMidWord && firstSpace > 0) tail = tail.slice(firstSpace);
  return tail.trim();
}

/**
 * Splits cleaned text into overlapping chunks. chunkSize and overlap are in estimated tokens.
 * Paragraph boundaries are preferred; each new chunk starts with the tail of the previous one.
 */
export function chunkText(text, { chunkSize = 800, overlap = 150 } = {}) {
  if (!(chunkSize > 0) || overlap < 0 || overlap >= chunkSize) {
    throw new Error('chunkSize must be > 0 and overlap must be >= 0 and < chunkSize');
  }
  const maxChars = chunkSize * CHARS_PER_TOKEN;
  const overlapChars = overlap * CHARS_PER_TOKEN;
  const units = toUnits(text, Math.max(1, maxChars - overlapChars - 2));

  const chunks = [];
  let current = '';
  for (const u of units) {
    const candidate = current ? current + u.sep + u.text : u.text;
    if (current && candidate.length > maxChars) {
      chunks.push(current.trim());
      const tail = overlapTail(current, overlapChars);
      current = tail ? tail + u.sep + u.text : u.text;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.map((content, index) => ({
    index,
    content,
    metadata: { tokenEstimate: estimateTokens(content), charCount: content.length },
  }));
}
