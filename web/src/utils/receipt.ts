import type { ReceiptDraftItem } from '../types';
import { parseInventoryImportText } from './inventoryImport';

export function parseReceiptText(text: string): ReceiptDraftItem[] {
  return parseInventoryImportText(text);
}
