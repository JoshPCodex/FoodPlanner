import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import type { Meal } from '../types';

interface FavoriteMealCardProps {
  meal: Meal;
  isPinned: boolean;
  onTogglePin: (mealId: string) => void;
  onMove: (mealId: string, direction: 'left' | 'right') => void;
  onEdit: (meal: Meal) => void;
}

export function FavoriteMealCard({ meal, isPinned, onTogglePin, onMove, onEdit }: FavoriteMealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `meal-${meal.id}`,
    data: {
      dragType: 'meal',
      mealId: meal.id,
      label: meal.name
    }
  });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'drag-handle glass-panel min-w-56 rounded-2xl p-3 transition hover:scale-[1.01] hover:shadow-2xl',
        isDragging && 'opacity-40'
      )}
      style={{ transform: CSS.Transform.toString(transform) }}
      {...listeners}
      {...attributes}
    >
      <button className="relative z-10 mb-2 text-left text-sm font-bold text-slate-800 hover:underline" type="button" onClick={() => onEdit(meal)}>
        {meal.name}
      </button>
      <div className="relative z-10 mb-3 flex flex-wrap gap-1 text-xs">
        {meal.ingredients.map((ingredient, index) => (
          <span key={`${meal.id}-ingredient-${index}`} className="pill">
            {ingredient.name}
            {(ingredient.qty ?? 1) > 1 ? ` x${ingredient.qty}` : ''}
          </span>
        ))}
      </div>
      <div className="relative z-10 flex items-center justify-between text-xs">
        <div className="flex gap-1">
          <button
            type="button"
            className="btn-glass btn-sm"
            onClick={() => onMove(meal.id, 'left')}
          >
            Left
          </button>
          <button
            type="button"
            className="btn-glass btn-sm"
            onClick={() => onMove(meal.id, 'right')}
          >
            Right
          </button>
        </div>

        <button
          type="button"
          className="btn-glass btn-sm"
          onClick={() => onTogglePin(meal.id)}
        >
          {isPinned ? 'Unpin' : 'Pin'}
        </button>
      </div>
    </div>
  );
}
