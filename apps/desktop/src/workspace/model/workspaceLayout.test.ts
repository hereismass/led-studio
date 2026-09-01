import { describe, expect, it, vi } from 'vitest';
import {
  defaultWorkspaceLayout,
  effectiveBottomPanelHeight,
  LEGACY_WORKSPACE_LAYOUT_STORAGE_KEY,
  loadWorkspaceLayout,
  normalizeWorkspaceLayout,
  resizeWorkspacePanel,
  saveWorkspaceLayout,
  timelineContentMinimumHeight,
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
      timelinePixelsPerBeat: 80,
      timelineSnap: 0.25,
      timelineZoomMode: 'manual',
    });
  });

  it('migrates the previous layout key and normalizes new timeline settings', () => {
    const getItem = vi.fn((key: string) =>
      key === LEGACY_WORKSPACE_LAYOUT_STORAGE_KEY
        ? JSON.stringify({
            leftWidth: 300,
            timelinePixelsPerBeat: 999,
            timelineSnap: 'bar',
            timelineZoomMode: 'fit',
          })
        : null,
    );

    expect(loadWorkspaceLayout({ getItem })).toMatchObject({
      leftWidth: 300,
      timelinePixelsPerBeat: 320,
      timelineSnap: 'bar',
      timelineZoomMode: 'fit',
    });
    expect(getItem).toHaveBeenCalledWith(LEGACY_WORKSPACE_LAYOUT_STORAGE_KEY);
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

  it('grows the timeline with visible layer and property rows up to its maximum', () => {
    expect(timelineContentMinimumHeight(0)).toBe(184);
    expect(timelineContentMinimumHeight(1)).toBe(227);
    expect(timelineContentMinimumHeight(2)).toBe(270);
    expect(timelineContentMinimumHeight(100)).toBe(420);
    expect(effectiveBottomPanelHeight(defaultWorkspaceLayout, 0)).toBe(220);
    expect(effectiveBottomPanelHeight(defaultWorkspaceLayout, 2)).toBe(270);
    expect(
      resizeWorkspacePanel(defaultWorkspaceLayout, 'bottom', -8, 270)
        .bottomHeight,
    ).toBe(278);
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
