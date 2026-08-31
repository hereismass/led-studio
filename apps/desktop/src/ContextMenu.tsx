import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  disabled?: boolean;
  label: string;
  onSelect: () => void;
}

export function ContextMenu({
  items,
  point,
  onClose,
}: {
  items: readonly ContextMenuItem[];
  point: { x: number; y: number } | null;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!point) return;
    menuRef.current
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    function close() {
      onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('pointerdown', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [onClose, point]);

  if (!point) return null;
  return createPortal(
    <div
      className="editor-context-menu"
      ref={menuRef}
      role="menu"
      style={{ left: point.x, top: point.y }}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {items.map((item) => (
        <button
          disabled={item.disabled}
          key={item.label}
          role="menuitem"
          type="button"
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
