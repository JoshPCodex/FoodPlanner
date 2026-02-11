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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-3 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`glass-panel-strong w-full ${widthClassName} max-h-[92vh] overflow-y-auto rounded-2xl p-5`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative z-10 mb-4 flex items-center justify-between border-b border-white/45 pb-2.5">
          <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
          <button
            type="button"
            className="btn-glass btn-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}
