interface ContextAction {
  id: string;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  title: string;
  actions: ContextAction[];
  onClose: () => void;
}

export function ContextMenu({ open, x, y, title, actions, onClose }: ContextMenuProps) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="glass-panel-strong fixed z-50 min-w-52 rounded-xl p-2"
        style={{ left: x, top: y }}
      >
        <div className="relative z-10 mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
        <div className="relative z-10 space-y-1">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={`w-full rounded-lg border border-transparent px-3 py-1.5 text-left text-sm transition hover:border-white/60 hover:bg-white/70 ${
                action.tone === 'danger' ? 'text-red-700' : 'text-slate-700'
              }`}
              onClick={() => {
                action.onClick();
                onClose();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
