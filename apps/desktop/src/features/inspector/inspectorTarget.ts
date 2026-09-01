import type { KeyframeReference } from '@led-studio/editor-core';

export type InspectorTarget =
  | { kind: 'leds' }
  | { id: string; kind: 'palette' }
  | { kind: 'project' }
  | { id: string; kind: 'scene' }
  | { id: string; kind: 'song' }
  | { id: string; kind: 'group' }
  | { id: string; kind: 'layer'; sceneId: string }
  | {
      id: string;
      kind: 'keyframe';
      layerId: string;
      sceneId: string;
      track: 'brightness' | 'colour';
    }
  | {
      keyframes: KeyframeReference[];
      kind: 'keyframes';
      layerId: string;
      primary: KeyframeReference;
      sceneId: string;
    };
