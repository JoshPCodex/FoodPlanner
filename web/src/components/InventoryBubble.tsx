import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { CATEGORY_STYLES } from '../constants';
import type { Ingredient } from '../types';
import { isExpiringSoon } from '../utils/date';
import { useLongPress } from '../utils/useLongPress';

interface InventoryBubbleProps {
  ingredient: Ingredient;
  onOpenEditor: (ingredient: Ingredient) => void;
  onOpenContextMenu: (ingredient: Ingredient, x: number, y: number) => void;
}

export function InventoryBubble({ ingredient, onOpenEditor, onOpenContextMenu }: InventoryBubbleProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ingredient-${ingredient.id}`,
    data: {
      dragType: 'ingredient',
      ingredientId: ingredient.id,
      label: ingredient.name
    }
  });

  const longPress = useLongPress((x, y) => onOpenContextMenu(ingredient, x, y));

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onOpenEditor(ingredient)}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenContextMenu(ingredient, event.clientX, event.clientY);
      }}
      {...longPress}
      {...listeners}
      {...attributes}
      className={clsx(
        'glass-panel relative flex w-full items-center justify-between gap-3 rounded-full border px-3 py-2 text-left text-sm font-semibold shadow-bubble transition',
        CATEGORY_STYLES[ingredient.category],
        ingredient.count === 0 && 'border-slate-300 bg-slate-100 text-slate-500 opacity-55',
        isExpiringSoon(ingredient.expirationDate) && 'ring-2 ring-amber-300',
        isDragging && 'opacity-50'
      )}
      style={{ transform: CSS.Transform.toString(transform) }}
      title="Drag to calendar"
    >
      <span className="relative z-10 truncate">{ingredient.name}</span>
      <span className="relative z-10 flex items-center gap-1">
        {ingredient.pinned && <span className="rounded-full bg-slate-900 px-1.5 text-[10px] text-white">PIN</span>}
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs shadow-sm">x{ingredient.count}</span>
      </span>
    </button>
  );
}
