import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  defaultWorkspaceLayout,
  loadWorkspaceLayout,
  resizeWorkspacePanel,
  saveWorkspaceLayout,
} from './workspaceLayout';

export type ResizablePanel = 'bottom' | 'left' | 'right';

export function useWorkspaceLayout() {
  const [layout, setLayout] = useState(loadWorkspaceLayout);
  const stopResizeRef = useRef<(() => void) | null>(null);

  useEffect(() => saveWorkspaceLayout(layout), [layout]);
  useEffect(() => () => stopResizeRef.current?.(), []);

  function togglePanel(panel: ResizablePanel) {
    setLayout((current) => ({
      ...current,
      [`${panel}Collapsed`]: !current[`${panel}Collapsed`],
    }));
  }

  function beginResize(
    panel: ResizablePanel,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    stopResizeRef.current?.();
    const startPosition = panel === 'bottom' ? event.clientY : event.clientX;
    let previousDelta = 0;
    function handlePointerMove(pointerEvent: PointerEvent) {
      const position =
        panel === 'bottom' ? pointerEvent.clientY : pointerEvent.clientX;
      const totalDelta = position - startPosition;
      const nextDelta = totalDelta - previousDelta;
      previousDelta = totalDelta;
      setLayout((current) => resizeWorkspacePanel(current, panel, nextDelta));
    }
    function stopResizing() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
      stopResizeRef.current = null;
    }
    stopResizeRef.current = stopResizing;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing, { once: true });
  }

  function resizeWithKeyboard(
    panel: ResizablePanel,
    event: KeyboardEvent<HTMLDivElement>,
  ) {
    const step = event.shiftKey ? 24 : 8;
    let delta: number | null = null;
    if (panel === 'bottom') {
      if (event.key === 'ArrowUp') delta = -step;
      if (event.key === 'ArrowDown') delta = step;
    } else {
      if (event.key === 'ArrowLeft') delta = -step;
      if (event.key === 'ArrowRight') delta = step;
    }
    if (delta === null) return;
    event.preventDefault();
    setLayout((current) => resizeWorkspacePanel(current, panel, delta));
  }

  const workspaceStyle = {
    '--bottom-panel-height': `${layout.bottomCollapsed ? 38 : layout.bottomHeight}px`,
    '--left-panel-width': `${layout.leftCollapsed ? 44 : layout.leftWidth}px`,
    '--right-panel-width': `${layout.rightCollapsed ? 44 : layout.rightWidth}px`,
  } as CSSProperties;

  return {
    beginResize,
    layout,
    resetLayout: () => setLayout({ ...defaultWorkspaceLayout }),
    resizeWithKeyboard,
    togglePanel,
    workspaceStyle,
  };
}
