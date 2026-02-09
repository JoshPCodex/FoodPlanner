import type { IngredientCategory, ReceiptDraftItem } from '../types';

const BAD_LINE_PATTERNS = [
  /subtotal/i,
  /tax/i,
  /total/i,
  /change/i,
  /cash/i,
  /visa/i,
  /mastercard/i,
  /debit/i,
  /credit/i,
  /thank/i,
  /balance/i,
  /store/i,
  /www\./i,
  /\d{2}\/\d{2}\/\d{2,4}/
];

const CATEGORY_HINTS: Array<{ match: RegExp; category: IngredientCategory }> = [
  { match: /(chicken|pork|beef|steak|bacon|turkey|fish|meatball)/i, category: 'Protein' },
  { match: /(milk|cheese|egg|yogurt|butter|cream)/i, category: 'Dairy' },
  { match: /(lettuce|carrot|cucumber|spinach|onion|tomato|pepper|apple|banana)/i, category: 'Produce' },
  { match: /(bread|pasta|penne|spaghetti|rice|oil|flour|salt|sugar)/i, category: 'Pantry' }
];

function normalizeLine(line: string): string {
  return line
    .replace(/\$?\d+[\d.,]*/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/[^a-zA-Z\s&+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUsefulLine(line: string): boolean {
  if (!line) return false;
  if (line.length < 2) return false;
  if (BAD_LINE_PATTERNS.some((pattern) => pattern.test(line))) return false;
  if (!/[a-zA-Z]/.test(line)) return false;
  return true;
}

function inferCategory(name: string): IngredientCategory {
  const matched = CATEGORY_HINTS.find((rule) => rule.match.test(name));
  return matched?.category ?? 'Other';
}

export function parseReceiptText(text: string): ReceiptDraftItem[] {
  const unique = new Map<string, ReceiptDraftItem>();

  text
    .split(/\r?\n/)
    .map((line) => normalizeLine(line))
    .filter((line) => isUsefulLine(line))
    .forEach((line) => {
      const key = line.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, {
          id: `receipt-${Math.random().toString(36).slice(2, 9)}`,
          name: line,
          category: inferCategory(line),
          count: 1
        });
      }
    });

  return Array.from(unique.values());
}
