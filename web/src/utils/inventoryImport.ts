import type { IngredientCategory, ReceiptDraftItem } from '../types';

const CATEGORY_HINTS: Array<{ match: RegExp; category: IngredientCategory }> = [
  { match: /(chicken|pork|beef|steak|bacon|turkey|fish|meatball|ham|sausage|shrimp)/i, category: 'Protein' },
  { match: /(milk|cheese|egg|yogurt|butter|cream|half and half)/i, category: 'Dairy' },
  { match: /(lettuce|carrot|cucumber|spinach|onion|tomato|pepper|apple|banana|berry|orange|grape|avocado)/i, category: 'Produce' },
  { match: /(bread|pasta|penne|spaghetti|rice|oil|flour|salt|sugar|beans|broth|sauce)/i, category: 'Pantry' }
];

const NOISE_LINE_PATTERNS = [
  /subtotal/i,
  /total/i,
  /tax/i,
  /tip/i,
  /service fee/i,
  /delivery/i,
  /fees?/i,
  /loyalty/i,
  /savings/i,
  /discount/i,
  /coupon/i,
  /promo/i,
  /payment/i,
  /visa/i,
  /mastercard/i,
  /debit/i,
  /credit/i,
  /order summary/i,
  /estimated total/i,
  /item total/i,
  /balance/i,
  /replacement/i,
  /refund/i,
  /www\./i,
  /instacart/i,
  /wegmans/i,
  /^\s*(produce|dairy|pantry|frozen|bakery|meat|seafood|beverages|household|snacks)\s*$/i
];

const WEIGHT_PATTERN = /\b\d+(?:\.\d+)?\s*(?:oz|fl\s*oz|lb|lbs|g|kg|ml|l)\b/gi;

type ParsedLine =
  | {
      type: 'item';
      name: string;
      count: number;
    }
  | {
      type: 'qty_hint';
      factor: number;
    }
  | null;

function inferCategory(name: string): IngredientCategory {
  return CATEGORY_HINTS.find((rule) => rule.match.test(name))?.category ?? 'Other';
}

function canonicalizeName(name: string): string {
  return name
    .replace(/\beggs\b/g, 'egg')
    .replace(/\bbananas\b/g, 'banana')
    .replace(/\bcarrots\b/g, 'carrot')
    .replace(/\bbreasts\b/g, 'breast')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value: string): string {
  return canonicalizeName(
    value
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(WEIGHT_PATTERN, ' ')
      .replace(/\$\s*\d+[\d.,]*/g, ' ')
      .replace(/\b\d+\b/g, ' ')
      .replace(
        /\b(organic|fresh|frozen|large|small|medium|thinly\s+sliced|sliced|pack|package|pk|brand|club|family\s*pack|value\s*pack)\b/g,
        ' '
      )
      .replace(/\b(sargento|wegmans|instacart|kraft|tyson|perdue|great\s*value|signature\s*select)\b/g, ' ')
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function looksLikeNoiseLine(line: string): boolean {
  return NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line));
}

function isLikelyNonItemName(name: string): boolean {
  if (!name) return true;
  if (looksLikeNoiseLine(name)) return true;
  if (!/[a-z]/.test(name)) return true;
  return false;
}

/**
 * Accept common LLM outputs like:
 * ```text
 * egg x12
 * banana x5
 * ```
 * and return only the inner lines.
 *
 * If the user pastes multiple fenced blocks, we keep it simple and just strip
 * the first opening fence and the last closing fence.
 */
function stripCodeFences(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return input;

  // Remove a leading ```lang (or ```) line
  const withoutOpening = trimmed.replace(/^```[^\n]*\n/, '');
  // Remove a trailing ``` line
  const withoutClosing = withoutOpening.replace(/\n```$/, '');

  return withoutClosing;
}

function parseLine(rawLine: string): ParsedLine {
  const original = rawLine.trim();
  if (!original) return null;
  if (looksLikeNoiseLine(original)) return null;

  let working = original;
  let factor = 1;

  const prefixQty = working.match(/^\s*(\d+)\s*[xX]\s*(?=[a-zA-Z(])/);
  if (prefixQty) {
    factor *= Number(prefixQty[1]);
    working = working.replace(prefixQty[0], ' ');
  }

  const receiptQtyPrice = working.match(/\b(\d+)\s*[xX]\s*\$\s*\d+[\d.,]*/i);
  if (receiptQtyPrice) {
    factor *= Number(receiptQtyPrice[1]);
    working = working.replace(receiptQtyPrice[0], ' ');
  }

  const qtyKeyword = working.match(/\b(?:qty|quantity)\s*[:x]?\s*(\d+)\b/i);
  if (qtyKeyword) {
    factor *= Number(qtyKeyword[1]);
    working = working.replace(qtyKeyword[0], ' ');
  }

  const explicitXCount = working.match(/\b[xX]\s*(\d+)\b/);
  if (explicitXCount) {
    factor *= Number(explicitXCount[1]);
    working = working.replace(explicitXCount[0], ' ');
  }

  const ctMatches = [...working.matchAll(/\b(\d+)\s*ct\b/gi)];
  if (ctMatches.length > 0) {
    ctMatches.forEach((match) => {
      factor *= Number(match[1]);
    });
    working = working.replace(/\b\d+\s*ct\b/gi, ' ');
  }

  if (/\bdozen\b/i.test(working)) {
    factor *= 12;
    working = working.replace(/\bdozen\b/gi, ' ');
  }

  const normalized = normalizeName(working);
  const safeFactor = Number.isFinite(factor) && factor > 0 ? Math.floor(factor) : 1;

  if (normalized && !isLikelyNonItemName(normalized)) {
    return {
      type: 'item',
      name: normalized,
      count: Math.max(1, safeFactor)
    };
  }

  const hasMeaningfulLetters = /[a-z]{2,}/i.test(original.replace(/\bx\b/gi, ' '));
  if (!hasMeaningfulLetters && safeFactor > 1) {
    return {
      type: 'qty_hint',
      factor: safeFactor
    };
  }

  return null;
}

export function parseInventoryImportText(text: string): ReceiptDraftItem[] {
  const cleanedText = stripCodeFences(text);

  const merged = new Map<string, ReceiptDraftItem>();
  let pending: { key: string; lastAddedCount: number } | null = null;

  cleanedText
    .split(/\r?\n/)
    .map((line) => parseLine(line))
    .forEach((parsed) => {
      if (!parsed) return;

      if (parsed.type === 'qty_hint') {
        if (!pending || parsed.factor <= 1) return;
        const existing = merged.get(pending.key);
        if (!existing) return;

        const delta = pending.lastAddedCount * (parsed.factor - 1);
        merged.set(pending.key, {
          ...existing,
          count: existing.count + delta
        });
        pending = {
          ...pending,
          lastAddedCount: pending.lastAddedCount * parsed.factor
        };
        return;
      }

      const key = parsed.name;
      const existing = merged.get(key);
      if (existing) {
        merged.set(key, {
          ...existing,
          count: existing.count + parsed.count
        });
      } else {
        merged.set(key, {
          id: `ai-import-${Math.random().toString(36).slice(2, 9)}`,
          name: key,
          count: parsed.count,
          category: inferCategory(key)
        });
      }

      pending = {
        key,
        lastAddedCount: parsed.count
      };
    });

  return Array.from(merged.values());
}

export const AI_INVENTORY_PROMPT = `You are helping me build a simple home food inventory from photos (receipt, fridge, pantry, groceries) OR raw pasted receipt text (like Instacart order details).

Return ONLY a single fenced code block (so I can click “Copy code”) containing one item per line in this exact format:
ingredient name xN

Output format requirements:
- Put ALL lines inside ONE code block like this:

\`\`\`text
egg x12
banana x5
milk x1
\`\`\`

Rules:
1) Use simple generic names only (no brands, no marketing words, no package size text).
2) Convert branded receipt lines to common ingredient names.
3) Merge duplicates and sum counts.
4) If quantity is unclear, use x1.
5) Keep names short and consistent (examples: "cheddar cheese", "chicken breast", "banana", "egg", "milk").
6) Do not include prices, totals, SKU codes, loyalty savings, section headers, or extra commentary — ONLY the code block.
7) Quantity parsing rules:
   - The input may be raw pasted text, not just photos/OCR.
   - Lines with "2 x $X" mean quantity 2.
   - If an item shows a "ct" count (for example, "6 ct"), use that count.
   - If both appear (for example, "2 x (6 ct eggs)"), multiply them.
   - If weight is present without explicit count, use x1.`;
