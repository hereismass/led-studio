import {
  applyEditorCommand,
  createDefaultProject,
  type EditorCommand,
} from '@led-studio/editor-core';
import { kmsFourString10LedProfile } from '@led-studio/hardware-profiles';
import type { Project, Scene, SongCue } from '@led-studio/project-format';
import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InspectorTarget } from '@/features/inspector/inspectorTarget';
import type { LedSelectionSource } from './useWorkspaceSelection';
import { useSongWorkspaceController } from './useSongWorkspaceController';

const SECOND_SCENE_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_CUE_ID = '33333333-3333-4333-8333-333333333333';

function songProject(): Project {
  const project = createDefaultProject({
    name: 'Test project',
    profile: kmsFourString10LedProfile,
  });
  const firstScene = project.scenes[0];
  const secondScene: Scene = {
    ...firstScene,
    id: SECOND_SCENE_ID,
    loopLengthBeats: 2,
    name: 'Scene 2',
  };
  const secondCue: SongCue = {
    advance: { kind: 'manual' },
    id: SECOND_CUE_ID,
    name: 'Scene 2',
    sceneId: secondScene.id,
  };
  return {
    ...project,
    scenes: [firstScene, secondScene],
    songs: [
      {
        ...project.songs[0],
        cues: [
          {
            ...project.songs[0].cues[0],
            advance: { kind: 'after-loops', loopCount: 2 },
          },
          secondCue,
        ],
      },
    ],
  };
}

interface HarnessState {
  activeSceneId: string | null;
  controller: ReturnType<typeof useSongWorkspaceController>;
}

function renderController(
  project: Project,
  onExecuteCommand: (command: EditorCommand) => {
    changed?: boolean;
    message?: string;
    ok: boolean;
  } = vi.fn((command: EditorCommand) => {
    void command;
    return { changed: true, ok: true };
  }),
  applyCommands = false,
) {
  let current: HarnessState | null = null;

  function Harness() {
    const [currentProject, setCurrentProject] = useState(project);
    const [activeSceneId, setActiveSceneId] = useState<string | null>(
      project.scenes[0]?.id ?? null,
    );
    const [, setInspectorTarget] = useState<InspectorTarget>({
      kind: 'project',
    });
    const [, setLedSelectionSource] = useState<LedSelectionSource>({
      kind: 'direct',
    });
    const [, setSelectedLedIds] = useState<string[]>([]);
    const controller = useSongWorkspaceController({
      activeSceneId,
      onExecuteCommand: (command) => {
        const result = onExecuteCommand(command);
        if (applyCommands && result.ok && result.changed) {
          setCurrentProject((currentProject) =>
            applyEditorCommand(currentProject, command),
          );
        }
        return result;
      },
      project: currentProject,
      setActiveSceneId,
      setInspectorTarget,
      setLedSelectionSource,
      setSelectedLedIds,
    });
    current = { activeSceneId, controller };
    return null;
  }

  const view = render(<Harness />);
  return {
    ...view,
    get current() {
      if (!current) throw new Error('Song workspace harness did not render.');
      return current;
    },
    onExecuteCommand,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('useSongWorkspaceController', () => {
  it('advances across multiple loops after one delayed animation frame', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('performance', { now: () => 0 });
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const project = songProject();
    const view = renderController(project);

    act(() => view.current.controller.activateSong(project.songs[0]));
    act(() => view.current.controller.previewController.play());
    expect(frames).toHaveLength(1);

    act(() => frames.shift()?.(4_500));

    expect(view.current.controller.activeCueId).toBe(SECOND_CUE_ID);
    expect(view.current.activeSceneId).toBe(SECOND_SCENE_ID);
    expect(view.current.controller.previewController.getSnapshot()).toEqual({
      positionBeats: 1,
      status: 'playing',
    });
  });

  it('does not switch preview when an inactive cue changes scene', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const project = songProject();
    const onExecuteCommand = vi.fn((command: EditorCommand) => {
      void command;
      return { changed: true, ok: true } as const;
    });
    const view = renderController(project, onExecuteCommand);
    const firstCue = project.songs[0].cues[0];

    act(() => view.current.controller.activateSong(project.songs[0]));
    act(() =>
      view.current.controller.updateCue(SECOND_CUE_ID, {
        sceneId: project.scenes[0].id,
      }),
    );

    expect(view.current.controller.activeCueId).toBe(firstCue.id);
    expect(view.current.activeSceneId).toBe(firstCue.sceneId);
    expect(onExecuteCommand).toHaveBeenLastCalledWith({
      changes: { sceneId: project.scenes[0].id },
      id: SECOND_CUE_ID,
      songId: project.songs[0].id,
      type: 'song-cue-updated',
    });
  });

  it('keeps song transport active when only the visible timeline tab changes', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const project = songProject();
    const view = renderController(project);

    act(() => view.current.controller.activateSong(project.songs[0]));
    act(() => view.current.controller.selectTimelineTab('scene'));

    expect(view.current.controller.timelineTab).toBe('scene');
    expect(view.current.controller.previewContext).toBe('song');
    expect(view.current.controller.activeCueId).toBe(
      project.songs[0].cues[0].id,
    );
    expect(view.current.activeSceneId).toBe(project.songs[0].cues[0].sceneId);
  });

  it('previews the duplicated cue and its referenced scene together', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const project = songProject();
    const onExecuteCommand = vi.fn((command: EditorCommand) => {
      void command;
      return { changed: true, ok: true } as const;
    });
    const view = renderController(project, onExecuteCommand, true);

    act(() => view.current.controller.activateSong(project.songs[0]));
    act(() => view.current.controller.duplicateCue(SECOND_CUE_ID));

    const command = onExecuteCommand.mock.lastCall?.[0];
    expect(command).toMatchObject({
      id: SECOND_CUE_ID,
      songId: project.songs[0].id,
      type: 'song-cue-duplicated',
    });
    if (command?.type !== 'song-cue-duplicated') {
      throw new Error('Expected a cue duplication command.');
    }
    expect(view.current.controller.activeCueId).toBe(command.newId);
    expect(view.current.activeSceneId).toBe(SECOND_SCENE_ID);
  });
});
