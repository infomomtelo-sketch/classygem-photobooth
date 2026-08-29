export type BlockCategory = 'explicit' | 'minor' | 'named_person';

export interface BlocklistHit {
  category: BlockCategory;
  pattern: string;
}

export interface DynamicTerm {
  category: BlockCategory;
  pattern: string;
  matchType: 'literal' | 'regex';
}

export interface CheckResult {
  blocked: boolean;
  hits: BlocklistHit[];
}

// Baseline, hard-coded guardrail terms -- always active regardless of
// what's in the dmemz `blocklist_terms` table. Extend coverage via
// that table rather than editing this list for one-off additions.
const EXPLICIT_PATTERNS: RegExp[] = [
  /\bnud(e|ity|es)\b/i,
  /\bnaked\b/i,
  /\bnsfw\b/i,
  /\bporn(o|ographic|ography)?\b/i,
  /\bxxx\b/i,
  /\bhentai\b/i,
  /\berotic(a)?\b/i,
  /\bfetish\b/i,
  /\borgasm\b/i,
  /\bgenital(s)?\b/i,
  /\btopless\b/i,
  /\bnipple(s)?\b/i,
  /\bsexual(ly)?\b/i,
  /\bintercourse\b/i,
  /\bmasturbat/i,
  /\bexplicit\s+(sex|sexual|content)\b/i,
  /\bsex(ual)?\s+(act|scene|position)\b/i,
  /\bstrip(ping|tease)?\b/i,
  /\blingerie\s+(off|removed|see[\s-]?through)\b/i,
];

const MINOR_PATTERNS: RegExp[] = [
  /\bchild(ren)?\b/i,
  /\bkid(s)?\b/i,
  /\btoddler(s)?\b/i,
  /\binfant(s)?\b/i,
  /\bminor(s)?\b/i,
  /\bunderage\b/i,
  /\bteen(age|ager|s)?\b/i,
  /\bloli\b/i,
  /\bshota\b/i,
  /\bschoolgirl\b/i,
  /\bpreteen\b/i,
  /\b(?:[1-9]|1[0-7])\s*(?:yo|y\/o|years?[\s-]?old)\b/i,
  /\b(?:elementary|middle)\s+school\b/i,
];

// Not a hard, curated list -- the surface area of "every real person"
// is too large for a static enumeration, and a name list authored by
// this codebase would be both incomplete and an odd thing to ship.
// Instead this flags any name-shaped phrase (two or three capitalized
// words) in free text so it's blocked and logged for review. It will
// over-match brand/place names on purpose: the spec treats this
// guardrail as non-negotiable, so the default is to block and let the
// user rephrase rather than risk a real person's likeness through.
// Only genuinely free-text fields are checked -- preset labels and
// structured option values never reach checkPrompt.
const NAMED_PERSON_PATTERN = /\b[A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+){1,2}\b/;

export function checkPrompt(text: string, dynamicTerms: DynamicTerm[] = []): CheckResult {
  const hits: BlocklistHit[] = [];
  const normalized = normalize(text);

  for (const re of EXPLICIT_PATTERNS) {
    if (re.test(normalized)) hits.push({ category: 'explicit', pattern: re.source });
  }
  for (const re of MINOR_PATTERNS) {
    if (re.test(normalized)) hits.push({ category: 'minor', pattern: re.source });
  }
  if (NAMED_PERSON_PATTERN.test(text)) {
    hits.push({ category: 'named_person', pattern: NAMED_PERSON_PATTERN.source });
  }
  for (const term of dynamicTerms) {
    const re = term.matchType === 'regex' ? new RegExp(term.pattern, 'i') : new RegExp(escapeRegExp(term.pattern), 'i');
    if (re.test(normalized)) hits.push({ category: term.category, pattern: term.pattern });
  }

  return { blocked: hits.length > 0, hits };
}

// Collapses common evasion tricks (extra spacing/punctuation,
// leetspeak substitutions) before running the patterns above.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s._\-*]+/g, ' ')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
