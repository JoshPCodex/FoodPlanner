import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CATEGORIES } from '../constants';
import { addDays, parseISODate, startOfWeekMonday, toISODate } from '../utils/date';
import type {
  CellEntry,
  Ingredient,
  IngredientCategory,
  IngredientRef,
  Meal,
  MealType,
  PlannerExportShape,
  Profile,
  ReceiptDraftItem,
  SlotEntry,
  WeekPlan
} from '../types';

const STORAGE_KEY = 'meal-bubble-planner-v3';

interface CellAddress {
  mealType: MealType;
  day: number;
}

export interface SlotAddress extends CellAddress {
  targetType: 'family' | 'profile';
  profileId?: string;
}

interface PlannerState {
  ingredients: Ingredient[];
  meals: Meal[];
  profiles: Profile[];
  customCategories: IngredientCategory[];
  pinnedMealIds: string[];
  weekPlans: Record<string, WeekPlan>;
  currentWeekStartDate: string;
  inventorySort: 'category' | 'expiry';
  past: PlannerSnapshot[];
  future: PlannerSnapshot[];

  undo: () => void;
  redo: () => void;
  shiftWeek: (delta: number) => void;
  setWeek: (weekStartDate: string) => void;
  setInventorySort: (value: 'category' | 'expiry') => void;

  addProfile: (input: { name: string; color: string }) => void;
  updateProfile: (
    id: string,
    updates: Partial<
      Pick<
        Profile,
        'name' | 'color' | 'goalEnabled' | 'dailyCalorieGoal' | 'dailyProteinGoalG' | 'dailyCarbsGoalG' | 'dailyFatGoalG'
      >
    >
  ) => void;
  deleteProfile: (id: string) => void;

  addOrMergeIngredient: (input: Omit<Ingredient, 'id' | 'createdAt'> & { id?: string }) => void;
  addCustomCategory: (category: string) => void;
  updateIngredient: (id: string, updates: Partial<Omit<Ingredient, 'id' | 'createdAt'>>) => void;
  deleteIngredient: (id: string) => void;
  adjustIngredientCount: (id: string, delta: number) => void;
  toggleIngredientPinned: (id: string) => void;
  clearInventory: () => void;
  clearCurrentWeekAndRestoreInventory: () => void;

  addMeal: (input: Omit<Meal, 'id' | 'createdAt'> & { id?: string }) => void;
  updateMeal: (id: string, updates: Partial<Omit<Meal, 'id' | 'createdAt'>>) => void;
  deleteMeal: (id: string) => void;
  toggleMealPinned: (id: string) => void;
  movePinnedMeal: (mealId: string, direction: 'left' | 'right') => void;

  dropIngredientToCell: (address: SlotAddress, ingredientId: string) => void;
  dropMealToCell: (address: SlotAddress, mealId: string) => void;
  moveOrSwapCell: (source: SlotAddress, target: SlotAddress) => void;
  clearCell: (address: SlotAddress) => void;
  removeCellToInventory: (address: SlotAddress) => void;
  removeIngredientRefFromCell: (address: SlotAddress, index: number) => void;
  duplicateCell: (source: SlotAddress, target: SlotAddress) => void;
  makeLeftovers: (address: SlotAddress) => void;
  setCellServings: (address: SlotAddress, servings: number) => void;
  saveCellAsMeal: (address: SlotAddress, mealName: string) => void;

  mergeReceiptItems: (items: ReceiptDraftItem[]) => void;

  resetDemoData: () => void;
  importState: (payload: PlannerExportShape) => void;

  getCurrentWeekPlan: () => WeekPlan;
}

interface PlannerSnapshot {
  ingredients: Ingredient[];
  meals: Meal[];
  profiles: Profile[];
  customCategories: IngredientCategory[];
  pinnedMealIds: string[];
  weekPlans: Record<string, WeekPlan>;
  currentWeekStartDate: string;
  inventorySort: 'category' | 'expiry';
}

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ');
}

function defaultSlotEntry(): SlotEntry {
  return {
    ingredientRefs: [],
    servings: 2
  };
}

function createEmptyWeekPlan(weekStartDate: string): WeekPlan {
  return {
    weekStartDate,
    grid: {
      breakfast: Array<CellEntry | null>(7).fill(null),
      lunch: Array<CellEntry | null>(7).fill(null),
      dinner: Array<CellEntry | null>(7).fill(null),
      snack: Array<CellEntry | null>(7).fill(null)
    }
  };
}

function cloneSlot(entry: SlotEntry | null | undefined): SlotEntry | null {
  if (!entry) return null;
  return {
    ...entry,
    ingredientRefs: entry.ingredientRefs.map((ref) => ({ ...ref }))
  };
}

function cloneCell(cell: CellEntry | null): CellEntry | null {
  if (!cell) return null;
  const profiles: Record<string, SlotEntry | null> = {};
  Object.entries(cell.profiles ?? {}).forEach(([profileId, entry]) => {
    profiles[profileId] = cloneSlot(entry);
  });

  return {
    family: cloneSlot(cell.family),
    profiles
  };
}

function clonePlan(plan: WeekPlan): WeekPlan {
  return {
    weekStartDate: plan.weekStartDate,
    grid: {
      breakfast: plan.grid.breakfast.map(cloneCell),
      lunch: plan.grid.lunch.map(cloneCell),
      dinner: plan.grid.dinner.map(cloneCell),
      snack: plan.grid.snack.map(cloneCell)
    }
  };
}

function normalizeServingsPerCount(value?: number): number {
  if (!value || !Number.isFinite(value)) return 1;
  return Math.max(0.01, value);
}

function servingsToCountDelta(servingsQty: number, servingsPerCount?: number): number {
  return servingsQty / normalizeServingsPerCount(servingsPerCount);
}

function roundCount(value: number): number {
  return Math.round(value * 100) / 100;
}

function addIngredientRef(list: IngredientRef[], incoming: IngredientRef): IngredientRef[] {
  const key = incoming.ingredientId ? `id:${incoming.ingredientId}` : `name:${normalizeName(incoming.name)}`;
  const copy = list.map((item) => ({ ...item }));
  const index = copy.findIndex((item) => {
    const itemKey = item.ingredientId ? `id:${item.ingredientId}` : `name:${normalizeName(item.name)}`;
    return itemKey === key;
  });

  if (index >= 0) {
    copy[index] = { ...copy[index], qty: copy[index].qty + incoming.qty };
  } else {
    copy.push({ ...incoming });
  }

  return copy;
}

function scaleIngredientRefs(list: IngredientRef[], ratio: number): IngredientRef[] {
  const safeRatio = Number.isFinite(ratio) ? ratio : 1;
  return list.map((item) => ({
    ...item,
    qty: Math.max(0.01, Math.round(item.qty * safeRatio * 100) / 100)
  }));
}

function getCell(plan: WeekPlan, address: CellAddress): CellEntry | null {
  return plan.grid[address.mealType][address.day] ?? null;
}

function slotKey(address: SlotAddress): string {
  if (address.targetType === 'family') return 'family';
  return address.profileId ?? '';
}

function getSlot(plan: WeekPlan, address: SlotAddress): SlotEntry | null {
  const cell = getCell(plan, address);
  if (!cell) return null;

  if (address.targetType === 'family') {
    return cloneSlot(cell.family);
  }

  if (!address.profileId) return null;
  return cloneSlot(cell.profiles[address.profileId]);
}

function setSlot(plan: WeekPlan, address: SlotAddress, value: SlotEntry | null): void {
  const existing = getCell(plan, address) ?? { family: null, profiles: {} };
  const nextCell: CellEntry = {
    family: cloneSlot(existing.family),
    profiles: { ...existing.profiles }
  };

  if (address.targetType === 'family') {
    nextCell.family = value ? cloneSlot(value) : null;
  } else if (address.profileId) {
    nextCell.profiles[address.profileId] = value ? cloneSlot(value) : null;
  }

  const hasAnyProfile = Object.values(nextCell.profiles).some((entry) => Boolean(entry));
  const hasAny = Boolean(nextCell.family) || hasAnyProfile;
  plan.grid[address.mealType][address.day] = hasAny ? nextCell : null;
}

function baseProfiles(): Profile[] {
  const now = new Date().toISOString();
  return [
    {
      id: createId('profile'),
      name: 'Me',
      color: '#0ea5e9',
      goalEnabled: false,
      createdAt: now
    },
    {
      id: createId('profile'),
      name: 'Erica',
      color: '#f97316',
      goalEnabled: false,
      createdAt: now
    }
  ];
}

function baseIngredients(): Ingredient[] {
  const now = new Date().toISOString();
  return [
    ['chicken breast', 'Protein', 16],
    ['ground beef', 'Protein', 8],
    ['salmon', 'Protein', 6],
    ['pork loin', 'Protein', 6],
    ['turkey slices', 'Protein', 10],
    ['bacon', 'Protein', 8],
    ['sausage', 'Protein', 6],
    ['eggs', 'Dairy', 24],
    ['greek yogurt', 'Dairy', 8],
    ['cheddar cheese', 'Dairy', 10],
    ['mozzarella', 'Dairy', 8],
    ['milk', 'Dairy', 4],
    ['butter', 'Dairy', 6],
    ['lettuce', 'Produce', 8],
    ['spinach', 'Produce', 8],
    ['broccoli', 'Produce', 8],
    ['bell pepper', 'Produce', 10],
    ['carrots', 'Produce', 12],
    ['cucumber', 'Produce', 8],
    ['tomato', 'Produce', 12],
    ['onion', 'Produce', 10],
    ['banana', 'Produce', 12],
    ['apple', 'Produce', 10],
    ['blueberries', 'Produce', 7],
    ['bread', 'Pantry', 12],
    ['bagel', 'Pantry', 10],
    ['oats', 'Pantry', 10],
    ['granola', 'Pantry', 8],
    ['rice', 'Pantry', 12],
    ['quinoa', 'Pantry', 8],
    ['tortilla', 'Pantry', 12],
    ['penne', 'Pantry', 8],
    ['spaghetti', 'Pantry', 8],
    ['pasta sauce', 'Pantry', 8],
    ['black beans', 'Pantry', 8],
    ['peanut butter', 'Pantry', 5],
    ['hummus', 'Other', 6],
    ['protein bar', 'Other', 14],
    ['almonds', 'Other', 7],
    ['dark chocolate', 'Other', 7]
  ].map(([name, category, count]) => ({
    id: createId('ingredient'),
    name: String(name),
    category: category as IngredientCategory,
    count: Number(count),
    servingsPerCount: 1,
    createdAt: now
  }));
}

function baseMeals(): Meal[] {
  const now = new Date().toISOString();
  return [
    {
      id: createId('meal'),
      name: 'Chicken + Penne',
      pinned: true,
      servingsDefault: 2,
      ingredients: [
        { name: 'chicken breast', category: 'Protein', qty: 1 },
        { name: 'penne', category: 'Pantry', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Spaghetti + Meatballs',
      pinned: true,
      servingsDefault: 2,
      ingredients: [
        { name: 'spaghetti', category: 'Pantry', qty: 1 },
        { name: 'ground beef', category: 'Protein', qty: 1 },
        { name: 'pasta sauce', category: 'Pantry', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Bacon + Egg + Cheese',
      pinned: true,
      servingsDefault: 2,
      ingredients: [
        { name: 'bacon', category: 'Protein', qty: 1 },
        { name: 'eggs', category: 'Dairy', qty: 1 },
        { name: 'cheddar cheese', category: 'Dairy', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Salmon + Rice Bowl',
      pinned: true,
      servingsDefault: 2,
      ingredients: [
        { name: 'salmon', category: 'Protein', qty: 1 },
        { name: 'rice', category: 'Pantry', qty: 1 },
        { name: 'broccoli', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Turkey Sandwich + Veggies',
      pinned: false,
      servingsDefault: 2,
      ingredients: [
        { name: 'turkey slices', category: 'Protein', qty: 1 },
        { name: 'bread', category: 'Pantry', qty: 2 },
        { name: 'lettuce', category: 'Produce', qty: 1 },
        { name: 'tomato', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Chicken Taco Night',
      pinned: false,
      servingsDefault: 2,
      ingredients: [
        { name: 'chicken breast', category: 'Protein', qty: 1 },
        { name: 'tortilla', category: 'Pantry', qty: 2 },
        { name: 'cheddar cheese', category: 'Dairy', qty: 1 },
        { name: 'bell pepper', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Yogurt + Granola Bowl',
      pinned: false,
      servingsDefault: 2,
      ingredients: [
        { name: 'greek yogurt', category: 'Dairy', qty: 1 },
        { name: 'granola', category: 'Pantry', qty: 1 },
        { name: 'blueberries', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Overnight Oats',
      pinned: false,
      servingsDefault: 2,
      ingredients: [
        { name: 'oats', category: 'Pantry', qty: 1 },
        { name: 'milk', category: 'Dairy', qty: 1 },
        { name: 'banana', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Steak + Quinoa',
      pinned: false,
      servingsDefault: 2,
      ingredients: [
        { name: 'pork loin', category: 'Protein', qty: 1 },
        { name: 'quinoa', category: 'Pantry', qty: 1 },
        { name: 'spinach', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Snack Plate',
      pinned: false,
      servingsDefault: 2,
      ingredients: [
        { name: 'hummus', category: 'Other', qty: 1 },
        { name: 'carrots', category: 'Produce', qty: 1 },
        { name: 'cucumber', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Protein Bar + Fruit',
      pinned: false,
      servingsDefault: 1,
      caloriesPerServing: 280,
      ingredients: [
        { name: 'protein bar', category: 'Other', qty: 1 },
        { name: 'apple', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Chicken Stir Fry',
      pinned: false,
      servingsDefault: 2,
      caloriesPerServing: 520,
      ingredients: [
        { name: 'chicken breast', category: 'Protein', qty: 2 },
        { name: 'rice', category: 'Pantry', qty: 2 },
        { name: 'bell pepper', category: 'Produce', qty: 1 },
        { name: 'onion', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Breakfast Burritos',
      pinned: false,
      servingsDefault: 2,
      caloriesPerServing: 480,
      ingredients: [
        { name: 'eggs', category: 'Dairy', qty: 2 },
        { name: 'tortilla', category: 'Pantry', qty: 2 },
        { name: 'cheddar cheese', category: 'Dairy', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Greek Yogurt Parfait',
      pinned: false,
      servingsDefault: 2,
      caloriesPerServing: 350,
      ingredients: [
        { name: 'greek yogurt', category: 'Dairy', qty: 2 },
        { name: 'granola', category: 'Pantry', qty: 1 },
        { name: 'blueberries', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Beef + Rice Skillet',
      pinned: false,
      servingsDefault: 2,
      caloriesPerServing: 610,
      ingredients: [
        { name: 'ground beef', category: 'Protein', qty: 2 },
        { name: 'rice', category: 'Pantry', qty: 2 },
        { name: 'onion', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Turkey Bagel Melt',
      pinned: false,
      servingsDefault: 2,
      caloriesPerServing: 470,
      ingredients: [
        { name: 'turkey slices', category: 'Protein', qty: 2 },
        { name: 'bagel', category: 'Pantry', qty: 2 },
        { name: 'mozzarella', category: 'Dairy', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Pork Loin + Veggies',
      pinned: false,
      servingsDefault: 2,
      caloriesPerServing: 560,
      ingredients: [
        { name: 'pork loin', category: 'Protein', qty: 2 },
        { name: 'broccoli', category: 'Produce', qty: 1 },
        { name: 'carrots', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Quinoa Veggie Bowl',
      pinned: false,
      servingsDefault: 2,
      caloriesPerServing: 430,
      ingredients: [
        { name: 'quinoa', category: 'Pantry', qty: 2 },
        { name: 'spinach', category: 'Produce', qty: 1 },
        { name: 'cucumber', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Peanut Butter Banana Toast',
      pinned: false,
      servingsDefault: 2,
      caloriesPerServing: 390,
      ingredients: [
        { name: 'bread', category: 'Pantry', qty: 2 },
        { name: 'peanut butter', category: 'Pantry', qty: 1 },
        { name: 'banana', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Salmon Pasta',
      pinned: false,
      servingsDefault: 2,
      caloriesPerServing: 590,
      ingredients: [
        { name: 'salmon', category: 'Protein', qty: 2 },
        { name: 'spaghetti', category: 'Pantry', qty: 2 },
        { name: 'pasta sauce', category: 'Pantry', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Chicken Caesar Wraps',
      pinned: false,
      servingsDefault: 2,
      caloriesPerServing: 500,
      ingredients: [
        { name: 'chicken breast', category: 'Protein', qty: 2 },
        { name: 'tortilla', category: 'Pantry', qty: 2 },
        { name: 'lettuce', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    },
    {
      id: createId('meal'),
      name: 'Egg Scramble + Toast',
      pinned: false,
      servingsDefault: 2,
      caloriesPerServing: 410,
      ingredients: [
        { name: 'eggs', category: 'Dairy', qty: 2 },
        { name: 'bread', category: 'Pantry', qty: 2 },
        { name: 'spinach', category: 'Produce', qty: 1 }
      ],
      createdAt: now
    }
  ];
}

function slotFromMeal(meal: Meal, ingredients: Ingredient[]): SlotEntry {
  const normalizedIngredientMap = new Map(ingredients.map((item) => [normalizeName(item.name), item]));
  return {
    mealId: meal.id,
    ingredientRefs: meal.ingredients.map((item) => {
      const matched = normalizedIngredientMap.get(normalizeName(item.name));
      return {
        ingredientId: matched?.id,
        name: item.name,
        qty: Math.max(1, item.qty ?? 1)
      };
    }),
    servings: meal.servingsDefault || 2
  };
}

function createPlannedDemoWeek(weekStartDate: string, meals: Meal[], ingredients: Ingredient[], profiles: Profile[]): WeekPlan {
  const plan = createEmptyWeekPlan(weekStartDate);
  const byName = new Map(meals.map((meal) => [meal.name, meal]));
  const me = profiles[0];
  const erica = profiles[1];

  const mealCycle: Record<MealType, string[]> = {
    breakfast: [
      'Bacon + Egg + Cheese',
      'Overnight Oats',
      'Yogurt + Granola Bowl',
      'Bacon + Egg + Cheese',
      'Overnight Oats',
      'Bacon + Egg + Cheese',
      'Yogurt + Granola Bowl'
    ],
    lunch: [
      'Turkey Sandwich + Veggies',
      'Chicken + Penne',
      'Turkey Sandwich + Veggies',
      'Salmon + Rice Bowl',
      'Chicken Taco Night',
      'Turkey Sandwich + Veggies',
      'Spaghetti + Meatballs'
    ],
    dinner: [
      'Spaghetti + Meatballs',
      'Chicken Taco Night',
      'Salmon + Rice Bowl',
      'Steak + Quinoa',
      'Chicken + Penne',
      'Spaghetti + Meatballs',
      'Salmon + Rice Bowl'
    ],
    snack: [
      'Snack Plate',
      'Protein Bar + Fruit',
      'Snack Plate',
      'Protein Bar + Fruit',
      'Snack Plate',
      'Protein Bar + Fruit',
      'Snack Plate'
    ]
  };

  (Object.keys(mealCycle) as MealType[]).forEach((mealType) => {
    for (let day = 0; day < 7; day += 1) {
      const meal = byName.get(mealCycle[mealType][day]);
      if (!meal) continue;
      const family = slotFromMeal(meal, ingredients);
      plan.grid[mealType][day] = { family, profiles: {} };
    }
  });

  if (me && erica) {
    const meBreakfast = byName.get('Yogurt + Granola Bowl');
    const ericaBreakfast = byName.get('Overnight Oats');
    const meSnack = byName.get('Protein Bar + Fruit');
    const ericaSnack = byName.get('Snack Plate');

    if (meBreakfast && ericaBreakfast) {
      plan.grid.breakfast[1] = {
        family: null,
        profiles: {
          [me.id]: slotFromMeal(meBreakfast, ingredients),
          [erica.id]: slotFromMeal(ericaBreakfast, ingredients)
        }
      };
      plan.grid.breakfast[4] = {
        family: null,
        profiles: {
          [me.id]: slotFromMeal(ericaBreakfast, ingredients),
          [erica.id]: slotFromMeal(meBreakfast, ingredients)
        }
      };
    }

    if (meSnack && ericaSnack) {
      plan.grid.snack[2] = {
        family: null,
        profiles: {
          [me.id]: slotFromMeal(meSnack, ingredients),
          [erica.id]: slotFromMeal(ericaSnack, ingredients)
        }
      };
    }
  }

  return plan;
}

function restoreSlotRefsToInventory(ingredients: Ingredient[], slot: SlotEntry | null): Ingredient[] {
  if (!slot) return ingredients;
  let updated = [...ingredients];

  slot.ingredientRefs.forEach((ref) => {
    const qty = Math.max(1, ref.qty || 1);
    const byIdIndex = ref.ingredientId ? updated.findIndex((item) => item.id === ref.ingredientId) : -1;
    if (byIdIndex >= 0) {
      const item = updated[byIdIndex];
      const deltaCount = servingsToCountDelta(qty, item.servingsPerCount);
      updated[byIdIndex] = { ...item, count: roundCount(item.count + deltaCount) };
      return;
    }

    const byNameIndex = updated.findIndex((item) => normalizeName(item.name) === normalizeName(ref.name));
    if (byNameIndex >= 0) {
      const item = updated[byNameIndex];
      const deltaCount = servingsToCountDelta(qty, item.servingsPerCount);
      updated[byNameIndex] = { ...item, count: roundCount(item.count + deltaCount) };
      return;
    }

    updated = [
      {
        id: createId('ingredient'),
        name: ref.name,
        category: 'Other',
        count: qty,
        servingsPerCount: 1,
        createdAt: new Date().toISOString()
      },
      ...updated
    ];
  });

  return updated;
}

function restoreWeekIngredients(ingredients: Ingredient[], plan: WeekPlan): Ingredient[] {
  let restored = [...ingredients];
  (Object.keys(plan.grid) as MealType[]).forEach((mealType) => {
    plan.grid[mealType].forEach((cell) => {
      if (!cell) return;
      restored = restoreSlotRefsToInventory(restored, cell.family);
      Object.values(cell.profiles).forEach((slot) => {
        restored = restoreSlotRefsToInventory(restored, slot);
      });
    });
  });
  return restored;
}

function adjustInventoryForIngredientRefs(
  ingredients: Ingredient[],
  refs: IngredientRef[],
  direction: 'consume' | 'restore'
): Ingredient[] {
  const multiplier = direction === 'consume' ? -1 : 1;
  return ingredients.map((ingredient) => {
    let nextCount = ingredient.count;
    refs.forEach((ref) => {
      const matchById = ref.ingredientId && ref.ingredientId === ingredient.id;
      const matchByName = !ref.ingredientId && normalizeName(ref.name) === normalizeName(ingredient.name);
      if (!matchById && !matchByName) return;
      const delta = servingsToCountDelta(ref.qty, ingredient.servingsPerCount);
      nextCount += delta * multiplier;
    });
    return { ...ingredient, count: roundCount(Math.max(0, nextCount)) };
  });
}

function normalizeWeekPlan(plan: WeekPlan, primaryProfileId: string): WeekPlan {
  const normalized = createEmptyWeekPlan(plan.weekStartDate);

  (Object.keys(plan.grid) as MealType[]).forEach((mealType) => {
    normalized.grid[mealType] = plan.grid[mealType].map((rawCell) => {
      if (!rawCell) return null;

      if (typeof rawCell === 'object' && 'ingredientRefs' in rawCell) {
        const legacy = rawCell as unknown as {
          mealId?: string;
          adHocMealName?: string;
          ingredientRefs: IngredientRef[];
          servings?: number;
          notes?: string;
          isLeftovers?: boolean;
        };

        return {
          family: {
            mealId: legacy.mealId,
            adHocMealName: legacy.adHocMealName,
            ingredientRefs: legacy.ingredientRefs ?? [],
            servings: legacy.servings ?? 2,
            notes: legacy.notes,
            isLeftovers: legacy.isLeftovers
          },
          profiles: {}
        };
      }

      if (typeof rawCell === 'object' && 'family' in rawCell && 'profiles' in rawCell) {
        const modern = rawCell as unknown as CellEntry;
        const profiles: Record<string, SlotEntry | null> = {};
        Object.entries(modern.profiles ?? {}).forEach(([profileId, slot]) => {
          profiles[profileId] = cloneSlot(slot);
        });

        const hasAnyProfile = Object.values(profiles).some((entry) => Boolean(entry));
        const family = cloneSlot(modern.family);
        if (!family && !hasAnyProfile) return null;

        return {
          family,
          profiles
        };
      }

      const legacyProfiles = rawCell as unknown as Record<string, SlotEntry | null>;
      const profiles: Record<string, SlotEntry | null> = {};
      Object.entries(legacyProfiles).forEach(([profileId, slot]) => {
        profiles[profileId] = cloneSlot(slot);
      });

      const hasAny = Object.values(profiles).some((entry) => Boolean(entry));
      if (!hasAny) return null;

      if (!profiles[primaryProfileId]) {
        const firstExisting = Object.values(profiles).find((entry) => Boolean(entry));
        profiles[primaryProfileId] = cloneSlot(firstExisting ?? null);
      }

      return {
        family: null,
        profiles
      };
    });
  });

  return normalized;
}

function createDemoState() {
  const profiles = baseProfiles();
  const weekStart = toISODate(startOfWeekMonday(new Date()));
  const meals = baseMeals();
  const ingredients = baseIngredients();
  const plannedWeek = createPlannedDemoWeek(weekStart, meals, ingredients, profiles);
  const pinnedMealIds = meals.filter((meal) => meal.pinned).map((meal) => meal.id);

  return {
    ingredients,
    meals,
    profiles,
    customCategories: [],
    pinnedMealIds,
    weekPlans: {
      [weekStart]: plannedWeek
    },
    currentWeekStartDate: weekStart,
    inventorySort: 'category' as const,
    past: [],
    future: []
  };
}

const demoState = createDemoState();

const HISTORY_LIMIT = 100;

function snapshotFromState(
  state: Pick<
    PlannerState,
    'ingredients' | 'meals' | 'profiles' | 'customCategories' | 'pinnedMealIds' | 'weekPlans' | 'currentWeekStartDate' | 'inventorySort'
  >
): PlannerSnapshot {
  return {
    ingredients: state.ingredients.map((item) => ({ ...item })),
    meals: state.meals.map((meal) => ({
      ...meal,
      ingredients: meal.ingredients.map((ingredient) => ({ ...ingredient }))
    })),
    profiles: state.profiles.map((profile) => ({ ...profile })),
    customCategories: [...state.customCategories],
    pinnedMealIds: [...state.pinnedMealIds],
    weekPlans: Object.fromEntries(Object.entries(state.weekPlans).map(([key, plan]) => [key, clonePlan(plan)])),
    currentWeekStartDate: state.currentWeekStartDate,
    inventorySort: state.inventorySort
  };
}

function commitWithHistory(
  state: PlannerState,
  patch: Partial<PlannerSnapshot> | null
): Partial<PlannerState> | PlannerState {
  if (!patch) return state;
  const nextPast = [...state.past, snapshotFromState(state)].slice(-HISTORY_LIMIT);
  return {
    ...patch,
    past: nextPast,
    future: []
  };
}

function ensurePlan(weekPlans: Record<string, WeekPlan>, weekStartDate: string): Record<string, WeekPlan> {
  if (weekPlans[weekStartDate]) return weekPlans;
  return { ...weekPlans, [weekStartDate]: createEmptyWeekPlan(weekStartDate) };
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => ({
      ...demoState,

      undo: () => {
        set((state) => {
          if (state.past.length === 0) return state;
          const previous = state.past[state.past.length - 1];
          const currentSnapshot = snapshotFromState(state);
          return {
            ...previous,
            past: state.past.slice(0, -1),
            future: [currentSnapshot, ...state.future].slice(0, HISTORY_LIMIT)
          };
        });
      },

      redo: () => {
        set((state) => {
          if (state.future.length === 0) return state;
          const next = state.future[0];
          const currentSnapshot = snapshotFromState(state);
          return {
            ...next,
            past: [...state.past, currentSnapshot].slice(-HISTORY_LIMIT),
            future: state.future.slice(1)
          };
        });
      },

      shiftWeek: (delta) => {
        const currentDate = parseISODate(get().currentWeekStartDate);
        const next = toISODate(addDays(currentDate, delta * 7));
        set((state) => ({
          currentWeekStartDate: next,
          weekPlans: ensurePlan(state.weekPlans, next)
        }));
      },

      setWeek: (weekStartDate) => {
        set((state) => ({
          currentWeekStartDate: weekStartDate,
          weekPlans: ensurePlan(state.weekPlans, weekStartDate)
        }));
      },

      setInventorySort: (value) => set({ inventorySort: value }),

      addProfile: ({ name, color }) => {
        set((state) => ({
          ...commitWithHistory(state, {
            profiles: [
              ...state.profiles,
              {
                id: createId('profile'),
                name: name.trim() || `Person ${state.profiles.length + 1}`,
                color,
                goalEnabled: false,
                createdAt: new Date().toISOString()
              }
            ]
          })
        }));
      },

      updateProfile: (id, updates) => {
        set((state) => ({
          ...commitWithHistory(state, {
            profiles: state.profiles.map((profile) => {
              if (profile.id !== id) return profile;
              const next: Profile = {
                ...profile,
                name: updates.name?.trim() || profile.name,
                color: updates.color ?? profile.color,
                goalEnabled: updates.goalEnabled ?? profile.goalEnabled,
                dailyCalorieGoal: updates.dailyCalorieGoal ?? profile.dailyCalorieGoal,
                dailyProteinGoalG: updates.dailyProteinGoalG ?? profile.dailyProteinGoalG,
                dailyCarbsGoalG: updates.dailyCarbsGoalG ?? profile.dailyCarbsGoalG,
                dailyFatGoalG: updates.dailyFatGoalG ?? profile.dailyFatGoalG
              };

              if (!next.goalEnabled) {
                next.dailyCalorieGoal = undefined;
                next.dailyProteinGoalG = undefined;
                next.dailyCarbsGoalG = undefined;
                next.dailyFatGoalG = undefined;
              }

              return next;
            })
          })
        }));
      },

      deleteProfile: (id) => {
        set((state) => {
          if (state.profiles.length <= 1) return state;

          const nextProfiles = state.profiles.filter((profile) => profile.id !== id);
          const nextWeekPlans: Record<string, WeekPlan> = {};

          Object.entries(state.weekPlans).forEach(([weekStart, plan]) => {
            const cloned = clonePlan(plan);
            (Object.keys(cloned.grid) as MealType[]).forEach((mealType) => {
              cloned.grid[mealType] = cloned.grid[mealType].map((cell) => {
                if (!cell) return null;
                const nextCell: CellEntry = {
                  family: cloneSlot(cell.family),
                  profiles: { ...cell.profiles }
                };
                delete nextCell.profiles[id];
                const hasAnyProfile = Object.values(nextCell.profiles).some((entry) => Boolean(entry));
                return nextCell.family || hasAnyProfile ? nextCell : null;
              });
            });
            nextWeekPlans[weekStart] = cloned;
          });

          return commitWithHistory(state, {
            profiles: nextProfiles,
            weekPlans: nextWeekPlans
          });
        });
      },

      addOrMergeIngredient: (input) => {
        set((state) => {
          const normalized = normalizeName(input.name);
          const existing = state.ingredients.find((ingredient) => normalizeName(ingredient.name) === normalized);

          if (existing) {
            return commitWithHistory(state, {
              ingredients: state.ingredients.map((ingredient) =>
                ingredient.id === existing.id
                  ? {
                      ...ingredient,
                      count: Math.max(0, ingredient.count + input.count),
                      servingsPerCount: normalizeServingsPerCount(input.servingsPerCount ?? ingredient.servingsPerCount),
                      category: input.category ?? ingredient.category,
                      expirationDate: input.expirationDate ?? ingredient.expirationDate,
                      notes: input.notes ?? ingredient.notes,
                      pinned: input.pinned ?? ingredient.pinned,
                      calories: input.calories ?? ingredient.calories,
                      protein_g: input.protein_g ?? ingredient.protein_g,
                      carbs_g: input.carbs_g ?? ingredient.carbs_g,
                      fat_g: input.fat_g ?? ingredient.fat_g
                    }
                  : ingredient
              )
            });
          }

          const ingredient: Ingredient = {
            id: input.id ?? createId('ingredient'),
            createdAt: new Date().toISOString(),
            name: input.name,
            category: CATEGORIES.includes(input.category) ? input.category : 'Other',
            count: Math.max(0, input.count),
            servingsPerCount: normalizeServingsPerCount(input.servingsPerCount),
            expirationDate: input.expirationDate,
            notes: input.notes,
            pinned: input.pinned,
            calories: input.calories,
            protein_g: input.protein_g,
            carbs_g: input.carbs_g,
            fat_g: input.fat_g
          };

          return commitWithHistory(state, { ingredients: [ingredient, ...state.ingredients] });
        });
      },

      addCustomCategory: (category) => {
        const trimmed = category.trim();
        if (!trimmed) return;
        set((state) => {
          const exists = [...CATEGORIES, ...state.customCategories].some(
            (item) => item.toLowerCase() === trimmed.toLowerCase()
          );
          if (exists) return state;
          return commitWithHistory(state, {
            customCategories: [...state.customCategories, trimmed]
          });
        });
      },

      updateIngredient: (id, updates) => {
        set((state) =>
          commitWithHistory(state, {
            ingredients: state.ingredients.map((ingredient) =>
              ingredient.id === id
                ? {
                    ...ingredient,
                    ...updates,
                    count: updates.count === undefined ? ingredient.count : Math.max(0, updates.count),
                    servingsPerCount:
                      updates.servingsPerCount === undefined
                        ? ingredient.servingsPerCount
                        : normalizeServingsPerCount(updates.servingsPerCount)
                  }
                : ingredient
            )
          })
        );
      },

      deleteIngredient: (id) => {
        set((state) =>
          commitWithHistory(state, {
            ingredients: state.ingredients.filter((ingredient) => ingredient.id !== id)
          })
        );
      },

      adjustIngredientCount: (id, delta) => {
        set((state) =>
          commitWithHistory(state, {
            ingredients: state.ingredients.map((ingredient) =>
              ingredient.id === id ? { ...ingredient, count: Math.max(0, roundCount(ingredient.count + delta)) } : ingredient
            )
          })
        );
      },

      toggleIngredientPinned: (id) => {
        set((state) =>
          commitWithHistory(state, {
            ingredients: state.ingredients.map((ingredient) =>
              ingredient.id === id ? { ...ingredient, pinned: !ingredient.pinned } : ingredient
            )
          })
        );
      },

      clearInventory: () => set((state) => commitWithHistory(state, { ingredients: [] })),
      clearCurrentWeekAndRestoreInventory: () => {
        set((state) => {
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const current = weekPlans[state.currentWeekStartDate];
          const restoredIngredients = restoreWeekIngredients(state.ingredients, current);
          weekPlans[state.currentWeekStartDate] = createEmptyWeekPlan(state.currentWeekStartDate);
          return commitWithHistory(state, {
            ingredients: restoredIngredients,
            weekPlans
          });
        });
      },

      addMeal: (input) => {
        const meal: Meal = {
          id: input.id ?? createId('meal'),
          createdAt: new Date().toISOString(),
          name: input.name,
          ingredients: input.ingredients,
          servingsDefault: input.servingsDefault,
          caloriesPerServing: input.caloriesPerServing,
          pinned: input.pinned
        };

        set((state) =>
          commitWithHistory(state, {
            meals: [meal, ...state.meals],
            pinnedMealIds: meal.pinned ? [...state.pinnedMealIds, meal.id] : state.pinnedMealIds
          })
        );
      },

      updateMeal: (id, updates) => {
        set((state) =>
          commitWithHistory(state, {
            meals: state.meals.map((meal) => (meal.id === id ? { ...meal, ...updates } : meal))
          })
        );
      },

      deleteMeal: (id) => {
        set((state) =>
          commitWithHistory(state, {
            meals: state.meals.filter((meal) => meal.id !== id),
            pinnedMealIds: state.pinnedMealIds.filter((mealId) => mealId !== id)
          })
        );
      },

      toggleMealPinned: (id) => {
        set((state) => {
          const isPinned = state.pinnedMealIds.includes(id);
          return commitWithHistory(state, {
            meals: state.meals.map((meal) => (meal.id === id ? { ...meal, pinned: !isPinned } : meal)),
            pinnedMealIds: isPinned ? state.pinnedMealIds.filter((mealId) => mealId !== id) : [...state.pinnedMealIds, id]
          });
        });
      },

      movePinnedMeal: (mealId, direction) => {
        set((state) => {
          const index = state.pinnedMealIds.findIndex((id) => id === mealId);
          if (index < 0) return state;
          const target = direction === 'left' ? index - 1 : index + 1;
          if (target < 0 || target >= state.pinnedMealIds.length) return state;
          const next = [...state.pinnedMealIds];
          [next[index], next[target]] = [next[target], next[index]];
          return commitWithHistory(state, { pinnedMealIds: next });
        });
      },

      dropIngredientToCell: (address, ingredientId) => {
        set((state) => {
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          const ingredient = state.ingredients.find((item) => item.id === ingredientId);
          if (!ingredient) return state;

          const existing = getSlot(plan, address);
          const current = existing ?? defaultSlotEntry();
          if (!existing) {
            current.servings = Math.max(1, Math.round(ingredient.servingsPerCount ?? 1));
          }
          current.ingredientRefs = addIngredientRef(current.ingredientRefs, {
            ingredientId: ingredient.id,
            name: ingredient.name,
            qty: 1
          });
          setSlot(plan, address, current);

          weekPlans[state.currentWeekStartDate] = plan;
          const deltaCount = servingsToCountDelta(1, ingredient.servingsPerCount);

          return commitWithHistory(state, {
            weekPlans,
            ingredients: state.ingredients.map((item) =>
              item.id === ingredient.id ? { ...item, count: roundCount(Math.max(0, item.count - deltaCount)) } : item
            )
          });
        });
      },

      dropMealToCell: (address, mealId) => {
        set((state) => {
          const meal = state.meals.find((item) => item.id === mealId);
          if (!meal) return state;

          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          const existing = getSlot(plan, address);
          const current = existing ?? defaultSlotEntry();
          current.mealId = meal.id;
          current.adHocMealName = undefined;
          current.servings = current.servings || meal.servingsDefault || 2;

          const ingredients = existing
            ? adjustInventoryForIngredientRefs(state.ingredients, existing.ingredientRefs, 'restore')
            : state.ingredients.map((ingredient) => ({ ...ingredient }));

          const servingScale = current.servings / Math.max(1, meal.servingsDefault || 1);
          current.ingredientRefs = [];

          meal.ingredients.forEach((item) => {
            const qty = Math.max(0.01, Math.round(Math.max(1, item.qty ?? 1) * servingScale * 100) / 100);
            const normalizedItemName = normalizeName(item.name);
            const matched = ingredients.find((ingredient) => normalizeName(ingredient.name) === normalizedItemName);

            current.ingredientRefs = addIngredientRef(current.ingredientRefs, {
              ingredientId: matched?.id,
              name: item.name,
              qty
            });

            if (matched) {
              const deltaCount = servingsToCountDelta(qty, matched.servingsPerCount);
              matched.count = roundCount(Math.max(0, matched.count - deltaCount));
            }
          });

          setSlot(plan, address, current);
          weekPlans[state.currentWeekStartDate] = plan;

          return commitWithHistory(state, {
            weekPlans,
            ingredients
          });
        });
      },

      moveOrSwapCell: (source, target) => {
        set((state) => {
          if (slotKey(source) === slotKey(target) && source.day === target.day && source.mealType === target.mealType) {
            return state;
          }

          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          const sourceEntry = getSlot(plan, source);
          if (!sourceEntry) return state;

          const targetEntry = getSlot(plan, target);
          setSlot(plan, source, targetEntry);
          setSlot(plan, target, sourceEntry);

          weekPlans[state.currentWeekStartDate] = plan;
          return commitWithHistory(state, { weekPlans });
        });
      },

      clearCell: (address) => {
        set((state) => {
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          setSlot(plan, address, null);
          weekPlans[state.currentWeekStartDate] = plan;
          return commitWithHistory(state, { weekPlans });
        });
      },

      removeCellToInventory: (address) => {
        set((state) => {
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          const slot = getSlot(plan, address);
          if (!slot) return state;
          setSlot(plan, address, null);
          weekPlans[state.currentWeekStartDate] = plan;
          const ingredients = adjustInventoryForIngredientRefs(state.ingredients, slot.ingredientRefs, 'restore');
          return commitWithHistory(state, { weekPlans, ingredients });
        });
      },

      removeIngredientRefFromCell: (address, index) => {
        set((state) => {
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          const slot = getSlot(plan, address);
          if (!slot) return state;
          if (index < 0 || index >= slot.ingredientRefs.length) return state;

          const [removedRef] = slot.ingredientRefs.splice(index, 1);
          if (!removedRef) return state;
          slot.mealId = undefined;
          slot.adHocMealName = undefined;

          if (slot.ingredientRefs.length === 0) {
            setSlot(plan, address, null);
          } else {
            setSlot(plan, address, slot);
          }

          weekPlans[state.currentWeekStartDate] = plan;
          const ingredients = adjustInventoryForIngredientRefs(state.ingredients, [removedRef], 'restore');
          return commitWithHistory(state, { weekPlans, ingredients });
        });
      },

      duplicateCell: (source, target) => {
        set((state) => {
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          const sourceEntry = getSlot(plan, source);
          if (!sourceEntry) return state;
          setSlot(plan, target, sourceEntry);
          weekPlans[state.currentWeekStartDate] = plan;
          return commitWithHistory(state, { weekPlans });
        });
      },

      makeLeftovers: (address) => {
        set((state) => {
          if (address.day >= 6) return state;
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          const sourceEntry = getSlot(plan, address);
          if (!sourceEntry) return state;

          const leftovers = cloneSlot(sourceEntry);
          if (!leftovers) return state;
          leftovers.isLeftovers = true;

          setSlot(plan, { mealType: 'lunch', day: address.day + 1, targetType: address.targetType, profileId: address.profileId }, leftovers);
          weekPlans[state.currentWeekStartDate] = plan;
          return commitWithHistory(state, { weekPlans });
        });
      },

      setCellServings: (address, servings) => {
        set((state) => {
          const validServings = Math.max(1, Math.floor(servings));
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          const original = getSlot(plan, address);
          if (!original) return state;
          const current = original;
          const previousServings = Math.max(1, original?.servings || current.servings || 1);
          const nextIngredientRefs = scaleIngredientRefs(current.ingredientRefs, validServings / previousServings);
          current.servings = validServings;
          current.ingredientRefs = nextIngredientRefs;
          setSlot(plan, address, current);
          weekPlans[state.currentWeekStartDate] = plan;

          const originalRefs = original?.ingredientRefs ?? [];
          const allRefs = [...originalRefs, ...nextIngredientRefs];
          const uniqueKeys = Array.from(
            new Set(
              allRefs.map((ref) => (ref.ingredientId ? `id:${ref.ingredientId}` : `name:${normalizeName(ref.name)}`))
            )
          );

          const deltaRefs = uniqueKeys
            .map((key) => {
              const old = originalRefs.find((ref) => (ref.ingredientId ? `id:${ref.ingredientId}` : `name:${normalizeName(ref.name)}`) === key);
              const next = nextIngredientRefs.find(
                (ref) => (ref.ingredientId ? `id:${ref.ingredientId}` : `name:${normalizeName(ref.name)}`) === key
              );
              return {
                ingredientId: next?.ingredientId ?? old?.ingredientId,
                name: next?.name ?? old?.name ?? '',
                qty: Math.round(((next?.qty ?? 0) - (old?.qty ?? 0)) * 100) / 100
              };
            })
            .filter((item) => item.name && item.qty !== 0);

          const adjustedIngredients = state.ingredients.map((ingredient) => {
            let nextCount = ingredient.count;
            deltaRefs.forEach((deltaRef) => {
              const matchById = deltaRef.ingredientId && deltaRef.ingredientId === ingredient.id;
              const matchByName = !deltaRef.ingredientId && normalizeName(deltaRef.name) === normalizeName(ingredient.name);
              if (!matchById && !matchByName) return;
              const deltaCount = servingsToCountDelta(Math.abs(deltaRef.qty), ingredient.servingsPerCount);
              if (deltaRef.qty > 0) nextCount -= deltaCount;
              else nextCount += deltaCount;
            });
            return { ...ingredient, count: roundCount(Math.max(0, nextCount)) };
          });

          return commitWithHistory(state, { weekPlans, ingredients: adjustedIngredients });
        });
      },

      saveCellAsMeal: (address, mealName) => {
        const trimmed = mealName.trim();
        if (!trimmed) return;

        set((state) => {
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = weekPlans[state.currentWeekStartDate];
          const slot = getSlot(plan, address);
          if (!slot) return state;

          const meal: Meal = {
            id: createId('meal'),
            name: trimmed,
            ingredients: slot.ingredientRefs.map((item) => ({
              name: item.name,
              qty: item.qty
            })),
            servingsDefault: slot.servings || 2,
            pinned: true,
            createdAt: new Date().toISOString()
          };

          return commitWithHistory(state, {
            meals: [meal, ...state.meals],
            pinnedMealIds: [meal.id, ...state.pinnedMealIds]
          });
        });
      },

      mergeReceiptItems: (items) => {
        set((state) => {
          let ingredients = [...state.ingredients];

          items.forEach((item) => {
            const normalized = normalizeName(item.name);
            const found = ingredients.find((ingredient) => normalizeName(ingredient.name) === normalized);

            if (found) {
              ingredients = ingredients.map((ingredient) =>
                ingredient.id === found.id ? { ...ingredient, count: ingredient.count + Math.max(1, item.count) } : ingredient
              );
            } else {
              ingredients = [
                {
                  id: createId('ingredient'),
                  name: item.name,
                  category: item.category,
                  count: Math.max(1, item.count),
                  servingsPerCount: 1,
                  createdAt: new Date().toISOString()
                },
                ...ingredients
              ];
            }
          });

          return commitWithHistory(state, { ingredients });
        });
      },

      resetDemoData: () => {
        set((state) => commitWithHistory(state, createDemoState()));
      },

      importState: (payload) => {
        if (!payload || !payload.currentWeekStartDate || !payload.ingredients || !payload.meals || !payload.weekPlans) {
          return;
        }

        const profiles = payload.profiles && payload.profiles.length > 0 ? payload.profiles : baseProfiles();
        const primaryProfileId = profiles[0]?.id ?? createId('profile');

        const normalizedPlans: Record<string, WeekPlan> = {};
        Object.entries(payload.weekPlans).forEach(([key, plan]) => {
          normalizedPlans[key] = normalizeWeekPlan(plan, primaryProfileId);
        });

        set((state) =>
          commitWithHistory(state, {
            ingredients: payload.ingredients.map((item) => ({
              ...item,
              servingsPerCount: normalizeServingsPerCount(item.servingsPerCount)
            })),
            meals: payload.meals,
            profiles,
            customCategories: [
              ...new Set([
                ...(payload.customCategories ?? []),
                ...payload.ingredients
                  .map((item) => item.category)
                  .filter((category) => !CATEGORIES.some((base) => base.toLowerCase() === category.toLowerCase()))
              ])
            ],
            pinnedMealIds: payload.pinnedMealIds ?? [],
            weekPlans: normalizedPlans,
            currentWeekStartDate: payload.currentWeekStartDate,
            inventorySort: 'category'
          })
        );
      },

      getCurrentWeekPlan: () => {
        const state = get();
        return state.weekPlans[state.currentWeekStartDate] ?? createEmptyWeekPlan(state.currentWeekStartDate);
      }
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        ingredients: state.ingredients,
        meals: state.meals,
        profiles: state.profiles,
        customCategories: state.customCategories,
        pinnedMealIds: state.pinnedMealIds,
        weekPlans: state.weekPlans,
        currentWeekStartDate: state.currentWeekStartDate,
        inventorySort: state.inventorySort
      })
    }
  )
);
