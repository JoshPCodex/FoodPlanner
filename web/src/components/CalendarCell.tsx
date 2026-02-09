import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import type { CellEntry, MealType } from '../types';
import { useLongPress } from '../utils/useLongPress';

interface CalendarCellProps {
  mealType: MealType;
  day: number;
  mealName?: string;
  entry: CellEntry | null;
  onContextMenu: (mealType: MealType, day: number, x: number, y: number) => void;
}

function assignedLabel(value: CellEntry['assignedTo']) {
  if (value === 'me') return 'Me';
  if (value === 'wife') return 'Wife';
  return 'Both';
}

export function CalendarCell({ mealType, day, mealName, entry, onContextMenu }: CalendarCellProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `cell-${mealType}-${day}`,
    data: { mealType, day }
  });

  const moveDraggable = useDraggable({
    id: `cell-content-${mealType}-${day}`,
    data: {
      dragType: 'cell-content',
      source: { mealType, day },
      label: `${mealType}-${day}`
    },
    disabled: !entry
  });

  const longPress = useLongPress((x, y) => onContextMenu(mealType, day, x, y));

  return (
    <div
      ref={setDropRef}
      className={clsx(
        'min-h-32 rounded-lg border border-slate-200 bg-white p-2 transition',
        isOver && 'border-emerald-400 bg-emerald-50'
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(mealType, day, event.clientX, event.clientY);
      }}
      {...longPress}
    >
      {!entry ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-300">Drop here</div>
      ) : (
        <div className="flex h-full flex-col gap-2">
          {mealName && (
            <button
              ref={moveDraggable.setNodeRef}
              type="button"
              className={clsx(
                'inline-flex max-w-full items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-left text-xs font-semibold text-emerald-900',
                moveDraggable.isDragging && 'opacity-50'
              )}
              style={{ transform: CSS.Transform.toString(moveDraggable.transform) }}
              {...moveDraggable.listeners}
              {...moveDraggable.attributes}
              title="Drag to move or swap"
            >
              <span className="truncate">{mealName}</span>
            </button>
          )}

          <div className="flex flex-wrap gap-1">
            {entry.ingredientRefs.map((ingredient, index) => (
              <span key={`${ingredient.name}-${index}`} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                {ingredient.name}
                {ingredient.qty > 1 ? ` x${ingredient.qty}` : ''}
              </span>
            ))}
          </div>

          <div className="mt-auto flex items-center justify-between text-[11px] text-slate-500">
            <span>Servings: {entry.servings}</span>
            <span className="rounded bg-slate-200 px-1.5 py-0.5">{assignedLabel(entry.assignedTo)}</span>
          </div>

          {entry.isLeftovers && <div className="text-[11px] font-semibold text-amber-700">Leftovers</div>}
        </div>
      )}
    </div>
  );
}
