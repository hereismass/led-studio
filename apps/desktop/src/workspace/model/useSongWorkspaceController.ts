import {
  createSongAddedCommand,
  createSongCueAddedCommand,
  createSongCueDuplicatedCommand,
  createSongDuplicatedCommand,
  type EditorCommand,
} from '@led-studio/editor-core';
import {
  compileSongPlayback,
  createSongPlaybackState,
  type SongPlaybackState,
} from '@led-studio/playback';
import type { Project, Scene, Song, SongCue } from '@led-studio/project-format';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { InspectorTarget } from '@/features/inspector/inspectorTarget';
import { useScenePreview } from '@/features/playback/useScenePreview';
import type { LedSelectionSource } from './useWorkspaceSelection';

type TimelineTab = 'scene' | 'song';
type PreviewContext = 'scene' | 'song';

interface SongWorkspaceState {
  activeCueId: string | null;
  activeSongId: string | null;
  previewContext: PreviewContext;
  timelineTab: TimelineTab;
}

type SongWorkspaceAction =
  | {
      activeCueId: string | null;
      activeSongId: string | null;
      previewContext?: PreviewContext;
      type: 'selection-changed';
    }
  | { tab: TimelineTab; type: 'tab-changed' };

export function songWorkspaceReducer(
  state: SongWorkspaceState,
  action: SongWorkspaceAction,
): SongWorkspaceState {
  switch (action.type) {
    case 'selection-changed':
      return {
        ...state,
        activeCueId: action.activeCueId,
        activeSongId: action.activeSongId,
        previewContext: action.previewContext ?? state.previewContext,
      };
    case 'tab-changed':
      return { ...state, timelineTab: action.tab };
  }
}

interface CommandResult {
  changed?: boolean;
  message?: string;
  ok: boolean;
}

interface UseSongWorkspaceControllerInput {
  activeSceneId: string | null;
  project: Project;
  setActiveSceneId: Dispatch<SetStateAction<string | null>>;
  setInspectorTarget: Dispatch<SetStateAction<InspectorTarget>>;
  setLedSelectionSource: Dispatch<SetStateAction<LedSelectionSource>>;
  setSelectedLedIds: Dispatch<SetStateAction<string[]>>;
  onExecuteCommand: (command: EditorCommand) => CommandResult;
}

interface ResumeRequest {
  positionBeats: number;
}

export function useSongWorkspaceController({
  activeSceneId,
  onExecuteCommand,
  project,
  setActiveSceneId,
  setInspectorTarget,
  setLedSelectionSource,
  setSelectedLedIds,
}: UseSongWorkspaceControllerInput) {
  const [state, dispatch] = useReducer(songWorkspaceReducer, {
    activeCueId: project.songs[0]?.cues[0]?.id ?? null,
    activeSongId: project.songs[0]?.id ?? null,
    previewContext: 'scene',
    timelineTab: 'scene',
  });
  const activeSong = useMemo(
    () => project.songs.find((song) => song.id === state.activeSongId) ?? null,
    [project.songs, state.activeSongId],
  );
  const transportTiming =
    state.previewContext === 'song' && activeSong
      ? activeSong.timing
      : project.timing;
  const activeScene = useMemo(
    () => project.scenes.find((scene) => scene.id === activeSceneId) ?? null,
    [activeSceneId, project.scenes],
  );
  const previewController = useScenePreview(
    activeScene,
    transportTiming.previewBpm,
  );
  const compiledSongPlayback = useMemo(
    () => (activeSong ? compileSongPlayback(activeSong, project.scenes) : null),
    [activeSong, project.scenes],
  );
  const activeSongRef = useRef(activeSong);
  const projectRef = useRef(project);
  const stateRef = useRef(state);
  activeSongRef.current = activeSong;
  projectRef.current = project;
  stateRef.current = state;
  const transportStateRef = useRef<SongPlaybackState>(
    activeSong
      ? createSongPlaybackState(activeSong)
      : {
          activeCueId: null,
          completedLoops: 0,
          cuePositionBeats: 0,
          finalCueHeld: false,
        },
  );
  const resumeRequestRef = useRef<ResumeRequest | null>(null);
  const [resumeVersion, setResumeVersion] = useState(0);

  const resetLedSelection = useCallback(() => {
    setSelectedLedIds([]);
    setLedSelectionSource({ kind: 'direct' });
  }, [setLedSelectionSource, setSelectedLedIds]);

  const setTransportCue = useCallback((cueId: string | null) => {
    transportStateRef.current = {
      activeCueId: cueId,
      completedLoops: 0,
      cuePositionBeats: 0,
      finalCueHeld: false,
    };
  }, []);

  const previewSongCue = useCallback(
    (
      songId: string,
      cue: Pick<SongCue, 'id' | 'sceneId'> | null,
      resume: ResumeRequest | null = null,
    ) => {
      if (resume) resumeRequestRef.current = resume;
      previewController.stop();
      setTransportCue(cue?.id ?? null);
      if (resume)
        transportStateRef.current.cuePositionBeats = resume.positionBeats;
      dispatch({
        activeCueId: cue?.id ?? null,
        activeSongId: songId,
        previewContext: 'song',
        type: 'selection-changed',
      });
      setActiveSceneId(cue?.sceneId ?? null);
      if (resume) setResumeVersion((version) => version + 1);
    },
    [previewController, setActiveSceneId, setTransportCue],
  );

  useEffect(() => {
    const song =
      project.songs.find(({ id }) => id === state.activeSongId) ??
      project.songs[0] ??
      null;
    const cue =
      song?.cues.find(({ id }) => id === state.activeCueId) ??
      song?.cues[0] ??
      null;
    if (song?.id !== state.activeSongId || cue?.id !== state.activeCueId) {
      setTransportCue(cue?.id ?? null);
      dispatch({
        activeCueId: cue?.id ?? null,
        activeSongId: song?.id ?? null,
        type: 'selection-changed',
      });
      if (state.previewContext === 'song') {
        setActiveSceneId(cue?.sceneId ?? null);
      }
    }
  }, [
    project.songs,
    setActiveSceneId,
    setTransportCue,
    state.activeCueId,
    state.activeSongId,
    state.previewContext,
  ]);

  useEffect(() => {
    const request = resumeRequestRef.current;
    if (!request) return;
    resumeRequestRef.current = null;
    previewController.seek(request.positionBeats);
    previewController.play();
  }, [previewController, resumeVersion]);

  useEffect(
    () =>
      previewController.subscribeBeatAdvance((elapsedBeats) => {
        if (
          state.previewContext !== 'song' ||
          !activeSong ||
          !compiledSongPlayback
        )
          return;
        const previous = transportStateRef.current;
        const next = compiledSongPlayback.advance(previous, elapsedBeats);
        transportStateRef.current = next;
        if (next.activeCueId === previous.activeCueId) return;
        const nextCue = activeSong.cues.find(
          ({ id }) => id === next.activeCueId,
        );
        if (!nextCue) return;
        previewSongCue(activeSong.id, nextCue, {
          positionBeats: next.cuePositionBeats,
        });
      }),
    [
      activeSong,
      compiledSongPlayback,
      previewController,
      previewSongCue,
      state.previewContext,
    ],
  );

  useEffect(
    () =>
      previewController.subscribeSeek((positionBeats) => {
        if (state.previewContext !== 'song') return;
        transportStateRef.current = {
          ...transportStateRef.current,
          cuePositionBeats: positionBeats,
        };
      }),
    [previewController, state.previewContext],
  );

  useEffect(
    () =>
      previewController.subscribe(() => {
        if (
          state.previewContext !== 'song' ||
          previewController.getSnapshot().status !== 'stopped' ||
          resumeRequestRef.current
        )
          return;
        setTransportCue(state.activeCueId);
      }),
    [
      previewController,
      setTransportCue,
      state.activeCueId,
      state.previewContext,
    ],
  );

  function activateStandaloneScene(scene: Pick<Scene, 'id'>) {
    previewController.stop();
    dispatch({
      activeCueId: state.activeCueId,
      activeSongId: state.activeSongId,
      previewContext: 'scene',
      type: 'selection-changed',
    });
    dispatch({ tab: 'scene', type: 'tab-changed' });
    setActiveSceneId(scene.id);
    setInspectorTarget({ id: scene.id, kind: 'scene' });
    resetLedSelection();
  }

  function activateSong(song: Song) {
    const cue = song.cues[0] ?? null;
    previewSongCue(song.id, cue);
    dispatch({ tab: 'song', type: 'tab-changed' });
    setInspectorTarget({ id: song.id, kind: 'song' });
    resetLedSelection();
  }

  const activateCue = useCallback(
    (id: string) => {
      const song = activeSongRef.current;
      const cue = song?.cues.find((candidate) => candidate.id === id);
      if (!song || !cue) return;
      previewSongCue(song.id, cue);
      setInspectorTarget({ id: song.id, kind: 'song' });
      resetLedSelection();
    },
    [previewSongCue, resetLedSelection, setInspectorTarget],
  );

  function selectTimelineTab(tab: TimelineTab) {
    dispatch({ tab, type: 'tab-changed' });
    if (tab === 'song' && activeSong) {
      setInspectorTarget({ id: activeSong.id, kind: 'song' });
    } else if (tab === 'scene' && activeScene) {
      setInspectorTarget({ id: activeScene.id, kind: 'scene' });
    }
  }

  function addSong() {
    const command = createSongAddedCommand(project);
    const result = onExecuteCommand(command);
    if (!result.ok || !result.changed) return;
    previewSongCue(command.id, null);
    dispatch({ tab: 'song', type: 'tab-changed' });
    setInspectorTarget({ id: command.id, kind: 'song' });
    resetLedSelection();
  }

  function deleteSong(song: Song) {
    const index = project.songs.findIndex(({ id }) => id === song.id);
    const next = project.songs[index + 1] ?? project.songs[index - 1] ?? null;
    const result = onExecuteCommand({ id: song.id, type: 'song-deleted' });
    if (!result.ok || !result.changed) return;
    const nextCue = next?.cues[0] ?? null;
    if (next) {
      previewSongCue(next.id, nextCue);
      setInspectorTarget({ id: next.id, kind: 'song' });
    } else {
      previewController.stop();
      setTransportCue(null);
      dispatch({
        activeCueId: null,
        activeSongId: null,
        previewContext: 'scene',
        type: 'selection-changed',
      });
      dispatch({ tab: 'scene', type: 'tab-changed' });
      setActiveSceneId(project.scenes[0]?.id ?? null);
      setInspectorTarget({ kind: 'project' });
    }
  }

  function duplicateSong(song: Song) {
    const command = createSongDuplicatedCommand(project, song.id);
    const result = onExecuteCommand(command);
    if (!result.ok || !result.changed) return;
    const firstCue = song.cues[0]
      ? { ...song.cues[0], id: command.cueIds[0] }
      : null;
    previewSongCue(command.id, firstCue);
    dispatch({ tab: 'song', type: 'tab-changed' });
    setInspectorTarget({ id: command.id, kind: 'song' });
    resetLedSelection();
  }

  const addCue = useCallback(
    (sceneId: string) => {
      const song = activeSongRef.current;
      if (!song) return;
      const command = createSongCueAddedCommand(
        projectRef.current,
        song.id,
        sceneId,
      );
      const result = onExecuteCommand(command);
      if (!result.ok || !result.changed) return;
      previewSongCue(song.id, { id: command.id, sceneId });
      setInspectorTarget({ id: song.id, kind: 'song' });
    },
    [onExecuteCommand, previewSongCue, setInspectorTarget],
  );

  const deleteCue = useCallback(
    (id: string) => {
      const song = activeSongRef.current;
      if (!song) return;
      const index = song.cues.findIndex((cue) => cue.id === id);
      if (index === -1) return;
      const result = onExecuteCommand({
        id,
        songId: song.id,
        type: 'song-cue-deleted',
      });
      if (!result.ok || !result.changed || id !== stateRef.current.activeCueId)
        return;
      const next = song.cues[index + 1] ?? song.cues[index - 1] ?? null;
      previewSongCue(song.id, next);
      setInspectorTarget({ id: song.id, kind: 'song' });
    },
    [onExecuteCommand, previewSongCue, setInspectorTarget],
  );

  const duplicateCue = useCallback(
    (id: string) => {
      const song = activeSongRef.current;
      if (!song) return;
      const source = song.cues.find((cue) => cue.id === id);
      if (!source) return;
      const command = createSongCueDuplicatedCommand(
        projectRef.current,
        song.id,
        id,
      );
      const result = onExecuteCommand(command);
      if (!result.ok || !result.changed) return;
      previewSongCue(song.id, { ...source, id: command.newId });
      setInspectorTarget({ id: song.id, kind: 'song' });
    },
    [onExecuteCommand, previewSongCue, setInspectorTarget],
  );

  const moveCue = useCallback(
    (id: string, toIndex: number) => {
      const song = activeSongRef.current;
      if (!song) return;
      onExecuteCommand({
        id,
        songId: song.id,
        toIndex,
        type: 'song-cue-moved',
      });
    },
    [onExecuteCommand],
  );

  const updateCue = useCallback(
    (
      id: string,
      changes: Partial<Pick<SongCue, 'advance' | 'name' | 'sceneId'>>,
    ): CommandResult => {
      const song = activeSongRef.current;
      if (!song) return { message: 'No song is active.', ok: false };
      const result = onExecuteCommand({
        changes,
        id,
        songId: song.id,
        type: 'song-cue-updated',
      });
      if (
        result.ok &&
        result.changed &&
        changes.sceneId &&
        id === stateRef.current.activeCueId
      ) {
        previewSongCue(song.id, { id, sceneId: changes.sceneId });
        setInspectorTarget({ id: song.id, kind: 'song' });
      }
      return result;
    },
    [onExecuteCommand, previewSongCue, setInspectorTarget],
  );

  return {
    activeCueId: state.activeCueId,
    activeSong,
    activeSongId: state.activeSongId,
    activateCue,
    activateSong,
    activateStandaloneScene,
    addCue,
    addSong,
    deleteCue,
    deleteSong,
    duplicateCue,
    duplicateSong,
    moveCue,
    moveSong: (song: Song, toIndex: number) =>
      onExecuteCommand({ id: song.id, toIndex, type: 'song-moved' }),
    previewController,
    previewContext: state.previewContext,
    selectTimelineTab,
    timelineTab: state.timelineTab,
    transportTiming,
    updateCue,
    updateSong: (
      song: Song,
      changes: Partial<Pick<Song, 'launchQuantization' | 'name' | 'timing'>>,
    ) =>
      onExecuteCommand({
        changes,
        id: song.id,
        type: 'song-updated',
      }),
  };
}
