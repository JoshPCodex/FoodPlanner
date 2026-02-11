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
        <div className="glass-panel space-y-3 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">1) Copy this prompt into ChatGPT</h3>
            <button
              type="button"
              className="btn-glass btn-sm"
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
            className="frost-input h-80 w-full bg-white/70 px-3 py-2 font-mono text-xs"
          />

          <p className="text-xs text-slate-600">
            Use this prompt with photos OR raw pasted receipt text in ChatGPT, then paste the returned lines on the right.
          </p>
        </div>

        <div className="glass-panel space-y-3 rounded-xl p-3">
          <h3 className="text-sm font-semibold text-slate-700">2) Paste AI output or pasted receipt text and import</h3>

          <textarea
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            placeholder={'egg x12\nbanana x5\nchicken breast x4\nmilk'}
            className="frost-input h-44 w-full px-3 py-2 font-mono text-sm"
          />

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-glass btn-md"
              onClick={() => {
                const parsed = parseInventoryImportText(inputText);
                setItems(parsed);
              }}
            >
              Parse List
            </button>
            <button
              type="button"
              className="btn-glass btn-md"
              onClick={() => {
                setInputText('');
                setItems([]);
              }}
            >
              Clear
            </button>
          </div>

          <div className="glass-panel rounded-lg p-2 text-xs text-slate-600">
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
                  className="frost-input col-span-6 px-2 py-1.5 text-sm"
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
                  className="frost-input col-span-2 px-2 py-1.5 text-sm"
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
                  className="frost-input col-span-3 px-2 py-1.5 text-sm"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="btn-glass btn-sm btn-danger col-span-1"
                  onClick={() => setItems((current) => current.filter((line) => line.id !== item.id))}
                >
                  x
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-glass btn-md">
              Cancel
            </button>
            <button
              type="button"
              disabled={!hasItems}
              className="btn-glass btn-md btn-primary disabled:opacity-40"
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
