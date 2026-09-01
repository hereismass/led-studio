import {
  createKeyframeDuplicatedCommand,
  createGroupDuplicatedCommand,
  createPaletteTokenDuplicatedCommand,
  createSceneDuplicatedCommand,
  createSceneLayerDuplicatedCommand,
  projectGroupUsageCount,
  type EditorCommand,
  type ExecuteEditorCommandOptions,
  type KeyframeReference,
  type KeyframeTrackKind,
} from '@led-studio/editor-core';
import type {
  BrightnessKeyframe,
  ColourKeyframe,
  KeyframeEasing,
  KeyframeLayer,
  PaletteToken,
  Project,
  ProjectGroup,
  Scene,
  SceneLayer,
} from '@led-studio/project-format';
import type { Dispatch, SetStateAction } from 'react';
import type { EditorCommandResult } from '@/app/session/projectSession';
import type { InspectorTarget } from '@/features/inspector/inspectorTarget';
import type { LedSelectionSource } from './useWorkspaceSelection';

interface CreateInspectorActionsInput {
  activeScene: Scene | null;
  canDuplicateKeyframe: boolean;
  copyKeyframeSelection: () => void;
  deleteKeyframeSelection: () => void;
  deleteScene: (scene: Scene) => void;
  deleteSelectedToken: () => void;
  duplicateKeyframeSelection: () => void;
  executeAndSelectCreated: (
    command: EditorCommand,
    kind: 'palette' | 'scene',
    id: string,
  ) => void;
  onExecuteCommand: (
    command: EditorCommand,
    options?: ExecuteEditorCommandOptions,
  ) => EditorCommandResult;
  project: Project;
  selectedGroup: ProjectGroup | null;
  selectedKeyframe: BrightnessKeyframe | ColourKeyframe | null;
  selectedKeyframeLayer: KeyframeLayer | null;
  selectedKeyframeTrack: KeyframeTrackKind | null;
  selectedLayer: SceneLayer | null;
  selectedLedIds: string[];
  selectedScene: Scene | null;
  selectedToken: PaletteToken | null;
  setInspectorTarget: Dispatch<SetStateAction<InspectorTarget>>;
  setLedSelectionSource: Dispatch<SetStateAction<LedSelectionSource>>;
  setSelectedLedIds: Dispatch<SetStateAction<string[]>>;
}

export function createInspectorActions({
  activeScene,
  canDuplicateKeyframe,
  copyKeyframeSelection,
  deleteKeyframeSelection,
  deleteScene,
  deleteSelectedToken,
  duplicateKeyframeSelection,
  executeAndSelectCreated,
  onExecuteCommand,
  project,
  selectedGroup,
  selectedKeyframe,
  selectedKeyframeLayer,
  selectedKeyframeTrack,
  selectedLayer,
  selectedLedIds,
  selectedScene,
  selectedToken,
  setInspectorTarget,
  setLedSelectionSource,
  setSelectedLedIds,
}: CreateInspectorActionsInput) {
  return {
    onBrightnessChange: (
      brightnessPercent: number,
      options?: ExecuteEditorCommandOptions,
    ) => {
      if (!activeScene) return;
      onExecuteCommand(
        {
          brightnessPercent,
          ledIds: selectedLedIds,
          sceneId: activeScene.id,
          type: 'scene-led-brightness-set',
        },
        options,
      );
    },
    onDeleteScene: () => {
      if (selectedScene) deleteScene(selectedScene);
    },
    onDeleteGroup: () => {
      if (
        !selectedGroup ||
        projectGroupUsageCount(project, selectedGroup.id) > 0
      )
        return;
      onExecuteCommand({ id: selectedGroup.id, type: 'group-deleted' });
      setSelectedLedIds([]);
      setLedSelectionSource({ kind: 'direct' });
      setInspectorTarget({ kind: 'project' });
    },
    onDeleteLayer: () => {
      if (!selectedLayer || !activeScene) return;
      const result = onExecuteCommand({
        id: selectedLayer.id,
        sceneId: activeScene.id,
        type: 'scene-layer-deleted',
      });
      if (result.ok && result.changed)
        setInspectorTarget({ id: activeScene.id, kind: 'scene' });
    },
    onDeleteKeyframe: () => {
      if (
        !activeScene ||
        !selectedKeyframeLayer ||
        !selectedKeyframe ||
        !selectedKeyframeTrack
      )
        return;
      const result = onExecuteCommand({
        id: selectedKeyframe.id,
        layerId: selectedKeyframeLayer.id,
        sceneId: activeScene.id,
        track: selectedKeyframeTrack,
        type: 'keyframe-deleted',
      });
      if (result.ok && result.changed)
        setInspectorTarget({
          id: selectedKeyframeLayer.id,
          kind: 'layer',
          sceneId: activeScene.id,
        });
    },
    onDeleteKeyframes: deleteKeyframeSelection,
    onDeleteToken: deleteSelectedToken,
    onDuplicateScene: () => {
      if (!selectedScene) return;
      const command = createSceneDuplicatedCommand(project, selectedScene.id);
      executeAndSelectCreated(command, 'scene', command.id);
    },
    onDuplicateGroup: () => {
      if (!selectedGroup) return;
      const command = createGroupDuplicatedCommand(project, selectedGroup.id);
      const result = onExecuteCommand(command);
      if (!result.ok || !result.changed) return;
      const source = project.groups.find(({ id }) => id === selectedGroup.id)!;
      setSelectedLedIds(source.ledIds);
      setLedSelectionSource({ id: command.id, kind: 'project-group' });
      setInspectorTarget({ id: command.id, kind: 'group' });
    },
    onDuplicateLayer: () => {
      if (!selectedLayer || !activeScene) return;
      const command = createSceneLayerDuplicatedCommand(
        project,
        activeScene.id,
        selectedLayer.id,
      );
      const result = onExecuteCommand(command);
      if (result.ok && result.changed)
        setInspectorTarget({
          id: command.newId,
          kind: 'layer',
          sceneId: activeScene.id,
        });
    },
    onDuplicateKeyframe: () => {
      if (
        !activeScene ||
        !selectedKeyframeLayer ||
        !selectedKeyframe ||
        !selectedKeyframeTrack ||
        !canDuplicateKeyframe
      )
        return;
      const command = createKeyframeDuplicatedCommand(
        project,
        activeScene.id,
        selectedKeyframeLayer.id,
        selectedKeyframeTrack,
        selectedKeyframe.id,
      );
      const result = onExecuteCommand(command);
      if (result.ok && result.changed)
        setInspectorTarget({
          id: command.newId,
          kind: 'keyframe',
          layerId: selectedKeyframeLayer.id,
          sceneId: activeScene.id,
          track: selectedKeyframeTrack,
        });
    },
    onDuplicateKeyframes: duplicateKeyframeSelection,
    onCopyKeyframes: copyKeyframeSelection,
    onMoveLayer: (toIndex: number) => {
      if (!selectedLayer || !activeScene) return;
      onExecuteCommand({
        id: selectedLayer.id,
        sceneId: activeScene.id,
        toIndex,
        type: 'scene-layer-moved',
      });
    },
    onDuplicateToken: () => {
      if (!selectedToken) return;
      const command = createPaletteTokenDuplicatedCommand(
        project,
        selectedToken.id,
      );
      executeAndSelectCreated(command, 'palette', command.id);
    },
    onPaint: (paletteTokenId: string) => {
      if (!activeScene) return;
      onExecuteCommand({
        ledIds: selectedLedIds,
        paletteTokenId,
        sceneId: activeScene.id,
        type: 'scene-leds-painted',
      });
    },
    onSelectionChange: (ledIds: string[]) => {
      setSelectedLedIds(ledIds);
      setLedSelectionSource({ kind: 'direct' });
    },
    onTurnOff: () => {
      if (!activeScene) return;
      onExecuteCommand({
        ledIds: selectedLedIds,
        sceneId: activeScene.id,
        type: 'scene-leds-turned-off',
      });
    },
    onUpdateScene: (
      changes: Partial<Pick<Scene, 'loopLengthBeats' | 'name'>>,
    ) => {
      if (!selectedScene) return;
      onExecuteCommand({
        changes,
        id: selectedScene.id,
        type: 'scene-updated',
      });
    },
    onUpdateGroup: (
      changes: Partial<Pick<ProjectGroup, 'ledIds' | 'name'>>,
    ) => {
      if (!selectedGroup) return;
      onExecuteCommand({
        changes,
        id: selectedGroup.id,
        type: 'group-updated',
      });
      if (changes.ledIds)
        setLedSelectionSource({ id: selectedGroup.id, kind: 'project-group' });
    },
    onUpdateLayer: (
      changes: Partial<SceneLayer>,
      options?: ExecuteEditorCommandOptions,
    ) => {
      if (!selectedLayer || !activeScene) return;
      onExecuteCommand(
        {
          changes,
          id: selectedLayer.id,
          sceneId: activeScene.id,
          type: 'scene-layer-updated',
        },
        options,
      );
    },
    onUpdateKeyframe: (changes: {
      beat?: number;
      brightnessPercent?: number;
      easing?: KeyframeEasing;
      paletteTokenId?: string;
    }) => {
      if (
        !activeScene ||
        !selectedKeyframeLayer ||
        !selectedKeyframe ||
        !selectedKeyframeTrack
      )
        return;
      onExecuteCommand({
        changes,
        id: selectedKeyframe.id,
        layerId: selectedKeyframeLayer.id,
        sceneId: activeScene.id,
        track: selectedKeyframeTrack,
        type: 'keyframe-updated',
      });
    },
    onSetKeyframeEasing: (
      easing: KeyframeEasing,
      keyframes: readonly KeyframeReference[],
    ) => {
      if (!activeScene || !selectedKeyframeLayer) return;
      onExecuteCommand({
        easing,
        keyframes: [...keyframes],
        layerId: selectedKeyframeLayer.id,
        sceneId: activeScene.id,
        type: 'keyframes-easing-set',
      });
    },
    onBackToLayer: () => {
      if (!activeScene || !selectedKeyframeLayer) return;
      setInspectorTarget({
        id: selectedKeyframeLayer.id,
        kind: 'layer',
        sceneId: activeScene.id,
      });
    },
    onUpdateToken: (
      changes: Partial<Pick<PaletteToken, 'name' | 'value'>>,
      options?: ExecuteEditorCommandOptions,
    ) => {
      if (!selectedToken) return;
      onExecuteCommand(
        { changes, id: selectedToken.id, type: 'palette-token-updated' },
        options,
      );
    },
  };
}
