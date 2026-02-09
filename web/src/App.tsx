import { useMemo, useRef, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { DAY_NAMES, MEAL_LABELS, MEAL_TYPES, CATEGORIES } from './constants';
import { CalendarCell } from './components/CalendarCell';
import { ContextMenu } from './components/ContextMenu';
import { FavoriteMealCard } from './components/FavoriteMealCard';
import { AiImportModal } from './components/AiImportModal';
import { IngredientModal } from './components/IngredientModal';
import { InventoryBubble } from './components/InventoryBubble';
import { MealModal } from './components/MealModal';
import { Modal } from './components/Modal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { usePlannerStore } from './store/usePlannerStore';
import type { Ingredient, IngredientCategory, Meal, MealType, PersonCellEntry, PlannerExportShape, Profile, WeekPlan } from './types';
import { addDays, formatDisplayDate, formatWeekLabel, parseISODate } from './utils/date';

interface SlotAddress {
  mealType: MealType;
  day: number;
  profileId: string;
}

interface SlotMenuState {
  type: 'slot';
  x: number;
  y: number;
  address: SlotAddress;
}

interface IngredientMenuState {
  type: 'ingredient';
  x: number;
  y: number;
  ingredient: Ingredient;
}

type MenuState = SlotMenuState | IngredientMenuState | null;

function emptyPlan(weekStartDate: string): WeekPlan {
  return {
    weekStartDate,
    grid: {
      breakfast: Array(7).fill(null),
      lunch: Array(7).fill(null),
      dinner: Array(7).fill(null),
      snack: Array(7).fill(null)
    }
  };
}

function parseSlotId(id: string): SlotAddress | null {
  const match = id.match(/^slot-(breakfast|lunch|dinner|snack)-([0-6])-(.+)$/);
  if (!match) return null;
  return {
    mealType: match[1] as MealType,
    day: Number(match[2]),
    profileId: match[3]
  };
}

function appError(message: string): void {
  window.alert(message);
}

function splitForExport(value: string, maxLen = 36): string[] {
  const words = value.split(' ');
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    if ((`${current} ${word}`).trim().length <= maxLen) {
      current = `${current} ${word}`.trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines;
}

export default function App() {
  const {
    ingredients,
    meals,
    profiles,
    pinnedMealIds,
    weekPlans,
    currentWeekStartDate,
    inventorySort,
    shiftWeek,
    setInventorySort,
    addProfile,
    updateProfile,
    deleteProfile,
    addOrMergeIngredient,
    updateIngredient,
    deleteIngredient,
    adjustIngredientCount,
    toggleIngredientPinned,
    clearInventory,
    addMeal,
    updateMeal,
    toggleMealPinned,
    movePinnedMeal,
    dropIngredientToCell,
    dropMealToCell,
    moveOrSwapCell,
    clearCell,
    duplicateCell,
    makeLeftovers,
    setCellServings,
    saveCellAsMeal,
    mergeReceiptItems,
    resetDemoData,
    importState
  } = usePlannerStore();

  const weekPlan = weekPlans[currentWeekStartDate] ?? emptyPlan(currentWeekStartDate);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);

  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [aiImportModalOpen, setAiImportModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileColor, setNewProfileColor] = useState('#14b8a6');

  const [contextMenu, setContextMenu] = useState<MenuState>(null);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<SlotAddress | null>(null);
  const [duplicateTargetDay, setDuplicateTargetDay] = useState(0);
  const [duplicateTargetMeal, setDuplicateTargetMeal] = useState<MealType>('dinner');
  const [duplicateTargetProfile, setDuplicateTargetProfile] = useState('');

  const [activeDragLabel, setActiveDragLabel] = useState<string>('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const mealById = useMemo(() => new Map(meals.map((meal) => [meal.id, meal])), [meals]);
  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);

  const pinnedMeals = useMemo(
    () => pinnedMealIds.map((id) => mealById.get(id)).filter((meal): meal is Meal => Boolean(meal)),
    [mealById, pinnedMealIds]
  );

  const groupedIngredients = useMemo(() => {
    const sorted = [...ingredients].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      if (inventorySort === 'expiry') {
        const aDate = a.expirationDate ? new Date(a.expirationDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.expirationDate ? new Date(b.expirationDate).getTime() : Number.MAX_SAFE_INTEGER;
        if (aDate !== bDate) return aDate - bDate;
      }

      return a.name.localeCompare(b.name);
    });

    return CATEGORIES.map((category) => ({
      category,
      items: sorted.filter((ingredient) => ingredient.category === category)
    })).filter((bucket) => bucket.items.length > 0);
  }, [ingredients, inventorySort]);

  const weekStart = parseISODate(currentWeekStartDate);

  function resolveMealName(entry: PersonCellEntry): string | undefined {
    if (entry.mealId) {
      return mealById.get(entry.mealId)?.name ?? entry.adHocMealName;
    }
    return entry.adHocMealName;
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function openSlotContextMenu(address: SlotAddress, x: number, y: number) {
    setContextMenu({ type: 'slot', x, y, address });
  }

  function openIngredientContextMenu(ingredient: Ingredient, x: number, y: number) {
    setContextMenu({ type: 'ingredient', x, y, ingredient });
  }

  async function handleExportImage() {
    const exportGrid = Object.fromEntries(
      MEAL_TYPES.map((mealType) => [
        mealType,
        weekPlan.grid[mealType].map((cell) => {
          if (!cell) return null;

          const mealsForCell = Object.entries(cell)
            .map(([profileId, personEntry]) => {
              if (!personEntry) return null;
              const profileName = profileById.get(profileId)?.name ?? 'Person';
              const mealName = resolveMealName(personEntry) ?? 'Meal';
              return `${profileName}: ${mealName}`;
            })
            .filter((value): value is string => Boolean(value));

          if (mealsForCell.length === 0) return null;

          const joinedName = splitForExport(mealsForCell.join(' | '), 34).join(' / ');
          const ingredientsForCell = Object.entries(cell)
            .flatMap(([profileId, personEntry]) => {
              if (!personEntry) return [];
              const profileName = profileById.get(profileId)?.name ?? 'Person';
              return personEntry.ingredientRefs.map((item) => ({
                name: `${profileName}: ${item.name}`,
                qty: item.qty
              }));
            });

          const servingTotal = Object.values(cell)
            .filter((entry): entry is PersonCellEntry => Boolean(entry))
            .reduce((sum, entry) => sum + (entry.servings || 1), 0);

          return {
            mealName: joinedName,
            adHocMealName: joinedName,
            ingredients: ingredientsForCell,
            assignedTo: 'split',
            servings: servingTotal,
            isLeftovers: Object.values(cell).some((entry) => Boolean(entry?.isLeftovers))
          };
        })
      ])
    );

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          weekStartDate: currentWeekStartDate,
          weekPlan: {
            grid: exportGrid
          },
          theme: {
            accent: 'teal'
          },
          layout: {
            width: 1520,
            height: 980
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Exporter service returned an error (${response.status})`);
      }

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `meal-plan-${currentWeekStartDate}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error(error);
      appError('Could not export image. Try restarting docker compose so web and exporter reconnect.');
    }
  }

  function handleExportJson() {
    const payload: PlannerExportShape = {
      ingredients,
      meals,
      profiles,
      pinnedMealIds,
      weekPlans,
      currentWeekStartDate
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `meal-bubble-data-${currentWeekStartDate}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function handleImportJson(file: File) {
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as PlannerExportShape;
      importState(payload);
    } catch (error) {
      console.error(error);
      appError('Invalid JSON file. Please choose a valid export file.');
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const label = (event.active.data.current?.label as string | undefined) ?? 'Dragging';
    setActiveDragLabel(label);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragLabel('');
    if (!event.over) return;

    const overAddress = parseSlotId(String(event.over.id));
    if (!overAddress) return;

    const dragType = event.active.data.current?.dragType;
    if (dragType === 'ingredient') {
      const ingredientId = String(event.active.data.current?.ingredientId ?? '');
      if (ingredientId) {
        dropIngredientToCell(overAddress, ingredientId);
      }
      return;
    }

    if (dragType === 'meal') {
      const mealId = String(event.active.data.current?.mealId ?? '');
      if (mealId) {
        dropMealToCell(overAddress, mealId);
      }
      return;
    }

    if (dragType === 'slot-content') {
      const source = event.active.data.current?.source as SlotAddress | undefined;
      if (source) {
        moveOrSwapCell(source, overAddress);
      }
    }
  }

  const slotMenuActions = useMemo(() => {
    if (!contextMenu || contextMenu.type !== 'slot') return [];
    const { address } = contextMenu;

    return [
      {
        id: 'servings',
        label: 'Set servings',
        onClick: () => {
          const value = window.prompt('Servings count?', '2');
          if (!value) return;
          const servings = Number(value);
          if (Number.isNaN(servings)) return;
          setCellServings(address, servings);
        }
      },
      {
        id: 'leftovers',
        label: 'Make leftovers (next day lunch)',
        onClick: () => makeLeftovers(address)
      },
      {
        id: 'duplicate',
        label: 'Duplicate to...',
        onClick: () => {
          setDuplicateSource(address);
          setDuplicateTargetDay(address.day);
          setDuplicateTargetMeal(address.mealType);
          setDuplicateTargetProfile(address.profileId);
          setDuplicateModalOpen(true);
        }
      },
      {
        id: 'save-meal',
        label: 'Save slot as Meal',
        onClick: () => {
          const name = window.prompt('Meal name');
          if (!name) return;
          saveCellAsMeal(address, name);
        }
      },
      {
        id: 'clear',
        label: 'Clear person slot',
        onClick: () => clearCell(address),
        tone: 'danger' as const
      }
    ];
  }, [clearCell, contextMenu, makeLeftovers, saveCellAsMeal, setCellServings]);

  const ingredientMenuActions = useMemo(() => {
    if (!contextMenu || contextMenu.type !== 'ingredient') return [];
    const ingredient = contextMenu.ingredient;

    return [
      {
        id: 'set-expiry',
        label: 'Set expiration date',
        onClick: () => {
          const value = window.prompt('Expiration date (YYYY-MM-DD)', ingredient.expirationDate ?? '');
          if (value === null) return;
          updateIngredient(ingredient.id, { expirationDate: value || undefined });
        }
      },
      {
        id: 'count-plus',
        label: 'Adjust count +1',
        onClick: () => adjustIngredientCount(ingredient.id, 1)
      },
      {
        id: 'count-minus',
        label: 'Adjust count -1',
        onClick: () => adjustIngredientCount(ingredient.id, -1)
      },
      {
        id: 'change-category',
        label: 'Change category',
        onClick: () => {
          const value = window.prompt(`Category: ${CATEGORIES.join(', ')}`, ingredient.category);
          if (!value) return;
          const normalized = value.toLowerCase();
          const category = CATEGORIES.find((item) => item.toLowerCase() === normalized) as IngredientCategory | undefined;
          if (!category) return;
          updateIngredient(ingredient.id, { category });
        }
      },
      {
        id: 'pin',
        label: ingredient.pinned ? 'Unpin ingredient' : 'Pin ingredient',
        onClick: () => toggleIngredientPinned(ingredient.id)
      },
      {
        id: 'delete',
        label: 'Delete ingredient',
        tone: 'danger' as const,
        onClick: () => {
          const confirmed = window.confirm(`Delete ${ingredient.name}?`);
          if (confirmed) deleteIngredient(ingredient.id);
        }
      }
    ];
  }, [adjustIngredientCount, contextMenu, deleteIngredient, toggleIngredientPinned, updateIngredient]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-gradient-to-b from-slate-100 via-cyan-50 to-white px-4 py-4 text-slate-800">
        <div className="mx-auto flex w-full max-w-[1750px] flex-col gap-4">
          <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
                  onClick={() => shiftWeek(-1)}
                >
                  Prev
                </button>
                <div className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-1.5 text-lg font-semibold text-cyan-900">
                  Week of {formatWeekLabel(currentWeekStartDate)}
                </div>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
                  onClick={() => shiftWeek(1)}
                >
                  Next
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  onClick={() => setReceiptModalOpen(true)}
                >
                  Scan Receipt
                </button>
                <button
                  type="button"
                  className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
                  onClick={() => setAiImportModalOpen(true)}
                >
                  AI Import Helper
                </button>
                <button
                  type="button"
                  className="rounded-md border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100"
                  onClick={() => setProfileModalOpen(true)}
                >
                  Profiles
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
                  onClick={() => {
                    setEditingIngredient(null);
                    setIngredientModalOpen(true);
                  }}
                >
                  Add Ingredient
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
                  onClick={() => {
                    setEditingMeal(null);
                    setMealModalOpen(true);
                  }}
                >
                  Add Meal
                </button>
                <button
                  type="button"
                  className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                  onClick={() => {
                    if (window.confirm('Clear all ingredients and counts?')) {
                      clearInventory();
                    }
                  }}
                >
                  Clear Inventory
                </button>
                <button
                  type="button"
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                  onClick={handleExportImage}
                >
                  Export to Image
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
                  onClick={handleExportJson}
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
                  onClick={() => importFileRef.current?.click()}
                >
                  Import JSON
                </button>
                <button
                  type="button"
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 hover:bg-amber-100"
                  onClick={() => {
                    if (window.confirm('Reset to demo data? This removes your current plan and inventory.')) {
                      resetDemoData();
                    }
                  }}
                >
                  Reset Demo Data
                </button>

                <input
                  ref={importFileRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    handleImportJson(file);
                    event.target.value = '';
                  }}
                />
              </div>
            </div>
          </header>

          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Pinned Favorites</h2>
              <div className="text-xs text-slate-500">Drag a meal card into a specific person lane in any calendar cell</div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {pinnedMeals.map((meal) => (
                <FavoriteMealCard
                  key={meal.id}
                  meal={meal}
                  isPinned={pinnedMealIds.includes(meal.id)}
                  onTogglePin={toggleMealPinned}
                  onMove={movePinnedMeal}
                  onEdit={(value) => {
                    setEditingMeal(value);
                    setMealModalOpen(true);
                  }}
                />
              ))}
            </div>
          </section>

          <main className="grid grid-cols-1 gap-4 xl:grid-cols-[330px_1fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Ingredient Bubbles</h2>
                <select
                  value={inventorySort}
                  onChange={(event) => setInventorySort(event.target.value as 'category' | 'expiry')}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="category">Sort: Category</option>
                  <option value="expiry">Sort: Soonest to expire</option>
                </select>
              </div>

              <div className="space-y-4">
                {groupedIngredients.map((group) => (
                  <div key={group.category}>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.category}</div>
                    <div className="space-y-2">
                      {group.items.map((ingredient) => (
                        <InventoryBubble
                          key={ingredient.id}
                          ingredient={ingredient}
                          onOpenEditor={(value) => {
                            setEditingIngredient(value);
                            setIngredientModalOpen(true);
                          }}
                          onOpenContextMenu={openIngredientContextMenu}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="grid grid-cols-8 gap-2">
                <div className="rounded-lg bg-slate-100 p-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Meals</div>
                {DAY_NAMES.map((name, day) => (
                  <div key={name} className="rounded-lg bg-cyan-50 p-2 text-center">
                    <div className="text-sm font-semibold text-cyan-800">{name}</div>
                    <div className="text-xs text-cyan-700">{formatDisplayDate(addDays(weekStart, day).toISOString().slice(0, 10))}</div>
                  </div>
                ))}

                {MEAL_TYPES.map((mealType) => (
                  <div key={`row-${mealType}`} className="contents">
                    <div className="flex items-center rounded-lg bg-slate-50 px-2 text-sm font-semibold text-slate-600">
                      {MEAL_LABELS[mealType]}
                    </div>
                    {Array.from({ length: 7 }).map((_, day) => (
                      <CalendarCell
                        key={`${mealType}-${day}`}
                        mealType={mealType}
                        day={day}
                        profiles={profiles}
                        entry={weekPlan.grid[mealType][day]}
                        resolveMealName={resolveMealName}
                        onSlotContextMenu={openSlotContextMenu}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>

        <ContextMenu
          open={Boolean(contextMenu && contextMenu.type === 'slot')}
          x={contextMenu?.x ?? 0}
          y={contextMenu?.y ?? 0}
          title="Person slot actions"
          actions={slotMenuActions}
          onClose={closeContextMenu}
        />

        <ContextMenu
          open={Boolean(contextMenu && contextMenu.type === 'ingredient')}
          x={contextMenu?.x ?? 0}
          y={contextMenu?.y ?? 0}
          title="Ingredient actions"
          actions={ingredientMenuActions}
          onClose={closeContextMenu}
        />

        <IngredientModal
          open={ingredientModalOpen}
          ingredient={editingIngredient}
          onClose={() => setIngredientModalOpen(false)}
          onSave={(values) => {
            if (editingIngredient) {
              updateIngredient(editingIngredient.id, values);
            } else {
              addOrMergeIngredient(values);
            }
          }}
        />

        <MealModal
          open={mealModalOpen}
          meal={editingMeal}
          onClose={() => setMealModalOpen(false)}
          onSave={(values) => {
            if (editingMeal) {
              const currentlyPinned = pinnedMealIds.includes(editingMeal.id);
              if (values.pinned !== currentlyPinned) {
                toggleMealPinned(editingMeal.id);
              }
              updateMeal(editingMeal.id, values);
            } else {
              addMeal(values);
            }
          }}
        />

        <ReceiptScannerModal open={receiptModalOpen} onClose={() => setReceiptModalOpen(false)} onImportItems={mergeReceiptItems} />
        <AiImportModal open={aiImportModalOpen} onClose={() => setAiImportModalOpen(false)} onImportItems={mergeReceiptItems} />

        <Modal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} title="Profiles" widthClassName="max-w-3xl">
          <div className="space-y-3">
            {profiles.map((profile) => (
              <div key={profile.id} className="grid grid-cols-12 items-center gap-2 rounded-md border border-slate-200 p-2">
                <input
                  value={profile.name}
                  onChange={(event) => updateProfile(profile.id, { name: event.target.value })}
                  className="col-span-7 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="color"
                  value={profile.color}
                  onChange={(event) => updateProfile(profile.id, { color: event.target.value })}
                  className="col-span-2 h-9 w-full rounded-md border border-slate-300"
                />
                <div className="col-span-2 text-xs" style={{ color: profile.color }}>
                  {profile.color}
                </div>
                <button
                  type="button"
                  disabled={profiles.length <= 1}
                  onClick={() => {
                    if (window.confirm(`Delete profile ${profile.name}?`)) {
                      deleteProfile(profile.id);
                    }
                  }}
                  className="col-span-1 rounded-md border border-red-300 px-2 py-1.5 text-xs text-red-700 disabled:opacity-40"
                >
                  Del
                </button>
              </div>
            ))}

            <div className="rounded-md border border-dashed border-slate-300 p-3">
              <div className="mb-2 text-sm font-semibold text-slate-700">Add profile</div>
              <div className="grid grid-cols-12 gap-2">
                <input
                  value={newProfileName}
                  onChange={(event) => setNewProfileName(event.target.value)}
                  placeholder="Name"
                  className="col-span-8 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="color"
                  value={newProfileColor}
                  onChange={(event) => setNewProfileColor(event.target.value)}
                  className="col-span-2 h-9 w-full rounded-md border border-slate-300"
                />
                <button
                  type="button"
                  className="col-span-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
                  onClick={() => {
                    if (!newProfileName.trim()) return;
                    addProfile({ name: newProfileName, color: newProfileColor });
                    setNewProfileName('');
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </Modal>

        <Modal open={duplicateModalOpen} onClose={() => setDuplicateModalOpen(false)} title="Duplicate Slot To">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Target Day</span>
              <select
                value={duplicateTargetDay}
                onChange={(event) => setDuplicateTargetDay(Number(event.target.value))}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {DAY_NAMES.map((name, day) => (
                  <option key={name} value={day}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Target Meal</span>
              <select
                value={duplicateTargetMeal}
                onChange={(event) => setDuplicateTargetMeal(event.target.value as MealType)}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {MEAL_TYPES.map((mealType) => (
                  <option key={mealType} value={mealType}>
                    {MEAL_LABELS[mealType]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Target Person</span>
              <select
                value={duplicateTargetProfile}
                onChange={(event) => setDuplicateTargetProfile(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDuplicateModalOpen(false)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
              onClick={() => {
                if (!duplicateSource || !duplicateTargetProfile) return;
                duplicateCell(duplicateSource, {
                  mealType: duplicateTargetMeal,
                  day: duplicateTargetDay,
                  profileId: duplicateTargetProfile
                });
                setDuplicateModalOpen(false);
              }}
            >
              Duplicate
            </button>
          </div>
        </Modal>
      </div>

      <DragOverlay>
        {activeDragLabel ? (
          <div className="rounded-md border border-slate-300 bg-white/95 px-3 py-1 text-sm font-semibold shadow-lg">{activeDragLabel}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
