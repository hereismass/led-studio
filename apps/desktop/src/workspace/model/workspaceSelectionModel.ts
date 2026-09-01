import {
  nextAvailableKeyframeBeat,
  type KeyframeTrackKind,
} from '@led-studio/editor-core';
import type {
  HardwareLed,
  HardwareProfile,
} from '@led-studio/hardware-profiles';
import type {
  BrightnessKeyframe,
  ColourKeyframe,
  KeyframeLayer,
  PaletteToken,
  Project,
  ProjectGroup,
  Scene,
  SceneLayer,
} from '@led-studio/project-format';
import type { InspectorTarget } from '@/features/inspector/inspectorTarget';

export interface WorkspaceSelectionModel {
  activeScene: Scene | null;
  canDuplicateKeyframe: boolean;
  selectedGroup: ProjectGroup | null;
  selectedKeyframe: BrightnessKeyframe | ColourKeyframe | null;
  selectedKeyframeLayer: KeyframeLayer | null;
  selectedKeyframeTrack: KeyframeTrackKind | null;
  selectedKeyframeReferences: Array<{
    id: string;
    track: KeyframeTrackKind;
  }>;
  selectedLayer: SceneLayer | null;
  selectedLeds: HardwareLed[];
  selectedScene: Scene | null;
  selectedToken: PaletteToken | null;
}

export function deriveWorkspaceSelection(
  project: Project,
  profile: HardwareProfile,
  activeSceneId: string | null,
  inspectorTarget: InspectorTarget,
  selectedLedIds: readonly string[],
): WorkspaceSelectionModel {
  const activeScene =
    project.scenes.find((scene) => scene.id === activeSceneId) ?? null;
  const selectedToken =
    inspectorTarget.kind === 'palette'
      ? (project.palette.find((token) => token.id === inspectorTarget.id) ??
        null)
      : null;
  const selectedScene =
    inspectorTarget.kind === 'scene'
      ? (project.scenes.find((scene) => scene.id === inspectorTarget.id) ??
        null)
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
    (inspectorTarget.kind === 'keyframe' ||
      inspectorTarget.kind === 'keyframes') &&
    activeScene?.id === inspectorTarget.sceneId
      ? (activeScene.layers.find(
          (layer): layer is KeyframeLayer =>
            layer.id === inspectorTarget.layerId && layer.kind === 'keyframe',
        ) ?? null)
      : null;
  const selectedKeyframeTrack =
    inspectorTarget.kind === 'keyframe'
      ? inspectorTarget.track
      : inspectorTarget.kind === 'keyframes'
        ? inspectorTarget.primary.track
        : null;
  const selectedKeyframe =
    (inspectorTarget.kind === 'keyframe' ||
      inspectorTarget.kind === 'keyframes') &&
    selectedKeyframeLayer
      ? (selectedKeyframeLayer.tracks[selectedKeyframeTrack!].keyframes.find(
          ({ id }) =>
            id ===
            (inspectorTarget.kind === 'keyframe'
              ? inspectorTarget.id
              : inspectorTarget.primary.id),
        ) ?? null)
      : null;
  const selectedKeyframeReferences =
    inspectorTarget.kind === 'keyframe'
      ? [{ id: inspectorTarget.id, track: inspectorTarget.track }]
      : inspectorTarget.kind === 'keyframes'
        ? inspectorTarget.keyframes
        : [];
  const canDuplicateKeyframe = Boolean(
    selectedKeyframeLayer &&
    selectedKeyframe &&
    selectedKeyframeTrack &&
    nextAvailableKeyframeBeat(
      selectedKeyframeLayer,
      selectedKeyframeTrack,
      selectedKeyframe.beat,
      activeScene?.loopLengthBeats ?? 0,
    ) !== null,
  );
  const selectedIdSet = new Set(selectedLedIds);

  return {
    activeScene,
    canDuplicateKeyframe,
    selectedGroup,
    selectedKeyframe,
    selectedKeyframeLayer,
    selectedKeyframeReferences,
    selectedKeyframeTrack,
    selectedLayer,
    selectedLeds: profile.leds.filter((led) => selectedIdSet.has(led.id)),
    selectedScene,
    selectedToken,
  };
}
