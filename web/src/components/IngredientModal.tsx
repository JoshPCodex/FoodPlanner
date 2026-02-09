import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES } from '../constants';
import type { Ingredient, IngredientCategory } from '../types';
import { Modal } from './Modal';

interface IngredientModalProps {
  open: boolean;
  ingredient?: Ingredient | null;
  onClose: () => void;
  onSave: (values: {
    name: string;
    category: IngredientCategory;
    count: number;
    expirationDate?: string;
    notes?: string;
    pinned?: boolean;
  }) => void;
}

export function IngredientModal({ open, ingredient, onClose, onSave }: IngredientModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<IngredientCategory>('Other');
  const [count, setCount] = useState(1);
  const [expirationDate, setExpirationDate] = useState('');
  const [notes, setNotes] = useState('');
  const [pinned, setPinned] = useState(false);

  const title = useMemo(() => (ingredient ? `Ingredient: ${ingredient.name}` : 'Add Ingredient'), [ingredient]);

  useEffect(() => {
    if (!open) return;
    if (ingredient) {
      setName(ingredient.name);
      setCategory(ingredient.category);
      setCount(ingredient.count);
      setExpirationDate(ingredient.expirationDate ?? '');
      setNotes(ingredient.notes ?? '');
      setPinned(Boolean(ingredient.pinned));
    } else {
      setName('');
      setCategory('Other');
      setCount(1);
      setExpirationDate('');
      setNotes('');
      setPinned(false);
    }
  }, [ingredient, open]);

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          onSave({
            name: name.trim(),
            category,
            count: Math.max(0, count),
            expirationDate: expirationDate || undefined,
            notes: notes || undefined,
            pinned
          });
          onClose();
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Ingredient name"
            required
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as IngredientCategory)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Count</span>
            <input
              type="number"
              min={0}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Expiration Date</span>
          <input
            type="date"
            value={expirationDate}
            onChange={(event) => setExpirationDate(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Optional notes"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
          Pin ingredient in list
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
          >
            Cancel
          </button>
          <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
