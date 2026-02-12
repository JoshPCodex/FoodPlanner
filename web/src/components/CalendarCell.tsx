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
  idPrefix: string;
  mealType: MealType;
  day: number;
  profiles: Profile[];
  entry: CellEntry | null;
  activeDragType: string | null;
  resolveMealName: (entry: SlotEntry) => string | undefined;
  onSlotContextMenu: (address: SlotAddress, x: number, y: number) => void;
  onRemoveSlot: (address: SlotAddress) => void;
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
  idPrefix: string;
  address: SlotAddress;
  label: string;
  tint?: string;
  slot: SlotEntry;
  resolveMealName: (entry: SlotEntry) => string | undefined;
  onSlotContextMenu: (address: SlotAddress, x: number, y: number) => void;
  onRemoveSlot: (address: SlotAddress) => void;
}

function SlotCard({ idPrefix, address, label, tint, slot, resolveMealName, onSlotContextMenu, onRemoveSlot }: SlotCardProps) {
  const moveDraggable = useDraggable({
    id: `${idPrefix}-slot-content-${address.mealType}-${address.day}-${address.targetType}${address.profileId ? `-${address.profileId}` : ''}`,
    data: {
      dragType: 'slot-content',
      source: address,
      label: `${label}: ${resolveMealName(slot) ?? 'Meal'}`
    }
  });

  const longPress = useLongPress((x, y) => onSlotContextMenu(address, x, y));

  return (
    <div
      className="glass-panel rounded-xl border p-1.5"
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
      <div className="relative z-10 mb-1 flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-semibold" style={{ color: tint ?? '#0f172a' }}>
          {label}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500">Servings {slot.servings}</span>
          <button
            type="button"
            className="btn-glass btn-sm text-[10px]"
            onClick={() => onRemoveSlot(address)}
            title="Remove from calendar and restock inventory"
          >
            Restock
          </button>
        </div>
      </div>

      <button
        ref={moveDraggable.setNodeRef}
        type="button"
        className={clsx(
          'drag-handle relative z-10 inline-flex max-w-full items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-left text-[11px] font-semibold text-emerald-900',
          moveDraggable.isDragging && 'opacity-50'
        )}
        style={{ transform: CSS.Transform.toString(moveDraggable.transform) }}
        {...moveDraggable.listeners}
        {...moveDraggable.attributes}
      >
        <span className="truncate">{resolveMealName(slot) ?? 'Meal'}</span>
      </button>

      <div className="relative z-10 mt-1 flex flex-wrap gap-1">
        {slot.ingredientRefs.map((ingredient, index) => (
          <span key={`${ingredient.name}-${index}`} className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-700">
            {ingredient.name}
            {ingredient.qty > 1 ? ` x${ingredient.qty}` : ''}
          </span>
        ))}
      </div>

      {slot.isLeftovers && <div className="relative z-10 mt-1 text-[10px] font-semibold text-amber-700">Leftovers</div>}
    </div>
  );
}

interface DropTargetProps {
  id: string;
  className: string;
  label: string;
  active: boolean;
  occupied?: boolean;
  occupiedHint?: string;
  mode: 'assign' | 'move';
  tint?: string;
}

function DropTarget({ id, className, label, active, tint, occupied = false, occupiedHint, mode }: DropTargetProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const statusText = mode === 'move' ? (occupied ? 'Swap' : 'Move') : occupied ? 'Add to occupied' : 'Assign';

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        className,
        'rounded-lg border p-1 text-[10px] font-semibold text-center transition',
        active ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        occupied ? 'border-solid' : 'border-dashed',
        isOver ? 'border-emerald-400 bg-emerald-100 text-emerald-800' : occupied ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-300 bg-white/80 text-slate-500'
      )}
      style={
        tint
          ? {
            backgroundColor: isOver ? '#dcfce7' : hexToRgba(tint, 0.16),
            borderColor: isOver ? '#34d399' : occupied ? hexToRgba(tint, 0.8) : hexToRgba(tint, 0.5),
            color: isOver ? '#065f46' : tint
          }
          : undefined
      }
    >
      <div>{label}</div>
      <div className="mt-0.5 text-[9px] font-medium opacity-90">{statusText}</div>
      {occupiedHint ? <div className="mt-0.5 hidden truncate text-[9px] opacity-85 sm:block">{occupiedHint}</div> : null}
    </div>
  );
}

export function CalendarCell({
  idPrefix,
  mealType,
  day,
  profiles,
  entry,
  activeDragType,
  resolveMealName,
  onSlotContextMenu,
  onRemoveSlot
}: CalendarCellProps) {
  const familySlot = entry?.family ?? null;
  const profileSlots = profiles.map((profile) => ({ profile, slot: entry?.profiles?.[profile.id] ?? null }));
  const personalSlots = profileSlots.filter((item) => Boolean(item.slot)) as Array<{ profile: Profile; slot: SlotEntry }>;
  const showAssignmentOverlay = activeDragType === 'ingredient' || activeDragType === 'meal';
  const showMoveOverlay = activeDragType === 'slot-content';
  const occupiedCount = (familySlot ? 1 : 0) + personalSlots.length;
  const overlayMode: 'assign' | 'move' = showMoveOverlay ? 'move' : 'assign';
  const overlayVisible = showAssignmentOverlay || showMoveOverlay;

  return (
    <div className="glass-panel group relative min-h-32 rounded-xl border p-1.5 hover:shadow-xl">
      {occupiedCount > 0 && !overlayVisible ? (
        <div className="absolute right-1.5 top-1.5 z-20 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
          {occupiedCount} planned
        </div>
      ) : null}
      <div
        className={clsx(
          'space-y-1 transition',
          overlayVisible ? 'pointer-events-none opacity-20 blur-[0.5px]' : 'opacity-100'
        )}
      >
        {familySlot ? (
          <SlotCard
            idPrefix={idPrefix}
            address={{ mealType, day, targetType: 'family' }}
            label="Family"
            slot={familySlot}
            resolveMealName={resolveMealName}
            onSlotContextMenu={onSlotContextMenu}
            onRemoveSlot={onRemoveSlot}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-2 py-2 text-[11px] text-slate-500">Family</div>
        )}

        {personalSlots.map(({ profile, slot }) => (
          <SlotCard
            idPrefix={idPrefix}
            key={`slot-${mealType}-${day}-${profile.id}`}
            address={{ mealType, day, targetType: 'profile', profileId: profile.id }}
            label={profile.name}
            tint={profile.color}
            slot={slot}
            resolveMealName={resolveMealName}
            onSlotContextMenu={onSlotContextMenu}
            onRemoveSlot={onRemoveSlot}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-1.5 z-20">
        <div
          className={clsx(
            'h-full w-full rounded-lg transition',
            overlayVisible ? 'opacity-100' : 'opacity-0',
            overlayVisible && 'group-hover:opacity-100'
          )}
        >
          <div className="grid h-full grid-cols-2 gap-1">
            <DropTarget
              id={`${idPrefix}-slot-${mealType}-${day}-family`}
              className="h-full"
              label="Family"
              active={showAssignmentOverlay || showMoveOverlay}
              occupied={Boolean(familySlot)}
              occupiedHint={familySlot ? resolveMealName(familySlot) ?? 'Meal' : undefined}
              mode={overlayMode}
            />

            <div className="grid h-full gap-1" style={{ gridTemplateRows: `repeat(${Math.max(1, profiles.length)}, minmax(0, 1fr))` }}>
              {profileSlots.map(({ profile, slot }) => (
                <DropTarget
                  key={`drop-${mealType}-${day}-${profile.id}`}
                  id={`${idPrefix}-slot-${mealType}-${day}-profile-${profile.id}`}
                  className="h-full"
                  label={profile.name}
                  active={showAssignmentOverlay || showMoveOverlay}
                  occupied={Boolean(slot)}
                  occupiedHint={slot ? resolveMealName(slot) ?? 'Meal' : undefined}
                  mode={overlayMode}
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
