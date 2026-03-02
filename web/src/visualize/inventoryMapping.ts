import { CATEGORIES } from '../constants';
import type { Ingredient } from '../types';
import type { AssetId } from './assets';

export type VisualCategory = 'Protein' | 'Dairy' | 'Produce' | 'Pantry' | 'Other';
export type ZoneId =
  | 'fridge-shelf-1'
  | 'fridge-shelf-2'
  | 'fridge-shelf-3'
  | 'fridge-door-top'
  | 'fridge-door-bottom'
  | 'pantry-shelf-1'
  | 'pantry-shelf-2'
  | 'pantry-shelf-3'
  | 'pantry-shelf-4'
  | 'countertop';

export interface ZoneDefinition {
  id: ZoneId;
  label: string;
  slotPositions: [number, number, number][];
  focusPosition: [number, number, number];
  focusTarget: [number, number, number];
}

export interface VisualInventoryEntry {
  id: string;
  name: string;
  count: number;
  displayCount: number;
  category: VisualCategory;
  assetId: AssetId;
  modelId: string;
  assetScale: number;
  assetRotationY: number;
  defaultZoneId: ZoneId;
}

export interface VisualPlacement {
  zoneId: ZoneId;
  slotIndex: number;
  position: [number, number, number];
}

export type VisualLayoutMap = Record<string, VisualPlacement>;

const STACK_LIMIT = 12;
const FRIDGE_HINGE: [number, number, number] = [-3.1, 1.7, 0.55];
const MAX_DOOR_ANGLE = (Math.PI / 180) * 110;

const KEYWORD_ASSETS: Array<{ assetId: AssetId; keywords: string[] }> = [
  { assetId: 'apple', keywords: ['apple', 'pear', 'peach'] },
  { assetId: 'banana', keywords: ['banana', 'plantain'] },
  { assetId: 'orange', keywords: ['orange', 'clementine', 'mandarin'] },
  { assetId: 'onion', keywords: ['onion', 'shallot', 'garlic'] },
  { assetId: 'carrot', keywords: ['carrot'] },
  { assetId: 'lettuce', keywords: ['lettuce', 'spinach', 'kale', 'cucumber', 'broccoli', 'celery', 'salad', 'avocado'] },
  { assetId: 'milk', keywords: ['milk', 'cream'] },
  { assetId: 'cheese', keywords: ['cheese', 'butter'] },
  { assetId: 'egg', keywords: ['egg'] },
  { assetId: 'chicken', keywords: ['chicken', 'turkey'] },
  { assetId: 'bacon', keywords: ['bacon'] },
  { assetId: 'steak', keywords: ['steak', 'beef', 'pork', 'sausage', 'bacon'] },
  { assetId: 'fish', keywords: ['fish', 'salmon', 'tuna', 'shrimp'] },
  { assetId: 'pasta', keywords: ['pasta', 'rice', 'flour', 'cereal', 'oat'] },
  { assetId: 'sauce', keywords: ['sauce', 'jar', 'oil', 'vinegar', 'salsa', 'soup', 'broth'] },
  { assetId: 'seasoning', keywords: ['seasoning', 'salt', 'pepper', 'paprika', 'spice', 'oregano', 'cumin'] },
  { assetId: 'snack', keywords: ['cookie', 'cracker', 'chip', 'snack', 'granola', 'bar', 'candy'] },
  { assetId: 'bread', keywords: ['bread', 'bun', 'bagel', 'toast'] }
];

const CATEGORY_DEFAULT_ASSET: Record<VisualCategory, AssetId> = {
  Protein: 'chicken',
  Dairy: 'milk',
  Produce: 'apple',
  Pantry: 'pasta',
  Other: 'generic'
};

const DEFAULT_ZONES: Record<VisualCategory, ZoneId[]> = {
  Produce: ['fridge-shelf-1', 'fridge-shelf-2', 'fridge-door-top'],
  Dairy: ['fridge-shelf-1', 'fridge-shelf-2', 'fridge-door-bottom'],
  Protein: ['fridge-shelf-3', 'fridge-shelf-2'],
  Pantry: ['pantry-shelf-1', 'pantry-shelf-2', 'pantry-shelf-3', 'pantry-shelf-4', 'countertop'],
  Other: ['pantry-shelf-4', 'countertop', 'fridge-door-bottom']
};

const FALLBACK_ZONE_ORDER: ZoneId[] = [
  'fridge-shelf-1',
  'fridge-shelf-2',
  'fridge-shelf-3',
  'fridge-door-top',
  'fridge-door-bottom',
  'pantry-shelf-1',
  'pantry-shelf-2',
  'pantry-shelf-3',
  'pantry-shelf-4',
  'countertop'
];

function rotatePointY(point: [number, number, number], pivot: [number, number, number], angle: number): [number, number, number] {
  const translatedX = point[0] - pivot[0];
  const translatedZ = point[2] - pivot[2];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [
    pivot[0] + translatedX * cos - translatedZ * sin,
    point[1],
    pivot[2] + translatedX * sin + translatedZ * cos
  ];
}

function buildRow(origin: [number, number, number], columns: number, spacing: [number, number, number]): [number, number, number][] {
  return Array.from({ length: columns }, (_, index) => [
    origin[0] + spacing[0] * index,
    origin[1] + spacing[1] * index,
    origin[2] + spacing[2] * index
  ]);
}

export function getMaxDoorAngle(): number {
  return MAX_DOOR_ANGLE;
}

export function buildZones(fridgeDoorAngle: number): ZoneDefinition[] {
  const clamped = Math.max(0, Math.min(MAX_DOOR_ANGLE, fridgeDoorAngle));
  const doorTopPoints = buildRow([-2.4, 2.27, 0.67], 4, [0, 0, 0.27]).map((point) => rotatePointY(point, FRIDGE_HINGE, -clamped));
  const doorBottomPoints = buildRow([-2.45, 1.38, 0.67], 4, [0, 0, 0.27]).map((point) => rotatePointY(point, FRIDGE_HINGE, -clamped));

  return [
    {
      id: 'fridge-shelf-1',
      label: 'Fridge Shelf 1',
      slotPositions: buildRow([-2.65, 2.05, -0.18], 5, [0.32, 0, 0]),
      focusPosition: [-3.7, 3.1, 4.8],
      focusTarget: [-2.35, 2.05, -0.05]
    },
    {
      id: 'fridge-shelf-2',
      label: 'Fridge Shelf 2',
      slotPositions: buildRow([-2.65, 1.33, -0.18], 5, [0.32, 0, 0]),
      focusPosition: [-3.7, 2.3, 4.8],
      focusTarget: [-2.35, 1.3, -0.05]
    },
    {
      id: 'fridge-shelf-3',
      label: 'Fridge Shelf 3',
      slotPositions: buildRow([-2.65, 0.6, -0.18], 5, [0.32, 0, 0]),
      focusPosition: [-3.65, 1.55, 4.7],
      focusTarget: [-2.35, 0.6, -0.05]
    },
    {
      id: 'fridge-door-top',
      label: 'Fridge Door Bin (Top)',
      slotPositions: doorTopPoints,
      focusPosition: [-4.5, 3.0, 3.9],
      focusTarget: [-2.55, 2.18, 0.45]
    },
    {
      id: 'fridge-door-bottom',
      label: 'Fridge Door Bin (Bottom)',
      slotPositions: doorBottomPoints,
      focusPosition: [-4.35, 2.1, 3.7],
      focusTarget: [-2.55, 1.35, 0.45]
    },
    {
      id: 'pantry-shelf-1',
      label: 'Pantry Shelf 1',
      slotPositions: buildRow([1.55, 2.55, -0.1], 5, [0.33, 0, 0]),
      focusPosition: [4.0, 3.45, 4.9],
      focusTarget: [2.2, 2.55, -0.05]
    },
    {
      id: 'pantry-shelf-2',
      label: 'Pantry Shelf 2',
      slotPositions: buildRow([1.55, 1.88, -0.1], 5, [0.33, 0, 0]),
      focusPosition: [4.0, 2.75, 4.9],
      focusTarget: [2.2, 1.88, -0.05]
    },
    {
      id: 'pantry-shelf-3',
      label: 'Pantry Shelf 3',
      slotPositions: buildRow([1.55, 1.22, -0.1], 5, [0.33, 0, 0]),
      focusPosition: [4.0, 2.05, 4.9],
      focusTarget: [2.2, 1.22, -0.05]
    },
    {
      id: 'pantry-shelf-4',
      label: 'Pantry Shelf 4',
      slotPositions: buildRow([1.55, 0.55, -0.1], 5, [0.33, 0, 0]),
      focusPosition: [4.0, 1.45, 4.9],
      focusTarget: [2.2, 0.55, -0.05]
    },
    {
      id: 'countertop',
      label: 'Countertop',
      slotPositions: buildRow([-0.95, 1.06, 1.1], 6, [0.34, 0, 0]),
      focusPosition: [0.45, 2.2, 5.0],
      focusTarget: [-0.05, 1.06, 1.1]
    }
  ];
}

function normalizeCategory(value: string): VisualCategory {
  const match = CATEGORIES.find((category) => category.toLowerCase() === value.toLowerCase());
  if (!match) return 'Other';
  return match as VisualCategory;
}

function normalizeName(value: string): string {
  return value.toLowerCase().trim();
}

function resolveAsset(name: string, category: VisualCategory): AssetId {
  const normalized = normalizeName(name);
  const hit = KEYWORD_ASSETS.find((entry) => entry.keywords.some((keyword) => normalized.includes(keyword)));
  return hit?.assetId ?? CATEGORY_DEFAULT_ASSET[category];
}

function defaultAssetScale(assetId: AssetId): number {
  if (assetId === 'milk' || assetId === 'sauce' || assetId === 'seasoning') return 0.95;
  if (assetId === 'bread' || assetId === 'lettuce') return 1.05;
  return 1;
}

function defaultAssetRotation(assetId: AssetId): number {
  if (assetId === 'banana' || assetId === 'fish' || assetId === 'bread') return 0.3;
  return 0;
}

export function mapInventoryToVisuals(ingredients: Ingredient[]): VisualInventoryEntry[] {
  return ingredients
    .filter((ingredient) => ingredient.count > 0)
    .map((ingredient) => {
      const category = normalizeCategory(ingredient.category);
      const assetId = resolveAsset(ingredient.name, category);
      return {
        id: ingredient.id,
        name: ingredient.name,
        count: ingredient.count,
        displayCount: Math.min(STACK_LIMIT, Math.max(1, Math.ceil(ingredient.count))),
        category,
        assetId,
        modelId: `props/${assetId}.glb`,
        assetScale: defaultAssetScale(assetId),
        assetRotationY: defaultAssetRotation(assetId),
        defaultZoneId: DEFAULT_ZONES[category][0]
      };
    });
}

export function buildCategoryTotals(entries: VisualInventoryEntry[]): Record<VisualCategory, number> {
  return entries.reduce<Record<VisualCategory, number>>(
    (totals, entry) => {
      totals[entry.category] += entry.count;
      return totals;
    },
    {
      Protein: 0,
      Dairy: 0,
      Produce: 0,
      Pantry: 0,
      Other: 0
    }
  );
}

export function reconcileLayout(entries: VisualInventoryEntry[], zones: ZoneDefinition[], current: VisualLayoutMap): VisualLayoutMap {
  const zoneMap = new Map(zones.map((zone) => [zone.id, zone]));
  const nextByZone = new Map<ZoneId, number>();
  const occupied = new Set<string>();
  const resolved: VisualLayoutMap = {};

  function allocate(zoneIds: ZoneId[]): VisualPlacement {
    for (const zoneId of zoneIds) {
      const zone = zoneMap.get(zoneId);
      if (!zone) continue;
      const startIndex = nextByZone.get(zoneId) ?? 0;
      for (let slotIndex = startIndex; slotIndex < zone.slotPositions.length; slotIndex += 1) {
        const key = `${zoneId}:${slotIndex}`;
        if (occupied.has(key)) continue;
        occupied.add(key);
        nextByZone.set(zoneId, slotIndex + 1);
        return {
          zoneId,
          slotIndex,
          position: zone.slotPositions[slotIndex]
        };
      }
      nextByZone.set(zoneId, zone.slotPositions.length);
    }

    const fallbackZone = zoneMap.get('countertop') ?? zones[0];
    return {
      zoneId: fallbackZone.id,
      slotIndex: 0,
      position: fallbackZone.slotPositions[0]
    };
  }

  entries.forEach((entry) => {
    const saved = current[entry.id];
    if (saved) {
      const zone = zoneMap.get(saved.zoneId);
      const slot = zone?.slotPositions[saved.slotIndex];
      if (zone && slot) {
        const key = `${saved.zoneId}:${saved.slotIndex}`;
        if (!occupied.has(key)) {
          occupied.add(key);
          resolved[entry.id] = {
            zoneId: saved.zoneId,
            slotIndex: saved.slotIndex,
            position: slot
          };
          return;
        }
      }
    }

    const preferred = DEFAULT_ZONES[entry.category];
    resolved[entry.id] = allocate([...preferred, ...FALLBACK_ZONE_ORDER]);
  });

  return resolved;
}

export function findNearestSlot(position: [number, number, number], zones: ZoneDefinition[]): VisualPlacement {
  let nearest: VisualPlacement | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  zones.forEach((zone) => {
    zone.slotPositions.forEach((slot, slotIndex) => {
      const dx = slot[0] - position[0];
      const dy = slot[1] - position[1];
      const dz = slot[2] - position[2];
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = {
          zoneId: zone.id,
          slotIndex,
          position: slot
        };
      }
    });
  });

  return nearest ?? { zoneId: 'countertop', slotIndex: 0, position: [0, 1.06, 1.1] };
}
