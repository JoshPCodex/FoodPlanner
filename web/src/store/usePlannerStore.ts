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
  pinnedMealIds: string[];
  weekPlans: Record<string, WeekPlan>;
  currentWeekStartDate: string;
  inventorySort: 'category' | 'expiry';

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
  updateIngredient: (id: string, updates: Partial<Omit<Ingredient, 'id' | 'createdAt'>>) => void;
  deleteIngredient: (id: string) => void;
  adjustIngredientCount: (id: string, delta: number) => void;
  toggleIngredientPinned: (id: string) => void;
  clearInventory: () => void;

  addMeal: (input: Omit<Meal, 'id' | 'createdAt'> & { id?: string }) => void;
  updateMeal: (id: string, updates: Partial<Omit<Meal, 'id' | 'createdAt'>>) => void;
  deleteMeal: (id: string) => void;
  toggleMealPinned: (id: string) => void;
  movePinnedMeal: (mealId: string, direction: 'left' | 'right') => void;

  dropIngredientToCell: (address: SlotAddress, ingredientId: string) => void;
  dropMealToCell: (address: SlotAddress, mealId: string) => void;
  moveOrSwapCell: (source: SlotAddress, target: SlotAddress) => void;
  clearCell: (address: SlotAddress) => void;
  duplicateCell: (source: SlotAddress, target: SlotAddress) => void;
  makeLeftovers: (address: SlotAddress) => void;
  setCellServings: (address: SlotAddress, servings: number) => void;
  saveCellAsMeal: (address: SlotAddress, mealName: string) => void;

  mergeReceiptItems: (items: ReceiptDraftItem[]) => void;

  resetDemoData: () => void;
  importState: (payload: PlannerExportShape) => void;

  getCurrentWeekPlan: () => WeekPlan;
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
    ['chicken', 'Protein', 4],
    ['pork', 'Protein', 3],
    ['steak', 'Protein', 2],
    ['cheese', 'Dairy', 5],
    ['milk', 'Dairy', 2],
    ['eggs', 'Dairy', 12],
    ['lettuce', 'Produce', 2],
    ['carrots', 'Produce', 6],
    ['cucumber', 'Produce', 3],
    ['bread', 'Pantry', 2],
    ['penne', 'Pantry', 2],
    ['spaghetti', 'Pantry', 2]
  ].map(([name, category, count]) => ({
    id: createId('ingredient'),
    name: String(name),
    category: category as IngredientCategory,
    count: Number(count),
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
        { name: 'chicken', category: 'Protein', qty: 1 },
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
        { name: 'meatballs', category: 'Protein', qty: 1 }
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
        { name: 'cheese', category: 'Dairy', qty: 1 }
      ],
      createdAt: now
    }
  ];
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
  return {
    ingredients: baseIngredients(),
    meals,
    profiles,
    pinnedMealIds: meals.map((meal) => meal.id),
    weekPlans: {
      [weekStart]: createEmptyWeekPlan(weekStart)
    },
    currentWeekStartDate: weekStart,
    inventorySort: 'category' as const
  };
}

const demoState = createDemoState();

function ensurePlan(weekPlans: Record<string, WeekPlan>, weekStartDate: string): Record<string, WeekPlan> {
  if (weekPlans[weekStartDate]) return weekPlans;
  return { ...weekPlans, [weekStartDate]: createEmptyWeekPlan(weekStartDate) };
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => ({
      ...demoState,

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
        }));
      },

      updateProfile: (id, updates) => {
        set((state) => ({
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

          return {
            profiles: nextProfiles,
            weekPlans: nextWeekPlans
          };
        });
      },

      addOrMergeIngredient: (input) => {
        set((state) => {
          const normalized = normalizeName(input.name);
          const existing = state.ingredients.find((ingredient) => normalizeName(ingredient.name) === normalized);

          if (existing) {
            return {
              ingredients: state.ingredients.map((ingredient) =>
                ingredient.id === existing.id
                  ? {
                      ...ingredient,
                      count: Math.max(0, ingredient.count + input.count),
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
            };
          }

          const ingredient: Ingredient = {
            id: input.id ?? createId('ingredient'),
            createdAt: new Date().toISOString(),
            name: input.name,
            category: CATEGORIES.includes(input.category) ? input.category : 'Other',
            count: Math.max(0, input.count),
            expirationDate: input.expirationDate,
            notes: input.notes,
            pinned: input.pinned,
            calories: input.calories,
            protein_g: input.protein_g,
            carbs_g: input.carbs_g,
            fat_g: input.fat_g
          };

          return { ingredients: [ingredient, ...state.ingredients] };
        });
      },

      updateIngredient: (id, updates) => {
        set((state) => ({
          ingredients: state.ingredients.map((ingredient) =>
            ingredient.id === id
              ? {
                  ...ingredient,
                  ...updates,
                  count: updates.count === undefined ? ingredient.count : Math.max(0, updates.count)
                }
              : ingredient
          )
        }));
      },

      deleteIngredient: (id) => {
        set((state) => ({
          ingredients: state.ingredients.filter((ingredient) => ingredient.id !== id)
        }));
      },

      adjustIngredientCount: (id, delta) => {
        set((state) => ({
          ingredients: state.ingredients.map((ingredient) =>
            ingredient.id === id ? { ...ingredient, count: Math.max(0, ingredient.count + delta) } : ingredient
          )
        }));
      },

      toggleIngredientPinned: (id) => {
        set((state) => ({
          ingredients: state.ingredients.map((ingredient) =>
            ingredient.id === id ? { ...ingredient, pinned: !ingredient.pinned } : ingredient
          )
        }));
      },

      clearInventory: () => set({ ingredients: [] }),

      addMeal: (input) => {
        const meal: Meal = {
          id: input.id ?? createId('meal'),
          createdAt: new Date().toISOString(),
          name: input.name,
          ingredients: input.ingredients,
          servingsDefault: input.servingsDefault,
          pinned: input.pinned
        };

        set((state) => ({
          meals: [meal, ...state.meals],
          pinnedMealIds: meal.pinned ? [...state.pinnedMealIds, meal.id] : state.pinnedMealIds
        }));
      },

      updateMeal: (id, updates) => {
        set((state) => ({
          meals: state.meals.map((meal) => (meal.id === id ? { ...meal, ...updates } : meal))
        }));
      },

      deleteMeal: (id) => {
        set((state) => ({
          meals: state.meals.filter((meal) => meal.id !== id),
          pinnedMealIds: state.pinnedMealIds.filter((mealId) => mealId !== id)
        }));
      },

      toggleMealPinned: (id) => {
        set((state) => {
          const isPinned = state.pinnedMealIds.includes(id);
          return {
            meals: state.meals.map((meal) => (meal.id === id ? { ...meal, pinned: !isPinned } : meal)),
            pinnedMealIds: isPinned ? state.pinnedMealIds.filter((mealId) => mealId !== id) : [...state.pinnedMealIds, id]
          };
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
          return { pinnedMealIds: next };
        });
      },

      dropIngredientToCell: (address, ingredientId) => {
        set((state) => {
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          const ingredient = state.ingredients.find((item) => item.id === ingredientId);
          if (!ingredient) return state;

          const current = getSlot(plan, address) ?? defaultSlotEntry();
          current.ingredientRefs = addIngredientRef(current.ingredientRefs, {
            ingredientId: ingredient.id,
            name: ingredient.name,
            qty: 1
          });
          setSlot(plan, address, current);

          weekPlans[state.currentWeekStartDate] = plan;

          return {
            weekPlans,
            ingredients: state.ingredients.map((item) =>
              item.id === ingredient.id ? { ...item, count: Math.max(0, item.count - 1) } : item
            )
          };
        });
      },

      dropMealToCell: (address, mealId) => {
        set((state) => {
          const meal = state.meals.find((item) => item.id === mealId);
          if (!meal) return state;

          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          const current = getSlot(plan, address) ?? defaultSlotEntry();
          current.mealId = meal.id;
          current.adHocMealName = undefined;
          current.servings = current.servings || meal.servingsDefault || 2;

          const ingredients = state.ingredients.map((ingredient) => ({ ...ingredient }));

          meal.ingredients.forEach((item) => {
            const qty = Math.max(1, item.qty ?? 1);
            const normalizedItemName = normalizeName(item.name);
            const matched = ingredients.find((ingredient) => normalizeName(ingredient.name) === normalizedItemName);

            current.ingredientRefs = addIngredientRef(current.ingredientRefs, {
              ingredientId: matched?.id,
              name: item.name,
              qty
            });

            if (matched) {
              matched.count = Math.max(0, matched.count - qty);
            }
          });

          setSlot(plan, address, current);
          weekPlans[state.currentWeekStartDate] = plan;

          return {
            weekPlans,
            ingredients
          };
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
          return { weekPlans };
        });
      },

      clearCell: (address) => {
        set((state) => {
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          setSlot(plan, address, null);
          weekPlans[state.currentWeekStartDate] = plan;
          return { weekPlans };
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
          return { weekPlans };
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
          return { weekPlans };
        });
      },

      setCellServings: (address, servings) => {
        set((state) => {
          const validServings = Math.max(1, Math.floor(servings));
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          const current = getSlot(plan, address) ?? defaultSlotEntry();
          current.servings = validServings;
          setSlot(plan, address, current);
          weekPlans[state.currentWeekStartDate] = plan;
          return { weekPlans };
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

          return {
            meals: [meal, ...state.meals],
            pinnedMealIds: [meal.id, ...state.pinnedMealIds]
          };
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
                  createdAt: new Date().toISOString()
                },
                ...ingredients
              ];
            }
          });

          return { ingredients };
        });
      },

      resetDemoData: () => {
        set(() => ({ ...createDemoState() }));
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

        set(() => ({
          ingredients: payload.ingredients,
          meals: payload.meals,
          profiles,
          pinnedMealIds: payload.pinnedMealIds ?? [],
          weekPlans: normalizedPlans,
          currentWeekStartDate: payload.currentWeekStartDate,
          inventorySort: 'category'
        }));
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
        pinnedMealIds: state.pinnedMealIds,
        weekPlans: state.weekPlans,
        currentWeekStartDate: state.currentWeekStartDate,
        inventorySort: state.inventorySort
      })
    }
  )
);
