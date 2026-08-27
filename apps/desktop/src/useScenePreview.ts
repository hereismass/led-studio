import { useEffect, useRef } from 'react';
import type { Scene } from '@led-studio/project-format';
import { PreviewPlaybackController } from './previewPlayback';

export function useScenePreview(
  scene: Scene | null,
  beatsPerMinute: number,
): PreviewPlaybackController {
  const controllerRef = useRef<PreviewPlaybackController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new PreviewPlaybackController();
  }
  const controller = controllerRef.current;

  useEffect(() => () => controller.stop(), [controller]);
  useEffect(() => {
    controller.configure({
      beatsPerMinute,
      loopLengthBeats: scene?.loopLengthBeats ?? 4,
      sceneId: scene?.id ?? null,
    });
  }, [beatsPerMinute, controller, scene?.id, scene?.loopLengthBeats]);
  useEffect(() => {
    function handlePlaybackShortcut(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.repeat || event.defaultPrevented)
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          'input, select, textarea, button, a, [contenteditable="true"]',
        )
      )
        return;
      event.preventDefault();
      controller.toggle();
    }
    window.addEventListener('keydown', handlePlaybackShortcut);
    return () => window.removeEventListener('keydown', handlePlaybackShortcut);
  }, [controller]);

  return controller;
}
