import {
  createKeyframeAddedCommand,
  createKeyframeDuplicatedCommand,
  createPaletteTokenAddedCommand,
  createPaletteTokenDuplicatedCommand,
  createSceneLayerAddedCommand,
  createSceneLayerDuplicatedCommand,
  createGroupAddedCommand,
  createGroupDuplicatedCommand,
  createSceneAddedCommand,
  createSceneDuplicatedCommand,
  nextAvailableKeyframeBeat,
  paletteTokenUsageCount,
  projectGroupUsageCount,
  type EditorCommand,
  type ExecuteEditorCommandOptions,
  type KeyframeValue,
  type KeyframeTrackKind,
} from '@led-studio/editor-core';
import { getHardwareProfile } from '@led-studio/hardware-profiles';
import type {
  KeyframeLayer,
  LayerTarget,
  ProjectGroup,
  Scene,
} from '@led-studio/project-format';
import { useEffect, useState } from 'react';
import { AssetsPanel } from './AssetsPanel';
import { HardwarePanel } from './HardwarePanel';
import { InspectorPanel } from './InspectorPanel';
import { TimelinePanel } from './TimelinePanel';
import { useScenePreview } from './useScenePreview';
import { useWorkspaceLayout } from './useWorkspaceLayout';
import { useWorkspaceSelection } from './useWorkspaceSelection';
import { WorkspaceResizer } from './WorkspaceResizer';
import { WorkspaceToolbar } from './WorkspaceToolbar';
import {
  type ActiveProjectSession,
  type EditorCommandResult,
  type ProjectOperation,
  type SaveFeedback,
} from './projectSession';
interface ProjectWorkspaceProps {
  activeProject: ActiveProjectSession;
  canRedo: boolean;
  canUndo: boolean;
  editorFeedback: string | null;
  onChooseAnother: () => void;
  onExecuteCommand: (
    command: EditorCommand,
    options?: ExecuteEditorCommandOptions,
  ) => EditorCommandResult;
  onRedo: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
  operation: ProjectOperation;
  saveFeedback: SaveFeedback | null;
}

export function ProjectWorkspace({
  activeProject,
  canRedo,
  canUndo,
  editorFeedback,
  onChooseAnother,
  onExecuteCommand,
  onRedo,
  onSave,
  onSaveAs,
  onUndo,
  operation,
  saveFeedback,
}: ProjectWorkspaceProps) {
  const { project } = activeProject.present;
  const profile = getHardwareProfile(project.hardwareProfile)!;
  const colours = project.palette;
  const scenes = project.scenes;
  const {
    activeSceneId,
    focusTokenId,
    inspectorTarget,
    ledSelectionSource,
    selectedLedIds,
    setActiveSceneId,
    setFocusTokenId,
    setInspectorTarget,
    setLedSelectionSource,
    setSelectedLedIds,
  } = useWorkspaceSelection(scenes, colours, project.groups);

  const activeScene =
    scenes.find((scene) => scene.id === activeSceneId) ?? null;
  const [expandedKeyframeLayerIds, setExpandedKeyframeLayerIds] = useState<
    string[]
  >([]);
  const selectedToken =
    inspectorTarget.kind === 'palette'
      ? (colours.find((token) => token.id === inspectorTarget.id) ?? null)
      : null;
  const selectedScene =
    inspectorTarget.kind === 'scene'
      ? (scenes.find((scene) => scene.id === inspectorTarget.id) ?? null)
      : null;
  const selectedGroup =
    inspectorTarget.kind === 'group'
      ? (project.groups.find((group) => group.id === inspectorTarget.id) ??
        null)
      : null;
  const selectedLayer =
    inspectorTarget.kind === 'layer' &&
    activeScene?.id === inspectorTarget.sceneId
      ? (activeScene.layers.find((layer) => layer.id === inspectorTarget.id) ??
        null)
      : null;
  const selectedKeyframeLayer =
    inspectorTarget.kind === 'keyframe' &&
    activeScene?.id === inspectorTarget.sceneId
      ? (activeScene.layers.find(
          (layer): layer is KeyframeLayer =>
            layer.id === inspectorTarget.layerId && layer.kind === 'keyframe',
        ) ?? null)
      : null;
  const selectedKeyframe =
    inspectorTarget.kind === 'keyframe' &&
    selectedKeyframeLayer?.kind === 'keyframe'
      ? (selectedKeyframeLayer.tracks[inspectorTarget.track].keyframes.find(
          ({ id }) => id === inspectorTarget.id,
        ) ?? null)
      : null;
  const selectedKeyframeTrack =
    inspectorTarget.kind === 'keyframe' ? inspectorTarget.track : null;
  const canDuplicateKeyframe =
    selectedKeyframeLayer?.kind === 'keyframe' &&
    selectedKeyframe &&
    selectedKeyframeTrack
      ? nextAvailableKeyframeBeat(
          selectedKeyframeLayer,
          selectedKeyframeTrack,
          selectedKeyframe.beat,
          activeScene?.loopLengthBeats ?? 0,
        ) !== null
      : false;
  const selectedLeds = profile.leds.filter((led) =>
    selectedLedIds.includes(led.id),
  );
  const previewController = useScenePreview(
    activeScene,
    project.timing.previewBpm,
  );
  const {
    beginResize,
    bottomPanelHeight,
    bottomPanelMinimumHeight,
    layout,
    resetLayout,
    resizeWithKeyboard,
    togglePanel,
    workspaceStyle,
  } = useWorkspaceLayout(
    (activeScene?.layers.length ?? 0) +
      (activeScene?.layers.filter(
        (layer) =>
          layer.kind === 'keyframe' &&
          expandedKeyframeLayerIds.includes(layer.id),
      ).length ?? 0) *
        2,
  );

  useEffect(() => {
    const validIds = new Set(
      scenes.flatMap((scene) =>
        scene.layers
          .filter((layer) => layer.kind === 'keyframe')
          .map(({ id }) => id),
      ),
    );
    setExpandedKeyframeLayerIds((current) =>
      current.filter((id) => validIds.has(id)),
    );
  }, [scenes]);

  function executeAndSelectCreated(
    command: EditorCommand,
    kind: 'palette' | 'scene',
    id: string,
  ) {
    const result = onExecuteCommand(command);
    if (!result.ok || !result.changed) return;
    if (kind === 'palette') {
      setInspectorTarget({ id, kind: 'palette' });
      setFocusTokenId(id);
    } else {
      setActiveSceneId(id);
      setInspectorTarget({ id, kind: 'scene' });
      setSelectedLedIds([]);
      setLedSelectionSource({ kind: 'direct' });
    }
  }

  function activateScene(scene: Scene) {
    setActiveSceneId(scene.id);
    setInspectorTarget({ id: scene.id, kind: 'scene' });
    setSelectedLedIds([]);
    setLedSelectionSource({ kind: 'direct' });
  }

  function deleteScene(scene: Scene) {
    const index = scenes.findIndex(({ id }) => id === scene.id);
    const nearest = scenes[index + 1] ?? scenes[index - 1] ?? null;
    if (activeSceneId === scene.id) setActiveSceneId(nearest?.id ?? null);
    setInspectorTarget(
      nearest ? { id: nearest.id, kind: 'scene' } : { kind: 'project' },
    );
    setSelectedLedIds([]);
    onExecuteCommand({ id: scene.id, type: 'scene-deleted' });
  }

  function deleteSelectedToken() {
    if (!selectedToken || paletteTokenUsageCount(project, selectedToken.id) > 0)
      return;
    const index = colours.findIndex(({ id }) => id === selectedToken.id);
    const nearest = colours[index + 1] ?? colours[index - 1] ?? null;
    setInspectorTarget(
      nearest ? { id: nearest.id, kind: 'palette' } : { kind: 'project' },
    );
    setFocusTokenId(null);
    onExecuteCommand({ id: selectedToken.id, type: 'palette-token-deleted' });
  }

  function selectLeds(ledIds: string[]) {
    setSelectedLedIds(ledIds);
    setLedSelectionSource({ kind: 'direct' });
    if (inspectorTarget.kind === 'group') return;
    if (ledIds.length > 0) setInspectorTarget({ kind: 'leds' });
    else if (activeScene)
      setInspectorTarget({ id: activeScene.id, kind: 'scene' });
  }

  function selectGroup(
    ledIds: string[],
    additive: boolean,
    source: { id: string; kind: 'profile-group' | 'project-group' },
  ) {
    selectLeds(
      additive ? [...new Set([...selectedLedIds, ...ledIds])] : ledIds,
    );
    setLedSelectionSource(additive ? { kind: 'direct' } : source);
  }

  function selectProjectGroup(group: ProjectGroup) {
    setSelectedLedIds(group.ledIds);
    setLedSelectionSource({ id: group.id, kind: 'project-group' });
    setInspectorTarget({ id: group.id, kind: 'group' });
  }

  function currentLayerTarget(): LayerTarget {
    let target: LayerTarget;
    if (ledSelectionSource.kind === 'profile-group') {
      target = { groupId: ledSelectionSource.id, kind: 'profile-group' };
    } else if (ledSelectionSource.kind === 'project-group') {
      target = { groupId: ledSelectionSource.id, kind: 'project-group' };
    } else if (selectedLedIds.length > 0) {
      target = { kind: 'leds', ledIds: selectedLedIds };
    } else {
      target = {
        groupId:
          profile.groups.find((group) => group.id === 'all-leds')?.id ??
          profile.groups[0].id,
        kind: 'profile-group',
      };
    }
    return target;
  }

  function addLayer(layerType: 'pulse' | 'chase' | 'keyframe') {
    if (!activeScene || (layerType !== 'keyframe' && colours.length === 0))
      return;
    const command = createSceneLayerAddedCommand(
      project,
      activeScene.id,
      layerType,
      currentLayerTarget(),
    );
    const result = onExecuteCommand(command);
    if (result.ok && result.changed) {
      if (layerType === 'keyframe')
        setExpandedKeyframeLayerIds((current) => [...current, command.id]);
      setInspectorTarget({
        id: command.id,
        kind: 'layer',
        sceneId: activeScene.id,
      });
    }
  }

  return (
    <main className="workspace-shell" style={workspaceStyle}>
      <WorkspaceToolbar
        activeProject={activeProject}
        canRedo={canRedo}
        canUndo={canUndo}
        hasActiveScene={Boolean(activeScene)}
        onChooseAnother={onChooseAnother}
        onExecuteCommand={onExecuteCommand}
        onRedo={onRedo}
        onSave={onSave}
        onSaveAs={onSaveAs}
        onUndo={onUndo}
        operation={operation}
        previewController={previewController}
        profile={profile}
        project={project}
      />

      {saveFeedback ? (
        <div
          className={`workspace-feedback workspace-feedback-${saveFeedback.kind}`}
          role={saveFeedback.kind === 'error' ? 'alert' : 'status'}
        >
          {saveFeedback.message}
        </div>
      ) : null}
      {editorFeedback ? (
        <div
          className="workspace-feedback workspace-feedback-error"
          role="alert"
        >
          {editorFeedback}
        </div>
      ) : null}

      <div className="workspace-editor">
        <AssetsPanel
          activeSceneId={activeSceneId}
          collapsed={layout.leftCollapsed}
          groups={project.groups}
          hasLedSelection={selectedLedIds.length > 0}
          palette={colours}
          scenes={scenes}
          selectedPaletteId={
            inspectorTarget.kind === 'palette' ? inspectorTarget.id : null
          }
          selectedGroupId={
            inspectorTarget.kind === 'group' ? inspectorTarget.id : null
          }
          onAddColour={() => {
            const command = createPaletteTokenAddedCommand(project);
            executeAndSelectCreated(command, 'palette', command.id);
          }}
          onAddGroup={() => {
            if (selectedLedIds.length === 0) return;
            const command = createGroupAddedCommand(project, selectedLedIds);
            const result = onExecuteCommand(command);
            if (!result.ok || !result.changed) return;
            setInspectorTarget({ id: command.id, kind: 'group' });
            setLedSelectionSource({ id: command.id, kind: 'project-group' });
          }}
          onAddScene={() => {
            const command = createSceneAddedCommand(project);
            executeAndSelectCreated(command, 'scene', command.id);
          }}
          onSelectPalette={(id) => {
            setInspectorTarget({ id, kind: 'palette' });
            setFocusTokenId(null);
          }}
          onSelectGroup={selectProjectGroup}
          onSelectScene={activateScene}
          onToggle={() => togglePanel('left')}
        />

        <WorkspaceResizer
          collapsed={layout.leftCollapsed}
          max={380}
          min={188}
          onKeyDown={resizeWithKeyboard}
          onPointerDown={beginResize}
          orientation="vertical"
          panel="left"
          value={layout.leftWidth}
        />

        <HardwarePanel
          controller={previewController}
          groups={project.groups}
          palette={colours}
          profile={profile}
          scene={activeScene}
          selectedLedIds={selectedLedIds}
          onResetLayout={resetLayout}
          onSelectGroup={selectGroup}
          onSelectionChange={selectLeds}
          onTogglePanel={togglePanel}
        />

        <WorkspaceResizer
          collapsed={layout.rightCollapsed}
          max={420}
          min={220}
          onKeyDown={resizeWithKeyboard}
          onPointerDown={beginResize}
          orientation="vertical"
          panel="right"
          value={layout.rightWidth}
        />

        <InspectorPanel
          activeScene={activeScene}
          canDuplicateKeyframe={canDuplicateKeyframe}
          collapsed={layout.rightCollapsed}
          focusTokenId={focusTokenId}
          inspectorTarget={inspectorTarget}
          palette={colours}
          profile={profile}
          project={project}
          scenes={scenes}
          selectedLedIds={selectedLedIds}
          selectedLeds={selectedLeds}
          selectedGroup={selectedGroup}
          selectedLayer={selectedLayer}
          selectedKeyframe={selectedKeyframe}
          selectedKeyframeLayer={selectedKeyframeLayer}
          selectedKeyframeTrack={selectedKeyframeTrack}
          selectedScene={selectedScene}
          selectedToken={selectedToken}
          tokenUsageCount={
            selectedToken
              ? paletteTokenUsageCount(project, selectedToken.id)
              : 0
          }
          groupUsageCount={
            selectedGroup
              ? projectGroupUsageCount(project, selectedGroup.id)
              : 0
          }
          onBrightnessChange={(brightnessPercent, options) => {
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
          }}
          onDeleteScene={() => {
            if (selectedScene) deleteScene(selectedScene);
          }}
          onDeleteGroup={() => {
            if (
              !selectedGroup ||
              projectGroupUsageCount(project, selectedGroup.id) > 0
            )
              return;
            onExecuteCommand({ id: selectedGroup.id, type: 'group-deleted' });
            setSelectedLedIds([]);
            setLedSelectionSource({ kind: 'direct' });
            setInspectorTarget({ kind: 'project' });
          }}
          onDeleteLayer={() => {
            if (!selectedLayer || !activeScene) return;
            const result = onExecuteCommand({
              id: selectedLayer.id,
              sceneId: activeScene.id,
              type: 'scene-layer-deleted',
            });
            if (result.ok && result.changed)
              setInspectorTarget({ id: activeScene.id, kind: 'scene' });
          }}
          onDeleteKeyframe={() => {
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
          }}
          onDeleteToken={deleteSelectedToken}
          onDuplicateScene={() => {
            if (!selectedScene) return;
            const command = createSceneDuplicatedCommand(
              project,
              selectedScene.id,
            );
            executeAndSelectCreated(command, 'scene', command.id);
          }}
          onDuplicateGroup={() => {
            if (!selectedGroup) return;
            const command = createGroupDuplicatedCommand(
              project,
              selectedGroup.id,
            );
            const result = onExecuteCommand(command);
            if (result.ok && result.changed) {
              const source = project.groups.find(
                (group) => group.id === selectedGroup.id,
              )!;
              setSelectedLedIds(source.ledIds);
              setLedSelectionSource({ id: command.id, kind: 'project-group' });
              setInspectorTarget({ id: command.id, kind: 'group' });
            }
          }}
          onDuplicateLayer={() => {
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
          }}
          onDuplicateKeyframe={() => {
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
          }}
          onMoveLayer={(toIndex) => {
            if (!selectedLayer || !activeScene) return;
            onExecuteCommand({
              id: selectedLayer.id,
              sceneId: activeScene.id,
              toIndex,
              type: 'scene-layer-moved',
            });
          }}
          onDuplicateToken={() => {
            if (!selectedToken) return;
            const command = createPaletteTokenDuplicatedCommand(
              project,
              selectedToken.id,
            );
            executeAndSelectCreated(command, 'palette', command.id);
          }}
          onPaint={(paletteTokenId) => {
            if (!activeScene) return;
            onExecuteCommand({
              ledIds: selectedLedIds,
              paletteTokenId,
              sceneId: activeScene.id,
              type: 'scene-leds-painted',
            });
          }}
          onSelectionChange={(ledIds) => {
            setSelectedLedIds(ledIds);
            setLedSelectionSource({ kind: 'direct' });
          }}
          onToggle={() => togglePanel('right')}
          onTurnOff={() => {
            if (!activeScene) return;
            onExecuteCommand({
              ledIds: selectedLedIds,
              sceneId: activeScene.id,
              type: 'scene-leds-turned-off',
            });
          }}
          onUpdateScene={(changes) => {
            if (!selectedScene) return;
            onExecuteCommand({
              changes,
              id: selectedScene.id,
              type: 'scene-updated',
            });
          }}
          onUpdateGroup={(changes) => {
            if (!selectedGroup) return;
            onExecuteCommand({
              changes,
              id: selectedGroup.id,
              type: 'group-updated',
            });
            if (changes.ledIds) {
              setLedSelectionSource({
                id: selectedGroup.id,
                kind: 'project-group',
              });
            }
          }}
          onUpdateLayer={(changes, options) => {
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
          }}
          onUpdateKeyframe={(changes) => {
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
          }}
          onBackToLayer={() => {
            if (!activeScene || !selectedKeyframeLayer) return;
            setInspectorTarget({
              id: selectedKeyframeLayer.id,
              kind: 'layer',
              sceneId: activeScene.id,
            });
          }}
          onUpdateToken={(changes, options) => {
            if (!selectedToken) return;
            onExecuteCommand(
              {
                changes,
                id: selectedToken.id,
                type: 'palette-token-updated',
              },
              options,
            );
          }}
        />

        <WorkspaceResizer
          collapsed={layout.bottomCollapsed}
          max={420}
          min={bottomPanelMinimumHeight}
          onKeyDown={resizeWithKeyboard}
          onPointerDown={beginResize}
          orientation="horizontal"
          panel="bottom"
          value={bottomPanelHeight}
        />
        <TimelinePanel
          collapsed={layout.bottomCollapsed}
          canAddEffect={colours.length > 0}
          controller={previewController}
          expandedKeyframeLayerIds={expandedKeyframeLayerIds}
          palette={colours}
          scene={activeScene}
          selectedKeyframeId={
            inspectorTarget.kind === 'keyframe' ? inspectorTarget.id : null
          }
          selectedLayerId={
            inspectorTarget.kind === 'layer' ? inspectorTarget.id : null
          }
          timing={project.timing}
          onAddKeyframe={(layerId, beat, value) => {
            if (!activeScene) return;
            const command = createKeyframeAddedCommand(
              project,
              activeScene.id,
              layerId,
              beat,
              value,
            );
            const result = onExecuteCommand(command);
            if (!result.ok || !result.changed) return;
            setInspectorTarget({
              id: command.id,
              kind: 'keyframe',
              layerId,
              sceneId: activeScene.id,
              track: value.track,
            });
          }}
          onAddLayer={addLayer}
          onMoveLayer={(id, toIndex) => {
            if (!activeScene) return;
            onExecuteCommand({
              id,
              sceneId: activeScene.id,
              toIndex,
              type: 'scene-layer-moved',
            });
          }}
          onSelectLayer={(id) => {
            if (activeScene)
              setInspectorTarget({
                id,
                kind: 'layer',
                sceneId: activeScene.id,
              });
          }}
          onSelectKeyframe={(layerId, track, id) => {
            if (!activeScene) return;
            setInspectorTarget({
              id,
              kind: 'keyframe',
              layerId,
              sceneId: activeScene.id,
              track,
            });
          }}
          onToggleKeyframeLayer={(id) => {
            setExpandedKeyframeLayerIds((current) =>
              current.includes(id)
                ? current.filter((layerId) => layerId !== id)
                : [...current, id],
            );
          }}
          onUpdateKeyframe={(layerId, track, id, beat, options) => {
            if (!activeScene) return;
            onExecuteCommand(
              {
                changes: { beat },
                id,
                layerId,
                sceneId: activeScene.id,
                track,
                type: 'keyframe-updated',
              },
              options,
            );
          }}
          onUpdateLayer={(id, changes, options) => {
            if (!activeScene) return;
            onExecuteCommand(
              {
                changes,
                id,
                sceneId: activeScene.id,
                type: 'scene-layer-updated',
              },
              options,
            );
          }}
          onToggle={() => togglePanel('bottom')}
        />
      </div>
    </main>
  );
}
