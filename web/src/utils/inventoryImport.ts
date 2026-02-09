import type { IngredientCategory, ReceiptDraftItem } from '../types';

const CATEGORY_HINTS: Array<{ match: RegExp; category: IngredientCategory }> = [
  { match: /(chicken|pork|beef|steak|bacon|turkey|fish|meatball|ham|sausage|shrimp)/i, category: 'Protein' },
  { match: /(milk|cheese|egg|yogurt|butter|cream|half and half)/i, category: 'Dairy' },
  { match: /(lettuce|carrot|cucumber|spinach|onion|tomato|pepper|apple|banana|berry|orange|grape|avocado)/i, category: 'Produce' },
  { match: /(bread|pasta|penne|spaghetti|rice|oil|flour|salt|sugar|beans|broth|sauce)/i, category: 'Pantry' }
];

function inferCategory(name: string): IngredientCategory {
  return CATEGORY_HINTS.find((rule) => rule.match.test(name))?.category ?? 'Other';
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(organic|fresh|frozen|large|small|medium|thinly\s+sliced|sliced|pack|package|pk|lb|oz|gallon|dozen)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseLine(rawLine: string): { name: string; count: number } | null {
  const cleanedLine = rawLine
    .trim()
    .replace(/^[-*•\d.)\s]+/, '')
    .replace(/\s+/g, ' ');

  if (!cleanedLine) return null;

  const countMatch = cleanedLine.match(/^(.*?)(?:\s*[xX]\s*(\d+)|\s*\(\s*[xX]\s*(\d+)\s*\)|\s+qty\s*(\d+)|\s+count\s*(\d+))\s*$/i);
  const count = countMatch ? Number(countMatch[2] ?? countMatch[3] ?? countMatch[4] ?? countMatch[5] ?? 1) : 1;
  const rawName = countMatch ? countMatch[1] : cleanedLine;
  const name = normalizeName(rawName);

  if (!name) return null;

  return {
    name,
    count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 1
  };
}

export function parseInventoryImportText(text: string): ReceiptDraftItem[] {
  const merged = new Map<string, ReceiptDraftItem>();

  text
    .split(/\r?\n/)
    .map((line) => parseLine(line))
    .filter((line): line is { name: string; count: number } => Boolean(line))
    .forEach((line) => {
      const key = line.name;
      const existing = merged.get(key);

      if (existing) {
        merged.set(key, { ...existing, count: existing.count + line.count });
      } else {
        merged.set(key, {
          id: `ai-import-${Math.random().toString(36).slice(2, 9)}`,
          name: key,
          count: line.count,
          category: inferCategory(key)
        });
      }
    });

  return Array.from(merged.values());
}

export const AI_INVENTORY_PROMPT = `You are helping me build a simple home food inventory from photos (receipt, fridge, pantry, groceries).

Return ONLY plain text, one item per line, using this exact format:
ingredient name xN

Rules:
1) Use simple generic names only (no brands, no marketing words, no package size text).
2) Convert branded receipt lines to common ingredient names.
3) Merge duplicates and sum counts.
4) If quantity is unclear, use x1.
5) Keep names short and consistent (example: "cheddar cheese", "chicken breast", "banana", "egg", "milk").
6) Do not include prices, totals, SKU codes, or extra commentary.

Examples:
Sargento Thinly Sliced Cheddar Cheese 12oz -> cheddar cheese x1
Eggs 12 ct -> egg x12
Bananas (5) -> banana x5
Thin sliced chicken breast pack of 4 -> chicken breast x4
Gallon Milk -> milk x1`;
