// Layer 1 of prompt-injection defence: cheap heuristics. They catch obvious attacks and
// feed risk flags into the prompt, but they are NOT the main defence. The main defences are
// the trusted/untrusted prompt separation, retrieval threshold and output validation.
// Paraphrased or non-English attacks can slip past any keyword list.

const normalize = (s) =>
  String(s)
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');

const RULES = [
  {
    id: 'override_instructions',
    weight: 3,
    re: /\b(ignore|disregard|forget|override|bypass)\b.{0,40}\b(all|any|previous|prior|above|earlier|your|the|system)\b.{0,30}\b(instructions?|rules?|prompts?|guidelines?|context)\b/,
  },
  {
    id: 'reveal_prompt',
    weight: 3,
    re: /\b(reveal|show|print|repeat|output|leak|display|tell me)\b.{0,40}\b(system|hidden|initial|original|secret)\b.{0,15}\b(prompt|instructions?|message)\b/,
  },
  {
    id: 'reveal_secrets',
    weight: 3,
    re: /\b(reveal|show|print|give|tell|leak|dump|expose|what is|what's)\b.{0,40}(api[\s_-]?keys?|environment variables?|env vars?|\.env\b|credentials|connection string|database_url|gemini_api_key)/,
  },
  {
    id: 'persona_override',
    weight: 3,
    re: /\b(act as|pretend to be|you are now|roleplay as|from now on you)\b.{0,50}\b(unrestricted|unfiltered|jailbroken|dan|no restrictions|without (any )?(rules|restrictions|limits))/,
  },
  { id: 'jailbreak_terms', weight: 3, re: /\b(jailbreak|developer mode|dan mode|do anything now)\b/ },
  {
    id: 'ignore_documents',
    weight: 2,
    re: /\b(ignore|disregard|don'?t use)\b.{0,30}\b(documents?|context|knowledge base|retrieved)\b/,
  },
];

/** @returns {{ level: 'none'|'medium'|'high', score: number, reasons: string[] }} */
export function assessInputRisk(text) {
  const t = normalize(text);
  const hits = RULES.filter((r) => r.re.test(t));
  const score = hits.reduce((sum, r) => sum + r.weight, 0);
  return {
    level: score >= 3 ? 'high' : score > 0 ? 'medium' : 'none',
    score,
    reasons: hits.map((r) => r.id),
  };
}

export const INJECTION_REFUSAL =
  "I can't help with that request. I can only answer questions about the content of your uploaded documents, and I can't change my instructions or share internal configuration.";
