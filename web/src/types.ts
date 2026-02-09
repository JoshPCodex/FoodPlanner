export type IngredientCategory = 'Protein' | 'Dairy' | 'Produce' | 'Pantry' | 'Other';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Profile {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  count: number;
  expirationDate?: string;
  pinned?: boolean;
  notes?: string;
  createdAt: string;
}

export interface MealIngredient {
  name: string;
  category?: IngredientCategory;
  qty?: number;
}

export interface Meal {
  id: string;
  name: string;
  ingredients: MealIngredient[];
  servingsDefault: number;
  pinned?: boolean;
  createdAt: string;
}

export interface IngredientRef {
  ingredientId?: string;
  name: string;
  qty: number;
}

export interface PersonCellEntry {
  profileId: string;
  mealId?: string;
  adHocMealName?: string;
  ingredientRefs: IngredientRef[];
  servings: number;
  notes?: string;
  isLeftovers?: boolean;
}

export type CellEntry = Record<string, PersonCellEntry | null>;

export interface WeekPlan {
  weekStartDate: string;
  grid: Record<MealType, Array<CellEntry | null>>;
}

export interface ReceiptDraftItem {
  id: string;
  name: string;
  category: IngredientCategory;
  count: number;
}

export interface PlannerExportShape {
  ingredients: Ingredient[];
  meals: Meal[];
  profiles: Profile[];
  pinnedMealIds: string[];
  weekPlans: Record<string, WeekPlan>;
  currentWeekStartDate: string;
}
