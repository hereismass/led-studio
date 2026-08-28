import type {
  PaletteToken,
  ProjectGroup,
  Scene,
} from '@led-studio/project-format';
import { useEffect, useState } from 'react';

export type InspectorTarget =
  | { kind: 'leds' }
  | { id: string; kind: 'palette' }
  | { kind: 'project' }
  | { id: string; kind: 'scene' }
  | { id: string; kind: 'group' }
  | { id: string; kind: 'layer'; sceneId: string }
  | {
      id: string;
      kind: 'keyframe';
      layerId: string;
      sceneId: string;
      track: 'brightness' | 'colour';
    };

export type LedSelectionSource =
  | { kind: 'direct' }
  | { id: string; kind: 'profile-group' }
  | { id: string; kind: 'project-group' };

export function useWorkspaceSelection(
  scenes: readonly Scene[],
  palette: readonly PaletteToken[],
  groups: readonly ProjectGroup[],
) {
  const initialSceneId = scenes[0]?.id ?? null;
  const [activeSceneId, setActiveSceneId] = useState<string | null>(
    initialSceneId,
  );
  const [focusTokenId, setFocusTokenId] = useState<string | null>(null);
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget>(
    initialSceneId
      ? { id: initialSceneId, kind: 'scene' }
      : { kind: 'project' },
  );
  const [selectedLedIds, setSelectedLedIds] = useState<string[]>([]);
  const [ledSelectionSource, setLedSelectionSource] =
    useState<LedSelectionSource>({ kind: 'direct' });

  useEffect(() => {
    if (activeSceneId && !scenes.some((scene) => scene.id === activeSceneId)) {
      const nearest = scenes[0] ?? null;
      setActiveSceneId(nearest?.id ?? null);
      setSelectedLedIds([]);
      setLedSelectionSource({ kind: 'direct' });
      setInspectorTarget(
        nearest ? { id: nearest.id, kind: 'scene' } : { kind: 'project' },
      );
    }
    if (
      inspectorTarget.kind === 'palette' &&
      !palette.some((token) => token.id === inspectorTarget.id)
    ) {
      setInspectorTarget({ kind: 'project' });
    }
    if (
      inspectorTarget.kind === 'group' &&
      !groups.some((group) => group.id === inspectorTarget.id)
    ) {
      setInspectorTarget({ kind: 'project' });
    }
    if (inspectorTarget.kind === 'layer') {
      const scene = scenes.find(({ id }) => id === inspectorTarget.sceneId);
      if (!scene?.layers.some((layer) => layer.id === inspectorTarget.id)) {
        setInspectorTarget(
          scene ? { id: scene.id, kind: 'scene' } : { kind: 'project' },
        );
      }
    }
    if (inspectorTarget.kind === 'keyframe') {
      const scene = scenes.find(({ id }) => id === inspectorTarget.sceneId);
      const layer = scene?.layers.find(
        ({ id }) => id === inspectorTarget.layerId,
      );
      const exists =
        layer?.kind === 'keyframe' &&
        layer.tracks[inspectorTarget.track].keyframes.some(
          ({ id }) => id === inspectorTarget.id,
        );
      if (!exists) {
        setInspectorTarget(
          layer
            ? { id: layer.id, kind: 'layer', sceneId: inspectorTarget.sceneId }
            : scene
              ? { id: scene.id, kind: 'scene' }
              : { kind: 'project' },
        );
      }
    }
  }, [activeSceneId, groups, inspectorTarget, palette, scenes]);

  return {
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
  };
}
