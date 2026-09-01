import {
  createSceneLayerDuplicatedCommand,
  type EditorCommand,
  type KeyframeReference,
} from '@led-studio/editor-core';
import type { HardwareProfile } from '@led-studio/hardware-profiles';
import type {
  KeyframeLayer,
  Project,
  Scene,
  SceneLayer,
} from '@led-studio/project-format';
import { useEffect, useState } from 'react';
import {
  copyKeyframes,
  copyLayer,
  EditorClipboardError,
  pastedKeyframes,
  pastedLayer,
  type EditorClipboard,
} from './editorClipboard';
import type { EditorCommandResult } from '@/app/session/projectSession';
import type { PreviewPlaybackController } from '@/features/playback/previewPlayback';
import {
  snapTimelineBeat,
  timelineSnapStep,
} from '@/features/timeline/timelineViewport';
import type { InspectorTarget } from './useWorkspaceSelection';
import type { TimelineSnap, TimelineZoomMode } from './workspaceLayout';

type KeyframeAction = 'copy' | 'cut' | 'delete' | 'duplicate' | 'paste';
type LayerAction = 'copy' | 'cut' | 'delete' | 'duplicate' | 'paste';

interface WorkspaceClipboardOptions {
  activeScene: Scene | null;
  clipboard: EditorClipboard | null;
  controller: PreviewPlaybackController;
  onClipboardChange: (clipboard: EditorClipboard) => void;
  onExecuteCommand: (command: EditorCommand) => EditorCommandResult;
  onExpandedKeyframeLayersChange: (
    update: (current: string[]) => string[],
  ) => void;
  onInspectorTargetChange: (target: InspectorTarget) => void;
  onTimelinePixelsPerBeatChange: (value: number) => void;
  onTimelineZoomModeChange: (value: TimelineZoomMode) => void;
  profile: HardwareProfile;
  project: Project;
  selectedKeyframeLayer: KeyframeLayer | null;
  selectedKeyframes: readonly KeyframeReference[];
  selectedLayer: SceneLayer | null;
  snap: TimelineSnap;
  timelinePixelsPerBeat: number;
}

export function useWorkspaceClipboard({
  activeScene,
  clipboard,
  controller,
  onClipboardChange,
  onExecuteCommand,
  onExpandedKeyframeLayersChange,
  onInspectorTargetChange,
  onTimelinePixelsPerBeatChange,
  onTimelineZoomModeChange,
  profile,
  project,
  selectedKeyframeLayer,
  selectedKeyframes,
  selectedLayer,
  snap,
  timelinePixelsPerBeat,
}: WorkspaceClipboardOptions) {
  const [feedback, setFeedback] = useState<string | null>(null);

  function showError(error: unknown) {
    setFeedback(
      error instanceof EditorClipboardError || error instanceof Error
        ? error.message
        : 'LED Studio could not complete that clipboard action.',
    );
  }

  function playheadAnchor(): number {
    if (!activeScene) return 0;
    return Math.min(
      activeScene.loopLengthBeats,
      snapTimelineBeat(
        controller.getQuarterBeatPositionSnapshot(),
        snap,
        project.timing.timeSignature.numerator,
      ),
    );
  }

  function keyframeLayerById(layerId: string): KeyframeLayer | null {
    const layer = activeScene?.layers.find(({ id }) => id === layerId);
    return layer?.kind === 'keyframe' ? layer : null;
  }

  function copyKeyframeSelection(
    layer: KeyframeLayer | null = selectedKeyframeLayer,
    references: readonly KeyframeReference[] = selectedKeyframes,
  ): boolean {
    if (!layer || references.length === 0) return false;
    try {
      onClipboardChange(copyKeyframes(project, layer, references));
      setFeedback(
        `${references.length} keyframe${references.length === 1 ? '' : 's'} copied.`,
      );
      return true;
    } catch (error) {
      showError(error);
      return false;
    }
  }

  function copyLayerSelection(layer = selectedLayer): boolean {
    if (!layer) return false;
    try {
      onClipboardChange(copyLayer(project, profile, layer));
      setFeedback(`“${layer.name}” copied.`);
      return true;
    } catch (error) {
      showError(error);
      return false;
    }
  }

  function deleteKeyframeSelection(
    layer: KeyframeLayer | null = selectedKeyframeLayer,
    references: readonly KeyframeReference[] = selectedKeyframes,
  ): boolean {
    if (!activeScene || !layer || references.length === 0 || layer.locked)
      return false;
    const result = onExecuteCommand({
      keyframes: [...references],
      layerId: layer.id,
      sceneId: activeScene.id,
      type: 'keyframes-deleted',
    });
    if (result.ok && result.changed)
      onInspectorTargetChange({
        id: layer.id,
        kind: 'layer',
        sceneId: activeScene.id,
      });
    return result.ok && Boolean(result.changed);
  }

  function deleteLayerSelection(layer = selectedLayer): boolean {
    if (!activeScene || !layer || layer.locked) return false;
    const result = onExecuteCommand({
      id: layer.id,
      sceneId: activeScene.id,
      type: 'scene-layer-deleted',
    });
    if (result.ok && result.changed)
      onInspectorTargetChange({ id: activeScene.id, kind: 'scene' });
    return result.ok && Boolean(result.changed);
  }

  function selectPastedKeyframes(
    layerId: string,
    references: KeyframeReference[],
  ) {
    const primary = references.at(-1)!;
    onInspectorTargetChange(
      references.length === 1
        ? {
            id: primary.id,
            kind: 'keyframe',
            layerId,
            sceneId: activeScene!.id,
            track: primary.track,
          }
        : {
            keyframes: references,
            kind: 'keyframes',
            layerId,
            primary,
            sceneId: activeScene!.id,
          },
    );
  }

  function pasteClipboard(
    keyframeLayer: KeyframeLayer | null = selectedKeyframeLayer,
    insertionLayerId?: string,
  ): boolean {
    if (!activeScene || !clipboard) {
      setFeedback(
        clipboard
          ? 'Select a scene before pasting.'
          : 'Copy a layer or keyframes before pasting.',
      );
      return false;
    }
    try {
      if (clipboard.kind === 'keyframes') {
        if (!keyframeLayer) {
          setFeedback('Select a keyframe layer before pasting keyframes.');
          return false;
        }
        const keyframes = pastedKeyframes(project, clipboard, playheadAnchor());
        const result = onExecuteCommand({
          keyframes,
          layerId: keyframeLayer.id,
          sceneId: activeScene.id,
          type: 'keyframes-pasted',
        });
        if (result.ok && result.changed)
          selectPastedKeyframes(
            keyframeLayer.id,
            keyframes.map(({ id, track }) => ({ id, track })),
          );
        return result.ok && Boolean(result.changed);
      }

      const layer = pastedLayer(
        project,
        profile,
        activeScene,
        clipboard,
        playheadAnchor(),
      );
      const selectedIndex = activeScene.layers.findIndex(
        ({ id }) =>
          id === insertionLayerId ||
          id === selectedLayer?.id ||
          id === selectedKeyframeLayer?.id,
      );
      const result = onExecuteCommand({
        layer,
        sceneId: activeScene.id,
        toIndex:
          selectedIndex < 0 ? activeScene.layers.length : selectedIndex + 1,
        type: 'scene-layer-pasted',
      });
      if (result.ok && result.changed) {
        if (layer.kind === 'keyframe')
          onExpandedKeyframeLayersChange((current) => [...current, layer.id]);
        onInspectorTargetChange({
          id: layer.id,
          kind: 'layer',
          sceneId: activeScene.id,
        });
      }
      return result.ok && Boolean(result.changed);
    } catch (error) {
      showError(error);
      return false;
    }
  }

  function duplicateKeyframeSelection(
    layer: KeyframeLayer | null = selectedKeyframeLayer,
    references: readonly KeyframeReference[] = selectedKeyframes,
  ): boolean {
    if (!activeScene || !layer || references.length === 0 || layer.locked)
      return false;
    try {
      const copied = copyKeyframes(project, layer, references);
      const earliest = Math.min(
        ...references.map(
          ({ id, track }) =>
            layer.tracks[track].keyframes.find((key) => key.id === id)!.beat,
        ),
      );
      const keyframes = pastedKeyframes(
        project,
        copied,
        earliest +
          timelineSnapStep(snap, project.timing.timeSignature.numerator),
      );
      const result = onExecuteCommand({
        keyframes,
        layerId: layer.id,
        sceneId: activeScene.id,
        type: 'keyframes-pasted',
      });
      if (result.ok && result.changed)
        selectPastedKeyframes(
          layer.id,
          keyframes.map(({ id, track }) => ({ id, track })),
        );
      return result.ok && Boolean(result.changed);
    } catch (error) {
      showError(error);
      return false;
    }
  }

  function duplicateLayer(layer: SceneLayer) {
    if (!activeScene || layer.locked) return;
    const command = createSceneLayerDuplicatedCommand(
      project,
      activeScene.id,
      layer.id,
    );
    const result = onExecuteCommand(command);
    if (result.ok && result.changed)
      onInspectorTargetChange({
        id: command.newId,
        kind: 'layer',
        sceneId: activeScene.id,
      });
  }

  function onKeyframeAction(
    action: KeyframeAction,
    layerId: string,
    references: KeyframeReference[],
  ) {
    const layer = keyframeLayerById(layerId);
    if (!layer) return;
    if (action === 'copy') copyKeyframeSelection(layer, references);
    else if (action === 'cut') {
      if (layer.locked) setFeedback('Unlock the layer before cutting keys.');
      else if (copyKeyframeSelection(layer, references))
        deleteKeyframeSelection(layer, references);
    } else if (action === 'delete') deleteKeyframeSelection(layer, references);
    else if (action === 'duplicate')
      duplicateKeyframeSelection(layer, references);
    else pasteClipboard(layer);
  }

  function onLayerAction(action: LayerAction, layerId: string) {
    const layer = activeScene?.layers.find(({ id }) => id === layerId);
    if (!layer) return;
    if (action === 'copy') copyLayerSelection(layer);
    else if (action === 'cut') {
      if (layer.locked) setFeedback('Unlock the layer before cutting it.');
      else if (copyLayerSelection(layer)) deleteLayerSelection(layer);
    } else if (action === 'delete') deleteLayerSelection(layer);
    else if (action === 'paste')
      pasteClipboard(layer.kind === 'keyframe' ? layer : null, layer.id);
    else duplicateLayer(layer);
  }

  useEffect(() => {
    function handleWorkspaceShortcut(event: KeyboardEvent) {
      const target = event.target;
      const isEditing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
      if (isEditing) return;
      const modifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (modifier && (event.key === '=' || event.key === '+')) {
        event.preventDefault();
        onTimelinePixelsPerBeatChange(timelinePixelsPerBeat * 1.25);
      } else if (modifier && event.key === '-') {
        event.preventDefault();
        onTimelinePixelsPerBeatChange(timelinePixelsPerBeat * 0.8);
      } else if (modifier && event.key === '0') {
        event.preventDefault();
        onTimelineZoomModeChange('fit');
      } else if (modifier && key === 'a' && selectedKeyframeLayer) {
        event.preventDefault();
        const references: KeyframeReference[] = [
          ...selectedKeyframeLayer.tracks.brightness.keyframes.map(
            ({ id }) => ({ id, track: 'brightness' as const }),
          ),
          ...selectedKeyframeLayer.tracks.colour.keyframes.map(({ id }) => ({
            id,
            track: 'colour' as const,
          })),
        ];
        if (references.length > 0 && activeScene)
          onInspectorTargetChange({
            keyframes: references,
            kind: 'keyframes',
            layerId: selectedKeyframeLayer.id,
            primary: references.at(-1)!,
            sceneId: activeScene.id,
          });
      } else if (modifier && key === 'c') {
        if (copyKeyframeSelection() || copyLayerSelection())
          event.preventDefault();
      } else if (modifier && key === 'x') {
        if (selectedKeyframes.length > 0) {
          if (selectedKeyframeLayer?.locked)
            setFeedback('Unlock the layer before cutting keys.');
          else if (copyKeyframeSelection()) deleteKeyframeSelection();
          event.preventDefault();
        } else if (selectedLayer) {
          if (selectedLayer.locked)
            setFeedback('Unlock the layer before cutting it.');
          else if (copyLayerSelection()) deleteLayerSelection();
          event.preventDefault();
        }
      } else if (modifier && key === 'v') {
        event.preventDefault();
        pasteClipboard();
      } else if (modifier && key === 'd') {
        if (selectedKeyframes.length > 0) {
          event.preventDefault();
          duplicateKeyframeSelection();
        } else if (selectedLayer) {
          event.preventDefault();
          duplicateLayer(selectedLayer);
        }
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        if (selectedKeyframes.length > 0) {
          event.preventDefault();
          deleteKeyframeSelection();
        } else if (selectedLayer) {
          event.preventDefault();
          deleteLayerSelection();
        }
      } else if (event.key === 'Escape' && activeScene) {
        onInspectorTargetChange({ id: activeScene.id, kind: 'scene' });
      }
    }

    window.addEventListener('keydown', handleWorkspaceShortcut);
    return () => window.removeEventListener('keydown', handleWorkspaceShortcut);
  });

  return {
    copyKeyframeSelection,
    deleteKeyframeSelection,
    duplicateKeyframeSelection,
    feedback,
    onKeyframeAction,
    onLayerAction,
  };
}
