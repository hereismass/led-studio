import {
  createKeyframeAddedCommand,
  createPaletteTokenAddedCommand,
  createSceneLayerAddedCommand,
  createGroupAddedCommand,
  createSceneAddedCommand,
  createSongAddedCommand,
  createSongCueAddedCommand,
  createSongCueDuplicatedCommand,
  createSongDuplicatedCommand,
  paletteTokenUsageCount,
  projectGroupUsageCount,
  type EditorCommand,
  type ExecuteEditorCommandOptions,
  type SceneLayerTemplateId,
} from '@led-studio/editor-core';
import { getHardwareProfile } from '@led-studio/hardware-profiles';
import type {
  LayerTarget,
  ProjectGroup,
  Scene,
  Song,
} from '@led-studio/project-format';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AssetsPanel } from '@/features/assets/AssetsPanel';
import { InspectorPanel } from '@/features/inspector/InspectorPanel';
import { useScenePreview } from '@/features/playback/useScenePreview';
import { HardwarePanel } from '@/features/preview/HardwarePanel';
import { TimelinePanel } from '@/features/timeline/TimelinePanel';
import type { EditorClipboard } from '@/workspace/model/editorClipboard';
import { createInspectorActions } from '@/workspace/model/createInspectorActions';
import { useWorkspaceClipboard } from '@/workspace/model/useWorkspaceClipboard';
import { useWorkspaceLayout } from '@/workspace/model/useWorkspaceLayout';
import { useWorkspaceSelection } from '@/workspace/model/useWorkspaceSelection';
import { deriveWorkspaceSelection } from '@/workspace/model/workspaceSelectionModel';
import { WorkspaceResizer } from '@/workspace/shell/WorkspaceResizer';
import { WorkspaceToolbar } from '@/workspace/shell/WorkspaceToolbar';
import {
  type ActiveProjectSession,
  type EditorCommandResult,
  type ProjectOperation,
  type SaveFeedback,
} from '@/app/session/projectSession';
interface ProjectWorkspaceProps {
  activeProject: ActiveProjectSession;
  canRedo: boolean;
  canUndo: boolean;
  editorFeedback: string | null;
  editorClipboard: EditorClipboard | null;
  onChooseAnother: () => void;
  onExecuteCommand: (
    command: EditorCommand,
    options?: ExecuteEditorCommandOptions,
  ) => EditorCommandResult;
  onEditorClipboardChange: (clipboard: EditorClipboard) => void;
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
  editorClipboard,
  onChooseAnother,
  onExecuteCommand,
  onEditorClipboardChange,
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
  const [activeSongId, setActiveSongId] = useState<string | null>(
    project.songs[0]?.id ?? null,
  );
  const [activeCueId, setActiveCueId] = useState<string | null>(
    project.songs[0]?.cues[0]?.id ?? null,
  );
  const [timelineTab, setTimelineTab] = useState<'scene' | 'song'>('scene');
  const activeSong =
    project.songs.find((song) => song.id === activeSongId) ?? null;
  const transportTiming =
    timelineTab === 'song' && activeSong ? activeSong.timing : project.timing;
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
  } = useWorkspaceSelection(scenes, colours, project.groups, project.songs);

  const [expandedKeyframeLayerIds, setExpandedKeyframeLayerIds] = useState<
    string[]
  >([]);
  const {
    activeScene,
    canDuplicateKeyframe,
    selectedGroup,
    selectedKeyframe,
    selectedKeyframeLayer,
    selectedKeyframeReferences,
    selectedKeyframeTrack,
    selectedLayer,
    selectedLeds,
    selectedScene,
    selectedSong,
    selectedToken,
  } = useMemo(
    () =>
      deriveWorkspaceSelection(
        project,
        profile,
        activeSceneId,
        inspectorTarget,
        selectedLedIds,
      ),
    [activeSceneId, inspectorTarget, profile, project, selectedLedIds],
  );
  const previewController = useScenePreview(
    activeScene,
    transportTiming.previewBpm,
  );
  const completedCueLoopsRef = useRef(0);
  const previousPreviewPositionRef = useRef(0);
  const resumeAfterCueRef = useRef(false);
  const {
    beginResize,
    bottomPanelHeight,
    bottomPanelMinimumHeight,
    layout,
    resetLayout,
    resizeWithKeyboard,
    setTimelinePixelsPerBeat,
    setTimelineSnap,
    setTimelineZoomMode,
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
  const {
    copyKeyframeSelection,
    deleteKeyframeSelection,
    duplicateKeyframeSelection,
    feedback: workspaceFeedback,
    onKeyframeAction,
    onLayerAction,
  } = useWorkspaceClipboard({
    activeScene,
    clipboard: editorClipboard,
    controller: previewController,
    onClipboardChange: onEditorClipboardChange,
    onExecuteCommand,
    onExpandedKeyframeLayersChange: setExpandedKeyframeLayerIds,
    onInspectorTargetChange: setInspectorTarget,
    onTimelinePixelsPerBeatChange: setTimelinePixelsPerBeat,
    onTimelineZoomModeChange: setTimelineZoomMode,
    profile,
    project,
    selectedKeyframeLayer,
    selectedKeyframes: selectedKeyframeReferences,
    selectedLayer,
    snap: layout.timelineSnap,
    timelinePixelsPerBeat: layout.timelinePixelsPerBeat,
  });

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

  useEffect(() => {
    if (activeSongId && !project.songs.some(({ id }) => id === activeSongId)) {
      const song = project.songs[0] ?? null;
      setActiveSongId(song?.id ?? null);
      setActiveCueId(song?.cues[0]?.id ?? null);
    } else if (
      activeSong &&
      activeCueId &&
      !activeSong.cues.some(({ id }) => id === activeCueId)
    ) {
      setActiveCueId(activeSong.cues[0]?.id ?? null);
    }
  }, [activeCueId, activeSong, activeSongId, project.songs]);

  useEffect(() => {
    completedCueLoopsRef.current = 0;
    previousPreviewPositionRef.current =
      previewController.getSnapshot().positionBeats;
  }, [activeCueId, previewController]);

  useEffect(() => {
    if (!resumeAfterCueRef.current) return;
    resumeAfterCueRef.current = false;
    previewController.play();
  }, [activeSceneId, previewController]);

  useEffect(
    () =>
      previewController.subscribe(() => {
        const snapshot = previewController.getSnapshot();
        const previous = previousPreviewPositionRef.current;
        previousPreviewPositionRef.current = snapshot.positionBeats;
        if (
          timelineTab !== 'song' ||
          snapshot.status !== 'playing' ||
          snapshot.positionBeats >= previous ||
          !activeSong ||
          !activeCueId
        )
          return;
        const cueIndex = activeSong.cues.findIndex(
          ({ id }) => id === activeCueId,
        );
        const cue = activeSong.cues[cueIndex];
        if (!cue || cue.advance.kind !== 'after-loops') return;
        completedCueLoopsRef.current += 1;
        if (completedCueLoopsRef.current < cue.advance.loopCount) return;
        const nextCue = activeSong.cues[cueIndex + 1];
        if (!nextCue) return;
        resumeAfterCueRef.current = true;
        setActiveCueId(nextCue.id);
        const scene = scenes.find(({ id }) => id === nextCue.sceneId);
        if (!scene) return;
        setActiveSceneId(scene.id);
        setInspectorTarget({ id: activeSong.id, kind: 'song' });
        setSelectedLedIds([]);
        setLedSelectionSource({ kind: 'direct' });
      }),
    [
      activeCueId,
      activeSong,
      previewController,
      scenes,
      setActiveSceneId,
      setInspectorTarget,
      setLedSelectionSource,
      setSelectedLedIds,
      timelineTab,
    ],
  );

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

  function activateScene(scene: Scene, keepSongTimeline = false) {
    if (!keepSongTimeline) setTimelineTab('scene');
    setActiveSceneId(scene.id);
    setInspectorTarget({ id: scene.id, kind: 'scene' });
    setSelectedLedIds([]);
    setLedSelectionSource({ kind: 'direct' });
  }

  function activateSong(song: Song) {
    setTimelineTab('song');
    setActiveSongId(song.id);
    const cue = song.cues[0] ?? null;
    setActiveCueId(cue?.id ?? null);
    const scene = cue
      ? project.scenes.find(({ id }) => id === cue.sceneId)
      : null;
    setActiveSceneId(scene?.id ?? null);
    setInspectorTarget({ id: song.id, kind: 'song' });
    setSelectedLedIds([]);
    setLedSelectionSource({ kind: 'direct' });
  }

  function activateCue(id: string) {
    const cue = activeSong?.cues.find((candidate) => candidate.id === id);
    if (!cue) return;
    setActiveCueId(cue.id);
    const scene = scenes.find(({ id: sceneId }) => sceneId === cue.sceneId);
    setActiveSceneId(scene?.id ?? null);
    setInspectorTarget({ id: activeSong!.id, kind: 'song' });
    setSelectedLedIds([]);
    setLedSelectionSource({ kind: 'direct' });
  }

  function selectTimelineTab(tab: 'scene' | 'song') {
    setTimelineTab(tab);
    if (tab === 'song' && activeSong) {
      setInspectorTarget({ id: activeSong.id, kind: 'song' });
    } else if (tab === 'scene' && activeScene) {
      setInspectorTarget({ id: activeScene.id, kind: 'scene' });
    }
  }

  function deleteScene(scene: Scene) {
    const index = scenes.findIndex(({ id }) => id === scene.id);
    const nearest = scenes[index + 1] ?? scenes[index - 1] ?? null;
    const result = onExecuteCommand({ id: scene.id, type: 'scene-deleted' });
    if (!result.ok || !result.changed) return;
    if (activeSceneId === scene.id) setActiveSceneId(nearest?.id ?? null);
    setInspectorTarget(
      nearest ? { id: nearest.id, kind: 'scene' } : { kind: 'project' },
    );
    setSelectedLedIds([]);
  }

  function deleteSelectedSong() {
    if (!selectedSong) return;
    const index = project.songs.findIndex(({ id }) => id === selectedSong.id);
    const next = project.songs[index + 1] ?? project.songs[index - 1] ?? null;
    const result = onExecuteCommand({
      id: selectedSong.id,
      type: 'song-deleted',
    });
    if (!result.ok || !result.changed) return;
    const nextCue = next?.cues[0] ?? null;
    const nextScene = nextCue
      ? scenes.find(({ id }) => id === nextCue.sceneId)
      : null;
    setActiveSongId(next?.id ?? null);
    setActiveCueId(nextCue?.id ?? null);
    setActiveSceneId(nextScene?.id ?? null);
    setInspectorTarget(
      next ? { id: next.id, kind: 'song' } : { kind: 'project' },
    );
    if (!next) setTimelineTab('scene');
  }

  function duplicateSelectedSong() {
    if (!selectedSong) return;
    const command = createSongDuplicatedCommand(project, selectedSong.id);
    const result = onExecuteCommand(command);
    if (!result.ok || !result.changed) return;
    const cueId = command.cueIds[0] ?? null;
    const scene = selectedSong.cues[0]
      ? scenes.find(({ id }) => id === selectedSong.cues[0].sceneId)
      : null;
    setActiveSongId(command.id);
    setActiveCueId(cueId);
    setActiveSceneId(scene?.id ?? null);
    setTimelineTab('song');
    setInspectorTarget({ id: command.id, kind: 'song' });
  }

  function moveSelectedSong(toIndex: number) {
    if (!selectedSong) return;
    onExecuteCommand({
      id: selectedSong.id,
      toIndex,
      type: 'song-moved',
    });
  }

  function updateSelectedSong(
    changes: Partial<Pick<Song, 'launchQuantization' | 'name' | 'timing'>>,
  ) {
    if (!selectedSong) return;
    onExecuteCommand({
      changes,
      id: selectedSong.id,
      type: 'song-updated',
    });
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

  function addLayer(layerType: SceneLayerTemplateId) {
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

  const inspectorActions = createInspectorActions({
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
  });

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
        timing={transportTiming}
        onTimingCommit={(changes) => {
          if (timelineTab === 'song' && activeSong) {
            onExecuteCommand({
              changes: {
                timing: { ...activeSong.timing, ...changes },
              },
              id: activeSong.id,
              type: 'song-updated',
            });
          } else {
            onExecuteCommand({
              changes,
              type: 'project-timing-updated',
            });
          }
        }}
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
      {workspaceFeedback ? (
        <div className="workspace-feedback" role="status">
          {workspaceFeedback}
        </div>
      ) : null}

      <div className="workspace-editor">
        <AssetsPanel
          activeSceneId={activeSceneId}
          activeSongId={
            inspectorTarget.kind === 'song' ? inspectorTarget.id : null
          }
          collapsed={layout.leftCollapsed}
          groups={project.groups}
          hasLedSelection={selectedLedIds.length > 0}
          palette={colours}
          scenes={scenes}
          songs={project.songs}
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
          onAddSong={() => {
            const command = createSongAddedCommand(project);
            const result = onExecuteCommand(command);
            if (!result.ok || !result.changed) return;
            setTimelineTab('song');
            setActiveSongId(command.id);
            setActiveCueId(null);
            setActiveSceneId(null);
            setInspectorTarget({ id: command.id, kind: 'song' });
          }}
          onSelectPalette={(id) => {
            setInspectorTarget({ id, kind: 'palette' });
            setFocusTokenId(null);
          }}
          onSelectGroup={selectProjectGroup}
          onSelectScene={activateScene}
          onSelectSong={activateSong}
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
          selectedKeyframeReferences={selectedKeyframeReferences}
          selectedKeyframeTrack={selectedKeyframeTrack}
          selectedScene={selectedScene}
          selectedSong={selectedSong}
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
          onDeleteSong={deleteSelectedSong}
          onDuplicateSong={duplicateSelectedSong}
          onMoveSong={moveSelectedSong}
          onUpdateSong={updateSelectedSong}
          {...inspectorActions}
          onToggle={() => togglePanel('right')}
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
          activeCueId={activeCueId}
          activeTab={timelineTab}
          collapsed={layout.bottomCollapsed}
          canAddEffect={colours.length > 0}
          controller={previewController}
          expandedKeyframeLayerIds={expandedKeyframeLayerIds}
          palette={colours}
          scene={activeScene}
          scenes={scenes}
          song={activeSong}
          selectedKeyframes={selectedKeyframeReferences}
          selectedLayerId={
            inspectorTarget.kind === 'layer' ? inspectorTarget.id : null
          }
          snap={layout.timelineSnap}
          timing={project.timing}
          timelinePixelsPerBeat={layout.timelinePixelsPerBeat}
          timelineZoomMode={layout.timelineZoomMode}
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
          onAddCue={(sceneId) => {
            if (!activeSong) return;
            const command = createSongCueAddedCommand(
              project,
              activeSong.id,
              sceneId,
            );
            const result = onExecuteCommand(command);
            if (!result.ok || !result.changed) return;
            setActiveCueId(command.id);
            const scene = scenes.find(({ id }) => id === sceneId);
            setActiveSceneId(scene?.id ?? null);
            setInspectorTarget({ id: activeSong.id, kind: 'song' });
          }}
          onDeleteCue={(id) => {
            if (!activeSong) return;
            const index = activeSong.cues.findIndex((cue) => cue.id === id);
            const next =
              activeSong.cues[index + 1] ?? activeSong.cues[index - 1] ?? null;
            const result = onExecuteCommand({
              id,
              songId: activeSong.id,
              type: 'song-cue-deleted',
            });
            if (result.ok && result.changed) {
              setActiveCueId(next?.id ?? null);
              const scene = next
                ? scenes.find(({ id: sceneId }) => sceneId === next.sceneId)
                : null;
              setActiveSceneId(scene?.id ?? null);
              setInspectorTarget({ id: activeSong.id, kind: 'song' });
            }
          }}
          onDuplicateCue={(id) => {
            if (!activeSong) return;
            const command = createSongCueDuplicatedCommand(
              project,
              activeSong.id,
              id,
            );
            const result = onExecuteCommand(command);
            if (result.ok && result.changed) setActiveCueId(command.newId);
          }}
          onMoveCue={(id, toIndex) => {
            if (!activeSong) return;
            onExecuteCommand({
              id,
              songId: activeSong.id,
              toIndex,
              type: 'song-cue-moved',
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
          onKeyframeAction={onKeyframeAction}
          onLayerAction={onLayerAction}
          onSelectLayer={(id) => {
            if (activeScene)
              setInspectorTarget({
                id,
                kind: 'layer',
                sceneId: activeScene.id,
              });
          }}
          onSelectCue={activateCue}
          onTabChange={selectTimelineTab}
          onSelectKeyframes={(layerId, keyframes, primary) => {
            if (!activeScene) return;
            setInspectorTarget(
              keyframes.length === 1
                ? {
                    id: keyframes[0].id,
                    kind: 'keyframe',
                    layerId,
                    sceneId: activeScene.id,
                    track: keyframes[0].track,
                  }
                : {
                    keyframes,
                    kind: 'keyframes',
                    layerId,
                    primary,
                    sceneId: activeScene.id,
                  },
            );
          }}
          onToggleKeyframeLayer={(id) => {
            setExpandedKeyframeLayerIds((current) =>
              current.includes(id)
                ? current.filter((layerId) => layerId !== id)
                : [...current, id],
            );
          }}
          onTimelinePixelsPerBeatChange={setTimelinePixelsPerBeat}
          onTimelineSnapChange={setTimelineSnap}
          onTimelineZoomModeChange={setTimelineZoomMode}
          onUpdateKeyframes={(layerId, keyframes, options) => {
            if (!activeScene) return;
            onExecuteCommand(
              {
                keyframes,
                layerId,
                sceneId: activeScene.id,
                type: 'keyframes-moved',
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
          onUpdateCue={(id, changes) => {
            if (!activeSong) return;
            const result = onExecuteCommand({
              changes,
              id,
              songId: activeSong.id,
              type: 'song-cue-updated',
            });
            if (result.ok && result.changed && changes.sceneId) {
              const scene = scenes.find(({ id }) => id === changes.sceneId);
              setActiveSceneId(scene?.id ?? null);
              setInspectorTarget({ id: activeSong.id, kind: 'song' });
            }
          }}
          onToggle={() => togglePanel('bottom')}
        />
      </div>
    </main>
  );
}
