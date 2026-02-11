import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES } from '../constants';
import { parseReceiptText } from '../utils/receipt';
import type { IngredientCategory, ReceiptDraftItem } from '../types';
import { Modal } from './Modal';

interface ReceiptScannerModalProps {
  open: boolean;
  onClose: () => void;
  onImportItems: (items: ReceiptDraftItem[]) => void;
}

export function ReceiptScannerModal({ open, onClose, onImportItems }: ReceiptScannerModalProps) {
  const [previewSrc, setPreviewSrc] = useState<string>('');
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState('');
  const [items, setItems] = useState<ReceiptDraftItem[]>([]);

  useEffect(() => {
    if (!open) {
      setPreviewSrc('');
      setOcrStatus('idle');
      setOcrProgress(0);
      setOcrText('');
      setItems([]);
    }
  }, [open]);

  const statusLabel = useMemo(() => {
    if (ocrStatus === 'running') return `Scanning... ${Math.round(ocrProgress * 100)}%`;
    if (ocrStatus === 'done') return 'Scan complete. Review lines before adding.';
    if (ocrStatus === 'error') return 'OCR failed. You can still edit/add items manually.';
    return 'Upload a receipt image to start OCR.';
  }, [ocrProgress, ocrStatus]);

  async function runOcr(imageDataUrl: string) {
    setOcrStatus('running');
    setOcrProgress(0);

    try {
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(imageDataUrl, 'eng', {
        logger: (message) => {
          if (message.status === 'recognizing text' && typeof message.progress === 'number') {
            setOcrProgress(message.progress);
          }
        }
      });

      const text = result.data.text ?? '';
      const parsed = parseReceiptText(text);

      setOcrText(text);
      setItems(parsed);
      setOcrStatus('done');
    } catch (error) {
      console.error(error);
      setOcrStatus('error');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Scan Receipt" widthClassName="max-w-4xl">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-panel space-y-3 rounded-xl p-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Upload receipt image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const src = String(reader.result ?? '');
                  setPreviewSrc(src);
                  runOcr(src);
                };
                reader.readAsDataURL(file);
              }}
              className="frost-input w-full px-3 py-2"
            />
          </label>

          {previewSrc ? (
            <img src={previewSrc} alt="Receipt preview" className="max-h-80 w-full rounded-xl border border-white/70 object-contain" />
          ) : (
            <div className="glass-panel flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-slate-500">
              Receipt preview will appear here
            </div>
          )}

          <div className="glass-panel rounded-lg px-3 py-2 text-sm text-slate-700">{statusLabel}</div>

          {ocrText && (
            <details className="glass-panel rounded-lg p-2 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold">Raw OCR text</summary>
              <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap">{ocrText}</pre>
            </details>
          )}
        </div>

        <div className="glass-panel space-y-3 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Editable parsed items</h3>
            <button
              type="button"
              onClick={() =>
                setItems((current) => [
                  ...current,
                  {
                    id: `manual-${Math.random().toString(36).slice(2, 9)}`,
                    name: '',
                    category: 'Other',
                    count: 1
                  }
                ])
              }
              className="btn-glass btn-sm"
            >
              + Add Row
            </button>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
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
                  placeholder="Item name"
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

                <button
                  type="button"
                  onClick={() => setItems((current) => current.filter((line) => line.id !== item.id))}
                  className="btn-glass btn-sm btn-danger col-span-1"
                >
                  x
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-glass btn-md" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-glass btn-md btn-primary"
              onClick={() => {
                const cleaned = items
                  .map((item) => ({ ...item, name: item.name.trim() }))
                  .filter((item) => item.name.length > 0);
                if (cleaned.length === 0) return;
                onImportItems(cleaned);
                onClose();
              }}
            >
              Add to Inventory
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
