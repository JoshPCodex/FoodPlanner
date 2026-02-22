import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, MouseSensor, TouchSensor, pointerWithin, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { DAY_NAMES, MEAL_LABELS, MEAL_TYPES, CATEGORIES } from './constants';
import { CalendarCell, SlotAddress } from './components/CalendarCell';
import { ContextMenu } from './components/ContextMenu';
import { FavoriteMealCard } from './components/FavoriteMealCard';
import { AiImportModal } from './components/AiImportModal';
import { IngredientModal } from './components/IngredientModal';
import { InventoryBubble } from './components/InventoryBubble';
import { MealModal } from './components/MealModal';
import { Modal } from './components/Modal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { usePlannerStore } from './store/usePlannerStore';
import type { Ingredient, IngredientCategory, Meal, MealType, PlannerExportShape, Profile, SlotEntry, WeekPlan } from './types';
import { addDays, formatDisplayDate, formatWeekLabel, parseISODate } from './utils/date';

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

interface NutritionTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

function emptyTotals(): NutritionTotals {
  return {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0
  };
}

function addTotals(a: NutritionTotals, b: NutritionTotals): NutritionTotals {
  return {
    calories: a.calories + b.calories,
    protein_g: a.protein_g + b.protein_g,
    carbs_g: a.carbs_g + b.carbs_g,
    fat_g: a.fat_g + b.fat_g
  };
}

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
  const familyMatch = id.match(/^(?:(?:mobile|desktop)-)?slot-(breakfast|lunch|dinner|snack)-([0-6])-family$/);
  if (familyMatch) {
    return {
      mealType: familyMatch[1] as MealType,
      day: Number(familyMatch[2]),
      targetType: 'family'
    };
  }

  const profileMatch = id.match(/^(?:(?:mobile|desktop)-)?slot-(breakfast|lunch|dinner|snack)-([0-6])-profile-(.+)$/);
  if (profileMatch) {
    return {
      mealType: profileMatch[1] as MealType,
      day: Number(profileMatch[2]),
      targetType: 'profile',
      profileId: profileMatch[3]
    };
  }

  return null;
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

function percent(current: number, total?: number): number {
  if (!total || total <= 0) return 0;
  const value = (current / total) * 100;
  return Math.max(0, Math.min(100, value));
}

function macroBar(value: number, goal?: number): string {
  return `${percent(value, goal)}%`;
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, parsed);
}

function normalizeMealKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
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
    past,
    future,
    undo,
    redo,
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
    clearCurrentWeekAndRestoreInventory,
    addMeal,
    updateMeal,
    deleteMeal,
    toggleMealPinned,
    movePinnedMeal,
    dropIngredientToCell,
    dropMealToCell,
    moveOrSwapCell,
    clearCell,
    removeCellToInventory,
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
  const [iphoneModalOpen, setIphoneModalOpen] = useState(false);

  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileColor, setNewProfileColor] = useState('#14b8a6');

  const [contextMenu, setContextMenu] = useState<MenuState>(null);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<SlotAddress | null>(null);
  const [duplicateTargetDay, setDuplicateTargetDay] = useState(0);
  const [duplicateTargetMeal, setDuplicateTargetMeal] = useState<MealType>('dinner');
  const [duplicateTargetType, setDuplicateTargetType] = useState<'family' | 'profile'>('family');
  const [duplicateTargetProfile, setDuplicateTargetProfile] = useState('');

  const [activeDragLabel, setActiveDragLabel] = useState<string>('');
  const [activeDragType, setActiveDragType] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 140,
        tolerance: 10
      }
    })
  );
  const { setNodeRef: setInventoryDropRef, isOver: isOverInventoryDrop } = useDroppable({ id: 'inventory-drop' });
  const inventoryWasOverDuringDragRef = useRef(false);
  const inventoryPanelRef = useRef<HTMLElement | null>(null);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const setInventoryDropNode = useCallback(
    (node: HTMLElement | null) => {
      setInventoryDropRef(node);
      inventoryPanelRef.current = node;
    },
    [setInventoryDropRef]
  );

  useEffect(() => {
    if (activeDragType !== 'slot-content') {
      inventoryWasOverDuringDragRef.current = false;
      return;
    }
    if (isOverInventoryDrop) {
      inventoryWasOverDuringDragRef.current = true;
    }
  }, [activeDragType, isOverInventoryDrop]);

  useEffect(() => {
    if (activeDragType !== 'slot-content') {
      pointerPositionRef.current = null;
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      pointerPositionRef.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [activeDragType]);

  const mealById = useMemo(() => new Map(meals.map((meal) => [meal.id, meal])), [meals]);

  const ingredientById = useMemo(() => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])), [ingredients]);
  const ingredientByNormalizedName = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.name.toLowerCase().trim(), ingredient])),
    [ingredients]
  );

  const pinnedMeals = useMemo(
    () => pinnedMealIds.map((id) => mealById.get(id)).filter((meal): meal is Meal => Boolean(meal)),
    [mealById, pinnedMealIds]
  );
  const allMeals = useMemo(() => [...meals].sort((a, b) => a.name.localeCompare(b.name)), [meals]);

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
  const dayIsoList = useMemo(
    () => DAY_NAMES.map((_, day) => addDays(weekStart, day).toISOString().slice(0, 10)),
    [weekStart]
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayIndexInWeek = dayIsoList.findIndex((value) => value === todayIso);
  const [mobileDayIndex, setMobileDayIndex] = useState(todayIndexInWeek >= 0 ? todayIndexInWeek : 0);

  useEffect(() => {
    setMobileDayIndex(todayIndexInWeek >= 0 ? todayIndexInWeek : 0);
  }, [currentWeekStartDate, todayIndexInWeek]);

  function resolveMealName(entry: SlotEntry): string | undefined {
    if (entry.mealId) {
      return mealById.get(entry.mealId)?.name ?? entry.adHocMealName;
    }
    return entry.adHocMealName;
  }

  function nutritionForIngredientRef(ref: { ingredientId?: string; name: string; qty: number }): NutritionTotals {
    const matched = ref.ingredientId ? ingredientById.get(ref.ingredientId) : ingredientByNormalizedName.get(ref.name.toLowerCase().trim());
    if (!matched) return emptyTotals();
    return {
      calories: (matched.calories ?? 0) * ref.qty,
      protein_g: (matched.protein_g ?? 0) * ref.qty,
      carbs_g: (matched.carbs_g ?? 0) * ref.qty,
      fat_g: (matched.fat_g ?? 0) * ref.qty
    };
  }

  function nutritionForSlot(slot: SlotEntry | null): NutritionTotals {
    if (!slot) return emptyTotals();
    return slot.ingredientRefs.reduce((sum, item) => addTotals(sum, nutritionForIngredientRef(item)), emptyTotals());
  }

  const dayTotalsByProfile = useMemo(() => {
    const totals: Record<number, Record<string, NutritionTotals>> = {};

    for (let day = 0; day < 7; day += 1) {
      totals[day] = {};
      profiles.forEach((profile) => {
        totals[day][profile.id] = emptyTotals();
      });

      MEAL_TYPES.forEach((mealType) => {
        const cell = weekPlan.grid[mealType][day];
        if (!cell) return;

        const familyTotals = nutritionForSlot(cell.family);
        profiles.forEach((profile) => {
          totals[day][profile.id] = addTotals(totals[day][profile.id], familyTotals);
        });

        profiles.forEach((profile) => {
          const personalTotals = nutritionForSlot(cell.profiles?.[profile.id] ?? null);
          totals[day][profile.id] = addTotals(totals[day][profile.id], personalTotals);
        });
      });
    }

    return totals;
  }, [profiles, weekPlan, ingredientById, ingredientByNormalizedName]);

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

          const labels: string[] = [];
          if (cell.family) {
            labels.push(`Family: ${resolveMealName(cell.family) ?? 'Meal'}`);
          }
          profiles.forEach((profile) => {
            const slot = cell.profiles?.[profile.id];
            if (slot) {
              labels.push(`${profile.name}: ${resolveMealName(slot) ?? 'Meal'}`);
            }
          });

          if (labels.length === 0) return null;

          const displayName = splitForExport(labels.join(' | '), 34).join(' / ');
          const ingredientsForCell: Array<{ name: string; qty: number }> = [];

          if (cell.family) {
            cell.family.ingredientRefs.forEach((item) => {
              ingredientsForCell.push({ name: `Family: ${item.name}`, qty: item.qty });
            });
          }

          profiles.forEach((profile) => {
            const slot = cell.profiles?.[profile.id];
            if (!slot) return;
            slot.ingredientRefs.forEach((item) => {
              ingredientsForCell.push({ name: `${profile.name}: ${item.name}`, qty: item.qty });
            });
          });

          const servings = labels.length;

          return {
            mealName: displayName,
            adHocMealName: displayName,
            ingredients: ingredientsForCell,
            assignedTo: 'split',
            servings,
            isLeftovers: false
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
    link.download = `refridgermate-data-${currentWeekStartDate}.json`;
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
    inventoryWasOverDuringDragRef.current = false;
    const label = (event.active.data.current?.label as string | undefined) ?? 'Dragging';
    const dragType = (event.active.data.current?.dragType as string | undefined) ?? null;
    setActiveDragLabel(label);
    setActiveDragType(dragType);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragLabel('');
    setActiveDragType(null);
    const dragType = event.active.data.current?.dragType;
    const overId = event.over ? String(event.over.id) : '';
    const pointer = pointerPositionRef.current;
    const panelRect = inventoryPanelRef.current?.getBoundingClientRect();
    const pointerInsideInventory = Boolean(
      pointer &&
      panelRect &&
      pointer.x >= panelRect.left &&
      pointer.x <= panelRect.right &&
      pointer.y >= panelRect.top &&
      pointer.y <= panelRect.bottom
    );

    if (
      dragType === 'slot-content' &&
      (overId.startsWith('inventory-drop') || (!event.over && inventoryWasOverDuringDragRef.current) || pointerInsideInventory)
    ) {
      const source = event.active.data.current?.source as SlotAddress | undefined;
      if (source) {
        removeCellToInventory(source);
      }
      inventoryWasOverDuringDragRef.current = false;
      pointerPositionRef.current = null;
      return;
    }

    if (!event.over) {
      inventoryWasOverDuringDragRef.current = false;
      pointerPositionRef.current = null;
      return;
    }

    const overAddress = parseSlotId(String(event.over.id));
    if (!overAddress) return;

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
        if (overAddress.targetType === 'family') {
          const value = window.prompt('Family servings for this slot? Leave blank to keep current value.', '2');
          if (value !== null && value.trim() !== '') {
            const servings = Number(value);
            if (Number.isFinite(servings) && servings > 0) {
              setCellServings(overAddress, servings);
            }
          }
        }
      }
      return;
    }

    if (dragType === 'slot-content') {
      const source = event.active.data.current?.source as SlotAddress | undefined;
      if (source) {
        moveOrSwapCell(source, overAddress);
      }
    }
    inventoryWasOverDuringDragRef.current = false;
    pointerPositionRef.current = null;
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
          setDuplicateTargetType(address.targetType);
          setDuplicateTargetProfile(address.profileId ?? profiles[0]?.id ?? '');
          setDuplicateModalOpen(true);
        }
      },
      {
        id: 'save-meal',
        label: 'Save section as Meal',
        onClick: () => {
          const name = window.prompt('Meal name');
          if (!name) return;
          saveCellAsMeal(address, name);
        }
      },
      {
        id: 'remove',
        label: 'Remove (return to inventory)',
        onClick: () => removeCellToInventory(address),
        tone: 'danger' as const
      },
      {
        id: 'clear',
        label: 'Clear without restoring',
        onClick: () => clearCell(address),
        tone: 'danger' as const
      }
    ];
  }, [clearCell, contextMenu, makeLeftovers, profiles, removeCellToInventory, saveCellAsMeal, setCellServings]);

  const ingredientMenuActions = useMemo(() => {
    if (!contextMenu || contextMenu.type !== 'ingredient') return [];
    const ingredient = contextMenu.ingredient;

    return [
      {
        id: 'edit',
        label: 'Edit ingredient',
        onClick: () => {
          setEditingIngredient(ingredient);
          setIngredientModalOpen(true);
        }
      },
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
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={`app-shell min-h-screen px-4 py-4 text-slate-800 ${activeDragType ? 'drag-active' : ''}`}>
        <div className="shell-content mx-auto flex w-full max-w-[1800px] flex-col gap-4">
          <header className="glass-panel-strong float-in stagger-1 rounded-2xl p-4">
            <div className="orbit-glow" />
            <div className="relative z-10 mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="hero-title">Refridgermate</div>
                <div className="hero-subtitle">Plan your week, balance nutrition, and keep inventory in sync.</div>
              </div>
            </div>
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-glass btn-sm"
                  onClick={() => shiftWeek(-1)}
                >
                  Prev
                </button>
                <div className="glass-panel rounded-full px-4 py-1.5 text-lg font-semibold text-cyan-900">
                  Week of {formatWeekLabel(currentWeekStartDate)}
                </div>
                <button
                  type="button"
                  className="btn-glass btn-sm"
                  onClick={() => shiftWeek(1)}
                >
                  Next
                </button>
                <button type="button" className="btn-glass btn-sm" onClick={undo} disabled={!canUndo}>
                  Undo
                </button>
                <button type="button" className="btn-glass btn-sm" onClick={redo} disabled={!canRedo}>
                  Redo
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-glass btn-md btn-primary"
                  onClick={() => setReceiptModalOpen(true)}
                >
                  Scan Receipt
                </button>
                <button
                  type="button"
                  className="btn-glass btn-md"
                  onClick={() => setAiImportModalOpen(true)}
                >
                  AI Import Helper
                </button>
                <button
                  type="button"
                  className="btn-glass btn-md"
                  onClick={() => setProfileModalOpen(true)}
                >
                  Profiles
                </button>
                <button
                  type="button"
                  className="btn-glass btn-md"
                  onClick={() => setIphoneModalOpen(true)}
                >
                  iPhone Setup
                </button>
                <button
                  type="button"
                  className="btn-glass btn-md"
                  onClick={() => {
                    setEditingIngredient(null);
                    setIngredientModalOpen(true);
                  }}
                >
                  Add Ingredient
                </button>
                <button
                  type="button"
                  className="btn-glass btn-md"
                  onClick={() => {
                    setEditingMeal(null);
                    setMealModalOpen(true);
                  }}
                >
                  Add Meal
                </button>
                <button
                  type="button"
                  className="btn-glass btn-md btn-danger"
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
                  className="btn-glass btn-md"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Empty this week and return planned ingredients back into inventory? This only clears the currently selected week.'
                      )
                    ) {
                      clearCurrentWeekAndRestoreInventory();
                    }
                  }}
                >
                  Empty Week
                </button>
                <button
                  type="button"
                  className="btn-glass btn-md btn-accent"
                  onClick={handleExportImage}
                >
                  Export to Image
                </button>
                <button
                  type="button"
                  className="btn-glass btn-md"
                  onClick={handleExportJson}
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  className="btn-glass btn-md"
                  onClick={() => importFileRef.current?.click()}
                >
                  Import JSON
                </button>
                <button
                  type="button"
                  className="btn-glass btn-md btn-warning"
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

          <section className="glass-panel float-in stagger-2 rounded-2xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="section-title">Pinned Favorites</h2>
              <div className="text-xs text-slate-500">Drag into a cell and use the hover assignment overlay to pick Family or person</div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {pinnedMeals.map((meal) => (
                <FavoriteMealCard
                  key={meal.id}
                  meal={meal}
                  isPinned={pinnedMealIds.includes(meal.id)}
                  onTogglePin={toggleMealPinned}
                  onMove={movePinnedMeal}
                  onDelete={(mealId) => {
                    const target = mealById.get(mealId);
                    if (!target) return;
                    if (window.confirm(`Delete meal ${target.name}?`)) {
                      deleteMeal(mealId);
                    }
                  }}
                  onEdit={(value) => {
                    setEditingMeal(value);
                    setMealModalOpen(true);
                  }}
                />
              ))}
            </div>
          </section>

          <section className="glass-panel rounded-2xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="section-title">All Meals</h2>
              <div className="text-xs text-slate-500">Edit, pin, or delete individual meals</div>
            </div>
            <div className="max-h-48 space-y-2 overflow-auto pr-1">
              {allMeals.map((meal) => (
                <div key={`all-meal-${meal.id}`} className="glass-panel flex items-center justify-between gap-2 rounded-xl px-2 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">{meal.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {meal.servingsDefault} servings{meal.caloriesPerServing ? ` • ${meal.caloriesPerServing} cal/serving` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" className="btn-glass btn-sm" onClick={() => toggleMealPinned(meal.id)}>
                      {pinnedMealIds.includes(meal.id) ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      type="button"
                      className="btn-glass btn-sm"
                      onClick={() => {
                        setEditingMeal(meal);
                        setMealModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-glass btn-sm btn-danger"
                      onClick={() => {
                        if (window.confirm(`Delete meal ${meal.name}?`)) deleteMeal(meal.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <main className="grid grid-cols-1 gap-4 xl:grid-cols-[330px_1fr]">
            <section
              ref={setInventoryDropNode}
              className={`glass-panel float-in stagger-3 rounded-2xl p-3 transition ${
                activeDragType === 'slot-content'
                  ? isOverInventoryDrop
                    ? 'ring-2 ring-emerald-400'
                    : 'ring-1 ring-emerald-200'
                  : ''
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="section-title">Ingredient Bubbles</h2>
                <select
                  value={inventorySort}
                  onChange={(event) => setInventorySort(event.target.value as 'category' | 'expiry')}
                  className="frost-input px-2 py-1 text-xs"
                >
                  <option value="category">Sort: Category</option>
                  <option value="expiry">Sort: Soonest to expire</option>
                </select>
              </div>
              <div
                className={`mb-2 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                  activeDragType === 'slot-content'
                    ? isOverInventoryDrop
                      ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white/70 text-slate-500'
                }`}
              >
                {activeDragType === 'slot-content'
                  ? 'Drop here to remove from calendar and restock inventory'
                  : 'Drag a planned slot here to restock inventory'}
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

            <section className="glass-panel float-in stagger-4 rounded-2xl p-3">
              <div className="mb-3 flex items-center justify-between lg:hidden">
                <h3 className="section-title">Day View</h3>
                <span className="text-xs text-slate-500">Swipe-style planner for mobile</span>
              </div>

              <div className="mb-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
                {DAY_NAMES.map((name, day) => {
                  const isSelected = day === mobileDayIndex;
                  const isToday = dayIsoList[day] === todayIso;
                  return (
                    <button
                      key={`mobile-day-${name}`}
                      type="button"
                      onClick={() => setMobileDayIndex(day)}
                      className={`btn-glass btn-sm whitespace-nowrap ${isSelected ? 'btn-primary' : ''} ${isToday ? 'ring-2 ring-cyan-300' : ''}`}
                    >
                      <span className="sm:hidden">{name}</span>
                      <span className="hidden sm:inline">
                        {name} {formatDisplayDate(dayIsoList[day])}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="calendar-grid space-y-2 rounded-2xl p-2 lg:hidden">
                <div className="glass-panel rounded-lg p-2 text-center">
                  <div className="text-sm font-semibold text-cyan-800">{DAY_NAMES[mobileDayIndex]}</div>
                  <div className="text-xs text-cyan-700">{formatDisplayDate(dayIsoList[mobileDayIndex])}</div>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    {profiles.map((profile) => {
                      const totals = dayTotalsByProfile[mobileDayIndex]?.[profile.id] ?? emptyTotals();
                      const calPct = percent(totals.calories, profile.goalEnabled ? profile.dailyCalorieGoal : undefined);
                      return (
                        <div key={`mobile-day-${mobileDayIndex}-profile-${profile.id}`} className="glass-panel rounded-lg px-1 py-1 text-left">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate text-[10px] font-semibold" style={{ color: profile.color }}>
                              {profile.name}
                            </span>
                            <span className="text-[10px] text-slate-600">
                              {Math.round(totals.calories)}
                              {profile.goalEnabled && profile.dailyCalorieGoal ? `/${profile.dailyCalorieGoal}` : ''}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-200">
                            <div className="h-full rounded" style={{ width: `${calPct}%`, backgroundColor: profile.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {MEAL_TYPES.map((mealType) => (
                  <div key={`mobile-row-${mealType}`} className="grid grid-cols-[88px_1fr] gap-2">
                    <div className="glass-panel flex items-center rounded-lg px-2 text-sm font-semibold text-slate-600">
                      {MEAL_LABELS[mealType]}
                    </div>
                    <CalendarCell
                      key={`mobile-${mealType}-${mobileDayIndex}`}
                      idPrefix="mobile"
                      mealType={mealType}
                      day={mobileDayIndex}
                      profiles={profiles}
                      entry={weekPlan.grid[mealType][mobileDayIndex]}
                      activeDragType={activeDragType}
                      resolveMealName={resolveMealName}
                      onSlotContextMenu={openSlotContextMenu}
                      onRemoveSlot={removeCellToInventory}
                    />
                  </div>
                ))}
              </div>

              <div className="calendar-grid hidden grid-cols-8 gap-2 rounded-2xl p-2 lg:grid">
                <div className="glass-panel rounded-lg p-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Meals</div>
                {DAY_NAMES.map((name, day) => {
                  const dayIso = dayIsoList[day];
                  const isToday = dayIso === todayIso;
                  return (
                  <div key={name} className={`glass-panel rounded-lg p-2 text-center ${isToday ? 'ring-2 ring-cyan-300' : ''}`}>
                    <div className="text-sm font-semibold text-cyan-800">{name}</div>
                    <div className="text-xs text-cyan-700">{formatDisplayDate(dayIso)}</div>
                    <div className="mt-1 space-y-1">
                      {profiles.map((profile) => {
                        const totals = dayTotalsByProfile[day]?.[profile.id] ?? emptyTotals();
                        const calPct = percent(totals.calories, profile.goalEnabled ? profile.dailyCalorieGoal : undefined);
                        const showMacros =
                          profile.goalEnabled &&
                          (profile.dailyProteinGoalG !== undefined || profile.dailyCarbsGoalG !== undefined || profile.dailyFatGoalG !== undefined);

                        return (
                          <div key={`day-${day}-profile-${profile.id}`} className="glass-panel rounded-lg px-1 py-1 text-left">
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate text-[10px] font-semibold" style={{ color: profile.color }}>
                                {profile.name}
                              </span>
                              <span className="text-[10px] text-slate-600">
                                {Math.round(totals.calories)}
                                {profile.goalEnabled && profile.dailyCalorieGoal ? `/${profile.dailyCalorieGoal}` : ''}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-200">
                              <div className="h-full rounded" style={{ width: `${calPct}%`, backgroundColor: profile.color }} />
                            </div>
                            {showMacros && (
                              <div className="mt-1 space-y-0.5">
                                <div className="h-1 overflow-hidden rounded bg-slate-200">
                                  <div className="h-full rounded bg-emerald-500" style={{ width: macroBar(totals.protein_g, profile.dailyProteinGoalG) }} />
                                </div>
                                <div className="h-1 overflow-hidden rounded bg-slate-200">
                                  <div className="h-full rounded bg-amber-500" style={{ width: macroBar(totals.carbs_g, profile.dailyCarbsGoalG) }} />
                                </div>
                                <div className="h-1 overflow-hidden rounded bg-slate-200">
                                  <div className="h-full rounded bg-rose-500" style={{ width: macroBar(totals.fat_g, profile.dailyFatGoalG) }} />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )})}

                {MEAL_TYPES.map((mealType) => (
                  <div key={`row-${mealType}`} className="contents">
                    <div className="glass-panel flex items-center rounded-lg px-2 text-sm font-semibold text-slate-600">
                      {MEAL_LABELS[mealType]}
                    </div>
                    {Array.from({ length: 7 }).map((_, day) => (
                      <CalendarCell
                        key={`${mealType}-${day}`}
                        idPrefix="desktop"
                        mealType={mealType}
                        day={day}
                        profiles={profiles}
                        entry={weekPlan.grid[mealType][day]}
                        activeDragType={activeDragType}
                        resolveMealName={resolveMealName}
                        onSlotContextMenu={openSlotContextMenu}
                        onRemoveSlot={removeCellToInventory}
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
          title="Section actions"
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
          onDelete={(mealId) => {
            const target = mealById.get(mealId);
            if (!target) return;
            if (window.confirm(`Delete meal ${target.name}?`)) {
              deleteMeal(mealId);
              setMealModalOpen(false);
              setEditingMeal(null);
            }
          }}
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
        <AiImportModal
          open={aiImportModalOpen}
          onClose={() => setAiImportModalOpen(false)}
          onImportData={({ items, meals: importedMeals }) => {
            if (items.length > 0) {
              mergeReceiptItems(items);
            }

            if (importedMeals.length > 0) {
              const existingMealNames = new Set(meals.map((meal) => normalizeMealKey(meal.name)));
              importedMeals.forEach((meal) => {
                const key = normalizeMealKey(meal.name);
                if (existingMealNames.has(key)) return;
                addMeal({
                  name: meal.name,
                  servingsDefault: Math.max(1, meal.servingsDefault || 2),
                  pinned: false,
                  ingredients: meal.ingredients
                });
                existingMealNames.add(key);
              });
            }
          }}
        />

        <Modal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} title="Profiles" widthClassName="max-w-4xl">
          <div className="space-y-3">
            {profiles.map((profile) => (
              <div key={profile.id} className="glass-panel space-y-2 rounded-xl p-3">
                <div className="grid grid-cols-12 items-center gap-2">
                  <input
                    value={profile.name}
                    onChange={(event) => updateProfile(profile.id, { name: event.target.value })}
                    className="frost-input col-span-6 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="color"
                    value={profile.color}
                    onChange={(event) => updateProfile(profile.id, { color: event.target.value })}
                    className="frost-input col-span-2 h-9 w-full"
                  />
                  <label className="col-span-3 flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(profile.goalEnabled)}
                      onChange={(event) =>
                        updateProfile(profile.id, {
                          goalEnabled: event.target.checked,
                          dailyCalorieGoal: event.target.checked ? profile.dailyCalorieGoal ?? 2000 : undefined,
                          dailyProteinGoalG: event.target.checked ? profile.dailyProteinGoalG : undefined,
                          dailyCarbsGoalG: event.target.checked ? profile.dailyCarbsGoalG : undefined,
                          dailyFatGoalG: event.target.checked ? profile.dailyFatGoalG : undefined
                        })
                      }
                    />
                    Enable goals
                  </label>
                  <button
                    type="button"
                    disabled={profiles.length <= 1}
                    onClick={() => {
                      if (window.confirm(`Delete profile ${profile.name}?`)) {
                        deleteProfile(profile.id);
                      }
                    }}
                    className="btn-glass btn-sm btn-danger col-span-1 disabled:opacity-40"
                  >
                    Del
                  </button>
                </div>

                {profile.goalEnabled && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Calories goal</span>
                      <input
                        type="number"
                        min={1}
                        value={profile.dailyCalorieGoal ?? ''}
                        onChange={(event) =>
                          updateProfile(profile.id, {
                            dailyCalorieGoal: Math.max(1, Number(event.target.value) || 0)
                          })
                        }
                        className="frost-input w-full px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Protein g</span>
                      <input
                        type="number"
                        min={0}
                        value={profile.dailyProteinGoalG ?? ''}
                        onChange={(event) =>
                          updateProfile(profile.id, {
                            dailyProteinGoalG: optionalNumber(event.target.value)
                          })
                        }
                        className="frost-input w-full px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Carbs g</span>
                      <input
                        type="number"
                        min={0}
                        value={profile.dailyCarbsGoalG ?? ''}
                        onChange={(event) =>
                          updateProfile(profile.id, {
                            dailyCarbsGoalG: optionalNumber(event.target.value)
                          })
                        }
                        className="frost-input w-full px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Fat g</span>
                      <input
                        type="number"
                        min={0}
                        value={profile.dailyFatGoalG ?? ''}
                        onChange={(event) =>
                          updateProfile(profile.id, {
                            dailyFatGoalG: optionalNumber(event.target.value)
                          })
                        }
                        className="frost-input w-full px-2 py-1.5 text-sm"
                      />
                    </label>
                  </div>
                )}
              </div>
            ))}

            <div className="glass-panel rounded-xl p-3">
              <div className="mb-2 text-sm font-semibold text-slate-700">Add profile</div>
              <div className="grid grid-cols-12 gap-2">
                <input
                  value={newProfileName}
                  onChange={(event) => setNewProfileName(event.target.value)}
                  placeholder="Name"
                  className="frost-input col-span-8 px-2 py-1.5 text-sm"
                />
                <input
                  type="color"
                  value={newProfileColor}
                  onChange={(event) => setNewProfileColor(event.target.value)}
                  className="frost-input col-span-2 h-9 w-full"
                />
                <button
                  type="button"
                  className="btn-glass btn-sm btn-primary col-span-2"
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

        <Modal open={duplicateModalOpen} onClose={() => setDuplicateModalOpen(false)} title="Duplicate Section To">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Target Day</span>
              <select
                value={duplicateTargetDay}
                onChange={(event) => setDuplicateTargetDay(Number(event.target.value))}
                className="frost-input w-full px-3 py-2"
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
                className="frost-input w-full px-3 py-2"
              >
                {MEAL_TYPES.map((mealType) => (
                  <option key={mealType} value={mealType}>
                    {MEAL_LABELS[mealType]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Section</span>
              <select
                value={duplicateTargetType}
                onChange={(event) => setDuplicateTargetType(event.target.value as 'family' | 'profile')}
                className="frost-input w-full px-3 py-2"
              >
                <option value="family">Family</option>
                <option value="profile">Person</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Target Person</span>
              <select
                value={duplicateTargetProfile}
                disabled={duplicateTargetType !== 'profile'}
                onChange={(event) => setDuplicateTargetProfile(event.target.value)}
                className="frost-input w-full px-3 py-2 disabled:opacity-40"
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
              className="btn-glass btn-md"
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-glass btn-md btn-primary"
              onClick={() => {
                if (!duplicateSource) return;
                duplicateCell(duplicateSource, {
                  mealType: duplicateTargetMeal,
                  day: duplicateTargetDay,
                  targetType: duplicateTargetType,
                  profileId: duplicateTargetType === 'profile' ? duplicateTargetProfile : undefined
                });
                setDuplicateModalOpen(false);
              }}
            >
              Duplicate
            </button>
          </div>
        </Modal>

        <Modal open={iphoneModalOpen} onClose={() => setIphoneModalOpen(false)} title="Run on iPhone" widthClassName="max-w-2xl">
          <div className="space-y-3 text-sm text-slate-700">
            <p>Use your iPhone on the same Wi-Fi network as your Mac.</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Start the app on your Mac: <code>docker compose up --build</code></li>
              <li>On your Mac go to System Settings, then Wi-Fi, then Details on your connected network, then TCP/IP. Use the <strong>IP address</strong> value.</li>
              <li>Terminal shortcut (optional): run <code>ipconfig getifaddr en0</code>.</li>
              <li>On iPhone Safari, open <code>http://YOUR-MAC-IP:5173</code></li>
              <li>Optional: tap Share, then Add to Home Screen for app-like launch.</li>
            </ol>
            <p className="text-xs text-slate-500">
              This runs entirely on your local network. Keep Docker running on your Mac while using the app from iPhone.
            </p>
          </div>
        </Modal>
      </div>

      <DragOverlay>
        {activeDragLabel ? (
          <div className="drag-overlay-badge drag-handle rounded-full px-3 py-1 text-sm font-semibold">{activeDragLabel}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
