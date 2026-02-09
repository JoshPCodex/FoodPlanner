import type { IngredientCategory, MealType } from './types';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack'
};
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const CATEGORIES: IngredientCategory[] = ['Protein', 'Dairy', 'Produce', 'Pantry', 'Other'];

export const CATEGORY_STYLES: Record<IngredientCategory, string> = {
  Protein: 'border-orange-300 bg-orange-50 text-orange-900',
  Dairy: 'border-sky-300 bg-sky-50 text-sky-900',
  Produce: 'border-green-300 bg-green-50 text-green-900',
  Pantry: 'border-amber-300 bg-amber-50 text-amber-900',
  Other: 'border-violet-300 bg-violet-50 text-violet-900'
};
