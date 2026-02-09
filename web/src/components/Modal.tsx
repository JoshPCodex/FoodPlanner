import { PropsWithChildren } from 'react';

interface ModalProps extends PropsWithChildren {
  title: string;
  open: boolean;
  onClose: () => void;
  widthClassName?: string;
}

export function Modal({ title, open, onClose, children, widthClassName = 'max-w-2xl' }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3" onClick={onClose}>
      <div
        className={`w-full ${widthClassName} max-h-[92vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-2">
          <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
