import { describe, expect, it, vi } from 'vitest';
import {
  defaultWorkspaceLayout,
  loadWorkspaceLayout,
  normalizeWorkspaceLayout,
  resizeWorkspacePanel,
  saveWorkspaceLayout,
  WORKSPACE_LAYOUT_STORAGE_KEY,
} from './workspaceLayout';

describe('workspace layout preferences', () => {
  it('uses defaults when saved preferences are unavailable or malformed', () => {
    expect(loadWorkspaceLayout({ getItem: () => '{not-json' })).toEqual(
      defaultWorkspaceLayout,
    );
    expect(normalizeWorkspaceLayout(null)).toEqual(defaultWorkspaceLayout);
  });

  it('normalizes persisted values and clamps dimensions', () => {
    expect(
      normalizeWorkspaceLayout({
        bottomCollapsed: true,
        bottomHeight: 10_000,
        leftCollapsed: true,
        leftWidth: 1,
        rightCollapsed: 'yes',
        rightWidth: 300,
      }),
    ).toEqual({
      bottomCollapsed: true,
      bottomHeight: 420,
      leftCollapsed: true,
      leftWidth: 188,
      rightCollapsed: false,
      rightWidth: 300,
    });
  });

  it('resizes each panel in the expected direction and within its bounds', () => {
    expect(
      resizeWorkspacePanel(defaultWorkspaceLayout, 'left', 30).leftWidth,
    ).toBe(266);
    expect(
      resizeWorkspacePanel(defaultWorkspaceLayout, 'right', 30).rightWidth,
    ).toBe(242);
    expect(
      resizeWorkspacePanel(defaultWorkspaceLayout, 'bottom', -1_000)
        .bottomHeight,
    ).toBe(420);
  });

  it('stores preferences under the versioned app key', () => {
    const setItem = vi.fn();

    saveWorkspaceLayout(defaultWorkspaceLayout, { setItem });

    expect(setItem).toHaveBeenCalledWith(
      WORKSPACE_LAYOUT_STORAGE_KEY,
      JSON.stringify(defaultWorkspaceLayout),
    );
  });
});
