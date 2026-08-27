import type { HardwareProfile } from '@led-studio/hardware-profiles';
import { compileSceneEvaluator } from '@led-studio/playback';
import type {
  PaletteToken,
  ProjectGroup,
  Scene,
} from '@led-studio/project-format';
import { FretboardEditor } from './FretboardEditor';
import type { PreviewPlaybackController } from './previewPlayback';
import { useMemo } from 'react';
import { usePreviewPlaybackPosition } from './usePreviewPlaybackSnapshot';

interface SceneFretboardProps {
  controller: PreviewPlaybackController;
  groups: ProjectGroup[];
  palette: PaletteToken[];
  profile: HardwareProfile;
  scene: Scene | null;
  selectedLedIds: string[];
  onSelectionChange: (ledIds: string[]) => void;
}

export function SceneFretboard({
  controller,
  groups,
  onSelectionChange,
  palette,
  profile,
  scene,
  selectedLedIds,
}: SceneFretboardProps) {
  const evaluator = useMemo(
    () =>
      scene ? compileSceneEvaluator(scene, palette, profile, groups) : null,
    [groups, palette, profile, scene],
  );
  const positionBeats = usePreviewPlaybackPosition(
    controller,
    evaluator?.isDynamic ?? false,
  );
  const frame = evaluator?.getFrame(positionBeats) ?? [];
  return (
    <FretboardEditor
      frame={frame}
      profile={profile}
      scene={scene}
      selectedLedIds={selectedLedIds}
      onSelectionChange={onSelectionChange}
    />
  );
}
