import { useSyncExternalStore } from 'react';
import type { PreviewPlaybackController } from './previewPlayback';

const noSubscription = () => () => undefined;
const zeroPosition = () => 0;

export function usePreviewPlaybackSnapshot(
  controller: PreviewPlaybackController,
) {
  return useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
}

export function usePreviewPlaybackPosition(
  controller: PreviewPlaybackController,
  enabled = true,
) {
  return useSyncExternalStore(
    enabled ? controller.subscribe : noSubscription,
    enabled ? controller.getPositionSnapshot : zeroPosition,
    enabled ? controller.getPositionSnapshot : zeroPosition,
  );
}

export function usePreviewPlaybackStatus(
  controller: PreviewPlaybackController,
) {
  return useSyncExternalStore(
    controller.subscribe,
    controller.getStatusSnapshot,
    controller.getStatusSnapshot,
  );
}
