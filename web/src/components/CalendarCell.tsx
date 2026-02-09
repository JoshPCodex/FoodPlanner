import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import type { CellEntry, MealType, PersonCellEntry, Profile } from '../types';
import { useLongPress } from '../utils/useLongPress';

interface SlotAddress {
  mealType: MealType;
  day: number;
  profileId: string;
}

interface CalendarCellProps {
  mealType: MealType;
  day: number;
  profiles: Profile[];
  entry: CellEntry | null;
  resolveMealName: (entry: PersonCellEntry) => string | undefined;
  onSlotContextMenu: (address: SlotAddress, x: number, y: number) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((char) => `${char}${char}`).join('') : clean;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return `rgba(148, 163, 184, ${alpha})`;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface SlotLaneProps {
  mealType: MealType;
  day: number;
  profile: Profile;
  personEntry: PersonCellEntry | null;
  resolveMealName: (entry: PersonCellEntry) => string | undefined;
  onSlotContextMenu: (address: SlotAddress, x: number, y: number) => void;
}

function SlotLane({ mealType, day, profile, personEntry, resolveMealName, onSlotContextMenu }: SlotLaneProps) {
  const address: SlotAddress = { mealType, day, profileId: profile.id };

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `slot-${mealType}-${day}-${profile.id}`,
    data: { ...address }
  });

  const moveDraggable = useDraggable({
    id: `slot-content-${mealType}-${day}-${profile.id}`,
    data: {
      dragType: 'slot-content',
      source: address,
      label: `${profile.name}: ${personEntry ? resolveMealName(personEntry) ?? 'Meal' : 'Empty'}`
    },
    disabled: !personEntry
  });

  const longPress = useLongPress((x, y) => onSlotContextMenu(address, x, y));

  const laneTint = hexToRgba(profile.color, 0.11);
  const laneBorder = hexToRgba(profile.color, 0.4);

  return (
    <div
      ref={setDropRef}
      className={clsx('rounded-md border p-1.5 transition', isOver && 'ring-2 ring-emerald-300')}
      style={{ backgroundColor: laneTint, borderColor: laneBorder }}
      onContextMenu={(event) => {
        event.preventDefault();
        onSlotContextMenu(address, event.clientX, event.clientY);
      }}
      {...longPress}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-semibold" style={{ color: profile.color }}>
          {profile.name}
        </span>
        <span className="text-[10px] text-slate-500">{personEntry ? `Servings ${personEntry.servings}` : 'Empty'}</span>
      </div>

      {!personEntry ? (
        <div className="min-h-9 rounded border border-dashed border-slate-300 bg-white/50 px-2 py-1 text-[11px] text-slate-500">
          Drop meal/ingredient
        </div>
      ) : (
        <div className="space-y-1">
          <button
            ref={moveDraggable.setNodeRef}
            type="button"
            className={clsx(
              'inline-flex max-w-full items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-left text-[11px] font-semibold text-emerald-900',
              moveDraggable.isDragging && 'opacity-50'
            )}
            style={{ transform: CSS.Transform.toString(moveDraggable.transform) }}
            {...moveDraggable.listeners}
            {...moveDraggable.attributes}
            title="Drag to move or swap with another person slot"
          >
            <span className="truncate">{resolveMealName(personEntry) ?? 'Meal'}</span>
          </button>

          <div className="flex flex-wrap gap-1">
            {personEntry.ingredientRefs.map((ingredient, index) => (
              <span key={`${ingredient.name}-${index}`} className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-700">
                {ingredient.name}
                {ingredient.qty > 1 ? ` x${ingredient.qty}` : ''}
              </span>
            ))}
          </div>

          {personEntry.isLeftovers && <div className="text-[10px] font-semibold text-amber-700">Leftovers</div>}
        </div>
      )}
    </div>
  );
}

export function CalendarCell({ mealType, day, profiles, entry, resolveMealName, onSlotContextMenu }: CalendarCellProps) {
  return (
    <div className="min-h-32 rounded-lg border border-slate-200 bg-white p-1.5">
      <div className="space-y-1">
        {profiles.map((profile) => (
          <SlotLane
            key={`slot-${mealType}-${day}-${profile.id}`}
            mealType={mealType}
            day={day}
            profile={profile}
            personEntry={entry?.[profile.id] ?? null}
            resolveMealName={resolveMealName}
            onSlotContextMenu={onSlotContextMenu}
          />
        ))}
      </div>
    </div>
  );
}
