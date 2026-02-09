import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import type { CellEntry, MealType, Profile, SlotEntry } from '../types';
import { useLongPress } from '../utils/useLongPress';

export interface SlotAddress {
  mealType: MealType;
  day: number;
  targetType: 'family' | 'profile';
  profileId?: string;
}

interface CalendarCellProps {
  mealType: MealType;
  day: number;
  profiles: Profile[];
  entry: CellEntry | null;
  activeDragType: string | null;
  resolveMealName: (entry: SlotEntry) => string | undefined;
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

interface SlotCardProps {
  address: SlotAddress;
  label: string;
  tint?: string;
  slot: SlotEntry;
  resolveMealName: (entry: SlotEntry) => string | undefined;
  onSlotContextMenu: (address: SlotAddress, x: number, y: number) => void;
}

function SlotCard({ address, label, tint, slot, resolveMealName, onSlotContextMenu }: SlotCardProps) {
  const moveDraggable = useDraggable({
    id: `slot-content-${address.mealType}-${address.day}-${address.targetType}${address.profileId ? `-${address.profileId}` : ''}`,
    data: {
      dragType: 'slot-content',
      source: address,
      label: `${label}: ${resolveMealName(slot) ?? 'Meal'}`
    }
  });

  const longPress = useLongPress((x, y) => onSlotContextMenu(address, x, y));

  return (
    <div
      className="rounded-md border p-1.5"
      style={{
        backgroundColor: tint ? hexToRgba(tint, 0.1) : '#f8fafc',
        borderColor: tint ? hexToRgba(tint, 0.45) : '#cbd5e1'
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onSlotContextMenu(address, event.clientX, event.clientY);
      }}
      {...longPress}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-semibold" style={{ color: tint ?? '#0f172a' }}>
          {label}
        </span>
        <span className="text-[10px] text-slate-500">Servings {slot.servings}</span>
      </div>

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
      >
        <span className="truncate">{resolveMealName(slot) ?? 'Meal'}</span>
      </button>

      <div className="mt-1 flex flex-wrap gap-1">
        {slot.ingredientRefs.map((ingredient, index) => (
          <span key={`${ingredient.name}-${index}`} className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-700">
            {ingredient.name}
            {ingredient.qty > 1 ? ` x${ingredient.qty}` : ''}
          </span>
        ))}
      </div>

      {slot.isLeftovers && <div className="mt-1 text-[10px] font-semibold text-amber-700">Leftovers</div>}
    </div>
  );
}

interface DropTargetProps {
  id: string;
  className: string;
  label: string;
  active: boolean;
  tint?: string;
}

function DropTarget({ id, className, label, active, tint }: DropTargetProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        className,
        'rounded-md border border-dashed p-1 text-[10px] font-semibold text-center transition',
        active ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        isOver ? 'border-emerald-400 bg-emerald-100 text-emerald-800' : 'border-slate-300 bg-white/80 text-slate-500'
      )}
      style={
        tint
          ? {
              backgroundColor: isOver ? '#dcfce7' : hexToRgba(tint, 0.16),
              borderColor: isOver ? '#34d399' : hexToRgba(tint, 0.5),
              color: isOver ? '#065f46' : tint
            }
          : undefined
      }
    >
      {label}
    </div>
  );
}

export function CalendarCell({ mealType, day, profiles, entry, activeDragType, resolveMealName, onSlotContextMenu }: CalendarCellProps) {
  const familySlot = entry?.family ?? null;
  const personalSlots = profiles
    .map((profile) => ({ profile, slot: entry?.profiles?.[profile.id] ?? null }))
    .filter((item) => Boolean(item.slot)) as Array<{ profile: Profile; slot: SlotEntry }>;
  const showAssignmentOverlay = activeDragType === 'ingredient' || activeDragType === 'meal';
  const showMoveOverlay = activeDragType === 'slot-content';

  return (
    <div className="group relative min-h-32 rounded-lg border border-slate-200 bg-white p-1.5">
      <div className="space-y-1">
        {familySlot ? (
          <SlotCard
            address={{ mealType, day, targetType: 'family' }}
            label="Family"
            slot={familySlot}
            resolveMealName={resolveMealName}
            onSlotContextMenu={onSlotContextMenu}
          />
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-2 py-2 text-[11px] text-slate-500">Family</div>
        )}

        {personalSlots.map(({ profile, slot }) => (
          <SlotCard
            key={`slot-${mealType}-${day}-${profile.id}`}
            address={{ mealType, day, targetType: 'profile', profileId: profile.id }}
            label={profile.name}
            tint={profile.color}
            slot={slot}
            resolveMealName={resolveMealName}
            onSlotContextMenu={onSlotContextMenu}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-1.5">
        <div
          className={clsx(
            'h-full w-full rounded-md transition',
            showAssignmentOverlay || showMoveOverlay ? 'opacity-100' : 'opacity-0',
            (showAssignmentOverlay || showMoveOverlay) && 'group-hover:opacity-100'
          )}
        >
          <div className="grid h-full grid-cols-2 gap-1">
            <DropTarget
              id={`slot-${mealType}-${day}-family`}
              className="h-full"
              label="Family"
              active={showAssignmentOverlay || showMoveOverlay}
            />

            <div className="grid h-full gap-1" style={{ gridTemplateRows: `repeat(${Math.max(1, profiles.length)}, minmax(0, 1fr))` }}>
              {profiles.map((profile) => (
                <DropTarget
                  key={`drop-${mealType}-${day}-${profile.id}`}
                  id={`slot-${mealType}-${day}-profile-${profile.id}`}
                  className="h-full"
                  label={profile.name}
                  active={showAssignmentOverlay || showMoveOverlay}
                  tint={profile.color}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
