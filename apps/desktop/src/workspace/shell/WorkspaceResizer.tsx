import type { ResizablePanel } from '@/workspace/model/useWorkspaceLayout';

interface WorkspaceResizerProps {
  collapsed: boolean;
  max: number;
  min: number;
  orientation: 'horizontal' | 'vertical';
  panel: ResizablePanel;
  value: number;
  onKeyDown: ReturnType<
    typeof import('@/workspace/model/useWorkspaceLayout').useWorkspaceLayout
  >['resizeWithKeyboard'];
  onPointerDown: ReturnType<
    typeof import('@/workspace/model/useWorkspaceLayout').useWorkspaceLayout
  >['beginResize'];
}

export function WorkspaceResizer({
  collapsed,
  max,
  min,
  onKeyDown,
  onPointerDown,
  orientation,
  panel,
  value,
}: WorkspaceResizerProps) {
  const label =
    panel === 'left'
      ? 'Resize assets panel'
      : panel === 'right'
        ? 'Resize inspector panel'
        : 'Resize timeline panel';
  return (
    <div
      className={`workspace-resizer workspace-resizer-${orientation}`}
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      tabIndex={collapsed ? -1 : 0}
      onKeyDown={(event) => onKeyDown(panel, event)}
      onPointerDown={(event) => onPointerDown(panel, event)}
    />
  );
}
