import { useSyncExternalStore } from 'react';
import type { PreviewPlaybackController } from './previewPlayback';

export function usePreviewPlaybackSnapshot(
  controller: PreviewPlaybackController,
) {
  return useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
}
