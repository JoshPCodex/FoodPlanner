import { useMemo, useState } from 'react';
import type { IngredientCategory, ReceiptDraftItem } from '../types';
import { AI_INVENTORY_PROMPT, parseInventoryImportText } from '../utils/inventoryImport';
import { CATEGORIES } from '../constants';
import { Modal } from './Modal';

interface AiImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportItems: (items: ReceiptDraftItem[]) => void;
}

export function AiImportModal({ open, onClose, onImportItems }: AiImportModalProps) {
  const [inputText, setInputText] = useState('');
  const [items, setItems] = useState<ReceiptDraftItem[]>([]);

  const hasItems = items.length > 0;

  const parsedCount = useMemo(() => items.reduce((sum, item) => sum + item.count, 0), [items]);

  return (
    <Modal open={open} onClose={onClose} title="AI Inventory Helper" widthClassName="max-w-5xl">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">1) Copy this prompt into ChatGPT</h3>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(AI_INVENTORY_PROMPT);
                } catch {
                  window.alert('Copy failed. You can manually copy the prompt text.');
                }
              }}
            >
              Copy Prompt
            </button>
          </div>

          <textarea
            value={AI_INVENTORY_PROMPT}
            readOnly
            className="h-80 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs"
          />

          <p className="text-xs text-slate-600">
            Add your receipt/fridge/grocery photos in ChatGPT with this prompt. Then paste the returned lines on the right.
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-700">2) Paste AI output and import</h3>

          <textarea
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            placeholder={'egg x12\nbanana x5\nchicken breast x4\nmilk'}
            className="h-44 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
          />

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              onClick={() => {
                const parsed = parseInventoryImportText(inputText);
                setItems(parsed);
              }}
            >
              Parse List
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              onClick={() => {
                setInputText('');
                setItems([]);
              }}
            >
              Clear
            </button>
          </div>

          <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
            Parsed items: {items.length} | Total quantity units: {parsedCount}
          </div>

          <div className="max-h-56 space-y-2 overflow-auto pr-1">
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2">
                <input
                  value={item.name}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((line) => (line.id === item.id ? { ...line, name: event.target.value } : line))
                    )
                  }
                  className="col-span-6 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />

                <input
                  type="number"
                  min={1}
                  value={item.count}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((line) =>
                        line.id === item.id ? { ...line, count: Math.max(1, Number(event.target.value)) } : line
                      )
                    )
                  }
                  className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />

                <select
                  value={item.category}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((line) =>
                        line.id === item.id ? { ...line, category: event.target.value as IngredientCategory } : line
                      )
                    )
                  }
                  className="col-span-3 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="col-span-1 rounded-md border border-red-200 text-sm text-red-600"
                  onClick={() => setItems((current) => current.filter((line) => line.id !== item.id))}
                >
                  x
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              Cancel
            </button>
            <button
              type="button"
              disabled={!hasItems}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              onClick={() => {
                const cleaned = items.map((item) => ({ ...item, name: item.name.trim() })).filter((item) => item.name.length > 0);
                if (cleaned.length === 0) return;
                onImportItems(cleaned);
                setInputText('');
                setItems([]);
                onClose();
              }}
            >
              Import to Inventory
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
