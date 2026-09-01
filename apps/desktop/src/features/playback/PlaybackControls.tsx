import type { PreviewPlaybackController } from './previewPlayback';
import { usePreviewPlaybackStatus } from './usePreviewPlaybackSnapshot';

interface PlaybackControlsProps {
  controller: PreviewPlaybackController;
  disabled: boolean;
}

export function PlaybackControls({
  controller,
  disabled,
}: PlaybackControlsProps) {
  const status = usePreviewPlaybackStatus(controller);
  const playing = status === 'playing';
  return (
    <div className="playback-controls" aria-label="Scene preview controls">
      <button
        type="button"
        aria-label="Stop"
        disabled={disabled || status === 'stopped'}
        onClick={() => controller.stop()}
      >
        <span aria-hidden="true">■</span>
      </button>
      <button
        type="button"
        aria-label={playing ? 'Pause' : 'Play'}
        aria-keyshortcuts="Space"
        disabled={disabled}
        onClick={() => controller.toggle()}
      >
        <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      </button>
    </div>
  );
}
