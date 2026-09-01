import type { Effect } from '@led-studio/project-format';

export const EFFECT_LAYER_PRESETS = [
  { effectType: 'pulse', id: 'preset-slow-breath', label: 'Slow Breath' },
  { effectType: 'chase', id: 'preset-comet', label: 'Comet' },
  { effectType: 'wave', id: 'preset-rolling-wave', label: 'Rolling Wave' },
  {
    effectType: 'sparkle',
    id: 'preset-soft-twinkle',
    label: 'Soft Twinkle',
  },
] as const;

export type EffectLayerPresetId = (typeof EFFECT_LAYER_PRESETS)[number]['id'];
export type SceneLayerTemplateId =
  Effect['type'] | EffectLayerPresetId | 'keyframe';

function sparkleSeedFromEntityId(id: string): number {
  return Number.parseInt(id.slice(-8), 16) >>> 0;
}

export function effectLayerTemplate(
  template: Exclude<SceneLayerTemplateId, 'keyframe'>,
  paletteTokenId: string,
  layerId: string,
  sceneLoopLengthBeats: number,
): { effect: Effect; name: string } {
  switch (template) {
    case 'pulse':
      return {
        effect: {
          cycleLengthBeats: 1,
          maxBrightnessPercent: 100,
          minBrightnessPercent: 0,
          paletteTokenId,
          phaseOffsetBeats: 0,
          type: 'pulse',
          waveform: 'sine',
        },
        name: 'Pulse',
      };
    case 'chase':
      return {
        effect: {
          brightnessPercent: 100,
          cycleLengthBeats: sceneLoopLengthBeats,
          direction: 'forward',
          paletteTokenId,
          trailLengthPositions: 0,
          type: 'chase',
          widthPositions: 1,
        },
        name: 'Chase',
      };
    case 'wave':
      return {
        effect: {
          cycleLengthBeats: sceneLoopLengthBeats,
          direction: 'forward',
          maxBrightnessPercent: 100,
          minBrightnessPercent: 0,
          paletteTokenId,
          phaseOffsetBeats: 0,
          type: 'wave',
          waveform: 'sine',
          wavelengthPositions: 4,
        },
        name: 'Wave',
      };
    case 'sparkle':
      return {
        effect: {
          brightnessPercent: 100,
          decay: 'fade',
          densityPercent: 30,
          paletteTokenId,
          seed: sparkleSeedFromEntityId(layerId),
          stepLengthBeats: 0.25,
          type: 'sparkle',
        },
        name: 'Sparkle',
      };
    case 'preset-slow-breath':
      return {
        effect: {
          cycleLengthBeats: 4,
          maxBrightnessPercent: 100,
          minBrightnessPercent: 15,
          paletteTokenId,
          phaseOffsetBeats: 0,
          type: 'pulse',
          waveform: 'sine',
        },
        name: 'Slow Breath',
      };
    case 'preset-comet':
      return {
        effect: {
          brightnessPercent: 100,
          cycleLengthBeats: sceneLoopLengthBeats,
          direction: 'forward',
          paletteTokenId,
          trailLengthPositions: 2,
          type: 'chase',
          widthPositions: 1,
        },
        name: 'Comet',
      };
    case 'preset-rolling-wave':
      return {
        effect: {
          cycleLengthBeats: sceneLoopLengthBeats,
          direction: 'forward',
          maxBrightnessPercent: 100,
          minBrightnessPercent: 10,
          paletteTokenId,
          phaseOffsetBeats: 0,
          type: 'wave',
          waveform: 'sine',
          wavelengthPositions: 4,
        },
        name: 'Rolling Wave',
      };
    case 'preset-soft-twinkle':
      return {
        effect: {
          brightnessPercent: 65,
          decay: 'fade',
          densityPercent: 20,
          paletteTokenId,
          seed: sparkleSeedFromEntityId(layerId),
          stepLengthBeats: 0.5,
          type: 'sparkle',
        },
        name: 'Soft Twinkle',
      };
  }
}
