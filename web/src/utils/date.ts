export function startOfWeekMonday(source: Date): Date {
  const date = new Date(source);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

export function addDays(source: Date, days: number): Date {
  const date = new Date(source);
  date.setDate(date.getDate() + days);
  return date;
}

export function toISODate(source: Date): string {
  const date = new Date(source);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export function parseISODate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function formatWeekLabel(weekStartDate: string): string {
  const date = parseISODate(weekStartDate);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

export function formatDisplayDate(value: string): string {
  const date = parseISODate(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function isExpiringSoon(expirationDate?: string): boolean {
  if (!expirationDate) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = parseISODate(expirationDate);
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 2;
}
