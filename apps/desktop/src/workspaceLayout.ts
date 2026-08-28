export const WORKSPACE_LAYOUT_STORAGE_KEY = 'led-studio.workspace-layout.v1';

export interface WorkspaceLayoutPreferences {
  bottomCollapsed: boolean;
  bottomHeight: number;
  leftCollapsed: boolean;
  leftWidth: number;
  rightCollapsed: boolean;
  rightWidth: number;
}

export const defaultWorkspaceLayout: WorkspaceLayoutPreferences = {
  bottomCollapsed: false,
  bottomHeight: 220,
  leftCollapsed: false,
  leftWidth: 236,
  rightCollapsed: false,
  rightWidth: 272,
};

const layoutBounds = {
  bottomHeight: { maximum: 420, minimum: 150 },
  leftWidth: { maximum: 380, minimum: 188 },
  rightWidth: { maximum: 420, minimum: 220 },
} as const;

const TIMELINE_BASE_CONTENT_HEIGHT = 184;
const TIMELINE_LAYER_ROW_HEIGHT = 43;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function timelineContentMinimumHeight(layerCount: number): number {
  return clamp(
    TIMELINE_BASE_CONTENT_HEIGHT +
      Math.max(0, Math.floor(layerCount)) * TIMELINE_LAYER_ROW_HEIGHT,
    layoutBounds.bottomHeight.minimum,
    layoutBounds.bottomHeight.maximum,
  );
}

export function effectiveBottomPanelHeight(
  layout: WorkspaceLayoutPreferences,
  layerCount: number,
): number {
  return Math.max(
    layout.bottomHeight,
    timelineContentMinimumHeight(layerCount),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readDimension(
  value: unknown,
  fallback: number,
  bounds: { maximum: number; minimum: number },
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, bounds.minimum, bounds.maximum)
    : fallback;
}

export function normalizeWorkspaceLayout(
  value: unknown,
): WorkspaceLayoutPreferences {
  if (!isRecord(value)) {
    return { ...defaultWorkspaceLayout };
  }

  return {
    bottomCollapsed: readBoolean(
      value.bottomCollapsed,
      defaultWorkspaceLayout.bottomCollapsed,
    ),
    bottomHeight: readDimension(
      value.bottomHeight,
      defaultWorkspaceLayout.bottomHeight,
      layoutBounds.bottomHeight,
    ),
    leftCollapsed: readBoolean(
      value.leftCollapsed,
      defaultWorkspaceLayout.leftCollapsed,
    ),
    leftWidth: readDimension(
      value.leftWidth,
      defaultWorkspaceLayout.leftWidth,
      layoutBounds.leftWidth,
    ),
    rightCollapsed: readBoolean(
      value.rightCollapsed,
      defaultWorkspaceLayout.rightCollapsed,
    ),
    rightWidth: readDimension(
      value.rightWidth,
      defaultWorkspaceLayout.rightWidth,
      layoutBounds.rightWidth,
    ),
  };
}

export function loadWorkspaceLayout(
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): WorkspaceLayoutPreferences {
  try {
    const savedLayout = storage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY);
    return savedLayout
      ? normalizeWorkspaceLayout(JSON.parse(savedLayout))
      : { ...defaultWorkspaceLayout };
  } catch {
    return { ...defaultWorkspaceLayout };
  }
}

export function saveWorkspaceLayout(
  layout: WorkspaceLayoutPreferences,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  try {
    storage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Layout persistence is optional and must never interrupt project editing.
  }
}

export function resizeWorkspacePanel(
  layout: WorkspaceLayoutPreferences,
  panel: 'bottom' | 'left' | 'right',
  delta: number,
  bottomContentMinimum: number = layoutBounds.bottomHeight.minimum,
): WorkspaceLayoutPreferences {
  if (panel === 'bottom') {
    const resizeBase =
      delta < 0
        ? Math.max(layout.bottomHeight, bottomContentMinimum)
        : layout.bottomHeight;
    return {
      ...layout,
      bottomHeight: readDimension(
        resizeBase - delta,
        defaultWorkspaceLayout.bottomHeight,
        layoutBounds.bottomHeight,
      ),
    };
  }

  if (panel === 'right') {
    return {
      ...layout,
      rightWidth: readDimension(
        layout.rightWidth - delta,
        defaultWorkspaceLayout.rightWidth,
        layoutBounds.rightWidth,
      ),
    };
  }

  return {
    ...layout,
    leftWidth: readDimension(
      layout.leftWidth + delta,
      defaultWorkspaceLayout.leftWidth,
      layoutBounds.leftWidth,
    ),
  };
}
