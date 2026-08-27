import type { HardwareProfile } from '@led-studio/hardware-profiles';
import { evaluateSceneFrame } from '@led-studio/playback';
import type { PaletteToken, Scene } from '@led-studio/project-format';
import { FretboardEditor } from './FretboardEditor';
import type { PreviewPlaybackController } from './previewPlayback';
import { usePreviewPlaybackSnapshot } from './usePreviewPlaybackSnapshot';

interface SceneFretboardProps {
  controller: PreviewPlaybackController;
  palette: PaletteToken[];
  profile: HardwareProfile;
  scene: Scene | null;
  selectedLedIds: string[];
  onSelectionChange: (ledIds: string[]) => void;
}

export function SceneFretboard({
  controller,
  onSelectionChange,
  palette,
  profile,
  scene,
  selectedLedIds,
}: SceneFretboardProps) {
  const playback = usePreviewPlaybackSnapshot(controller);
  const frame = scene
    ? evaluateSceneFrame(scene, palette, profile, playback.positionBeats)
    : [];
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
