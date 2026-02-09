import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CATEGORIES, MEAL_TYPES } from '../constants';
import { addDays, parseISODate, startOfWeekMonday, toISODate } from '../utils/date';
import type {
  AssignedTo,
  CellEntry,
  Ingredient,
  IngredientCategory,
  IngredientRef,
  Meal,
  MealType,
  PlannerExportShape,
  ReceiptDraftItem,
  WeekPlan
} from '../types';

const STORAGE_KEY = 'meal-bubble-planner-v1';

interface CellAddress {
  mealType: MealType;
  day: number;
}

interface PlannerState {
  ingredients: Ingredient[];
  meals: Meal[];
  pinnedMealIds: string[];
  weekPlans: Record<string, WeekPlan>;
  currentWeekStartDate: string;
  inventorySort: 'category' | 'expiry';

  shiftWeek: (delta: number) => void;
  setWeek: (weekStartDate: string) => void;
  setInventorySort: (value: 'category' | 'expiry') => void;

  addOrMergeIngredient: (input: Omit<Ingredient, 'id' | 'createdAt'> & { id?: string }) => void;
  updateIngredient: (id: string, updates: Partial<Omit<Ingredient, 'id' | 'createdAt'>>) => void;
  deleteIngredient: (id: string) => void;
  adjustIngredientCount: (id: string, delta: number) => void;
  toggleIngredientPinned: (id: string) => void;

  addMeal: (input: Omit<Meal, 'id' | 'createdAt'> & { id?: string }) => void;
  updateMeal: (id: string, updates: Partial<Omit<Meal, 'id' | 'createdAt'>>) => void;
  deleteMeal: (id: string) => void;
  toggleMealPinned: (id: string) => void;
  movePinnedMeal: (mealId: string, direction: 'left' | 'right') => void;

  dropIngredientToCell: (address: CellAddress, ingredientId: string) => void;
  dropMealToCell: (address: CellAddress, mealId: string) => void;
  moveOrSwapCell: (source: CellAddress, target: CellAddress) => void;
  assignCell: (address: CellAddress, assignedTo: AssignedTo) => void;
  clearCell: (address: CellAddress) => void;
  duplicateCell: (source: CellAddress, target: CellAddress) => void;
  makeLeftovers: (address: CellAddress) => void;
  setCellServings: (address: CellAddress, servings: number) => void;
  saveCellAsMeal: (address: CellAddress, mealName: string) => void;

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

function defaultCellEntry(): CellEntry {
  return {
    ingredientRefs: [],
    assignedTo: 'both',
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

function cloneCell(entry: CellEntry | null): CellEntry | null {
  if (!entry) return null;
  return {
    ...entry,
    ingredientRefs: entry.ingredientRefs.map((ref) => ({ ...ref }))
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

function setCell(plan: WeekPlan, address: CellAddress, value: CellEntry | null): void {
  plan.grid[address.mealType][address.day] = value;
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

function createDemoState() {
  const weekStart = toISODate(startOfWeekMonday(new Date()));
  const meals = baseMeals();
  return {
    ingredients: baseIngredients(),
    meals,
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
                      pinned: input.pinned ?? ingredient.pinned
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
            pinned: input.pinned
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

          const current = getCell(plan, address) ?? defaultCellEntry();
          current.ingredientRefs = addIngredientRef(current.ingredientRefs, {
            ingredientId: ingredient.id,
            name: ingredient.name,
            qty: 1
          });
          setCell(plan, address, current);

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
          const current = getCell(plan, address) ?? defaultCellEntry();
          current.mealId = meal.id;
          current.adHocMealName = undefined;
          current.servings = current.servings || meal.servingsDefault || 2;

          const ingredients = state.ingredients.map((ingredient) => ({ ...ingredient }));

          meal.ingredients.forEach((item) => {
            const qty = Math.max(1, item.qty ?? 1);
            const normalizedName = normalizeName(item.name);
            const matched = ingredients.find((ingredient) => normalizeName(ingredient.name) === normalizedName);

            current.ingredientRefs = addIngredientRef(current.ingredientRefs, {
              ingredientId: matched?.id,
              name: item.name,
              qty
            });

            if (matched) {
              matched.count = Math.max(0, matched.count - qty);
            }
          });

          setCell(plan, address, current);
          weekPlans[state.currentWeekStartDate] = plan;

          return {
            weekPlans,
            ingredients
          };
        });
      },

      moveOrSwapCell: (source, target) => {
        set((state) => {
          if (source.day === target.day && source.mealType === target.mealType) return state;
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);

          const sourceCell = getCell(plan, source);
          if (!sourceCell) return state;
          const targetCell = getCell(plan, target);

          setCell(plan, source, cloneCell(targetCell));
          setCell(plan, target, cloneCell(sourceCell));

          weekPlans[state.currentWeekStartDate] = plan;
          return { weekPlans };
        });
      },

      assignCell: (address, assignedTo) => {
        set((state) => {
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          const current = getCell(plan, address) ?? defaultCellEntry();
          current.assignedTo = assignedTo;
          setCell(plan, address, current);
          weekPlans[state.currentWeekStartDate] = plan;
          return { weekPlans };
        });
      },

      clearCell: (address) => {
        set((state) => {
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          setCell(plan, address, null);
          weekPlans[state.currentWeekStartDate] = plan;
          return { weekPlans };
        });
      },

      duplicateCell: (source, target) => {
        set((state) => {
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          const sourceCell = getCell(plan, source);
          if (!sourceCell) return state;
          setCell(plan, target, cloneCell(sourceCell));
          weekPlans[state.currentWeekStartDate] = plan;
          return { weekPlans };
        });
      },

      makeLeftovers: (address) => {
        set((state) => {
          if (address.day >= 6) return state;
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          const sourceCell = getCell(plan, address);
          if (!sourceCell) return state;

          const leftovers = cloneCell(sourceCell);
          if (!leftovers) return state;
          leftovers.isLeftovers = true;
          leftovers.assignedTo = 'both';

          setCell(plan, { mealType: 'lunch', day: address.day + 1 }, leftovers);
          weekPlans[state.currentWeekStartDate] = plan;
          return { weekPlans };
        });
      },

      setCellServings: (address, servings) => {
        set((state) => {
          const validServings = Math.max(1, Math.floor(servings));
          const weekPlans = ensurePlan({ ...state.weekPlans }, state.currentWeekStartDate);
          const plan = clonePlan(weekPlans[state.currentWeekStartDate]);
          const current = getCell(plan, address) ?? defaultCellEntry();
          current.servings = validServings;
          setCell(plan, address, current);
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
          const cell = getCell(plan, address);
          if (!cell) return state;

          const meal: Meal = {
            id: createId('meal'),
            name: trimmed,
            ingredients: cell.ingredientRefs.map((item) => ({
              name: item.name,
              qty: item.qty
            })),
            servingsDefault: cell.servings || 2,
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

        set(() => ({
          ingredients: payload.ingredients,
          meals: payload.meals,
          pinnedMealIds: payload.pinnedMealIds ?? [],
          weekPlans: payload.weekPlans,
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
        pinnedMealIds: state.pinnedMealIds,
        weekPlans: state.weekPlans,
        currentWeekStartDate: state.currentWeekStartDate,
        inventorySort: state.inventorySort
      })
    }
  )
);
