import {
  applyEditorCommand,
  createDefaultProject,
  createKeyframeAddedCommand,
  createSceneLayerAddedCommand,
  type ProjectEntityIdFactory,
} from '@led-studio/editor-core';
import { kmsFourString10LedProfile } from '@led-studio/hardware-profiles';
import type { KeyframeLayer, Project } from '@led-studio/project-format';
import { describe, expect, it } from 'vitest';
import {
  copyKeyframes,
  copyLayer,
  EditorClipboardError,
  pastedKeyframes,
  pastedLayer,
} from './editorClipboard';

function idFactory(): ProjectEntityIdFactory {
  let index = 1;
  return () =>
    `00000000-0000-4000-8000-${(index++).toString(16).padStart(12, '0')}`;
}

function projectWithKeyframes(): {
  layer: KeyframeLayer;
  project: Project;
} {
  const ids = idFactory();
  let project = createDefaultProject(
    { name: 'Clipboard source', profile: kmsFourString10LedProfile },
    ids,
  );
  const sceneId = project.scenes[0].id;
  const layerCommand = createSceneLayerAddedCommand(
    project,
    sceneId,
    'keyframe',
    { groupId: 'all-leds', kind: 'profile-group' },
    ids,
  );
  project = applyEditorCommand(project, layerCommand);
  project = applyEditorCommand(
    project,
    createKeyframeAddedCommand(
      project,
      sceneId,
      layerCommand.id,
      1,
      {
        brightnessPercent: 25,
        easing: 'ease-in',
        track: 'brightness',
      },
      ids,
    ),
  );
  project = applyEditorCommand(
    project,
    createKeyframeAddedCommand(
      project,
      sceneId,
      layerCommand.id,
      2.5,
      {
        easing: 'ease-out',
        paletteTokenId: project.palette[0].id,
        track: 'colour',
      },
      ids,
    ),
  );
  const layer = project.scenes[0].layers[0];
  if (layer.kind !== 'keyframe') throw new Error('Expected keyframe layer');
  return { layer, project };
}

describe('editor clipboard', () => {
  it('keeps relative keyframe timing and maps colours by exact hex', () => {
    const { layer, project } = projectWithKeyframes();
    const clipboard = copyKeyframes(project, layer, [
      { id: layer.tracks.brightness.keyframes[0].id, track: 'brightness' },
      { id: layer.tracks.colour.keyframes[0].id, track: 'colour' },
    ]);
    const destinationTokenId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const destination = {
      ...project,
      palette: [
        {
          ...project.palette[0],
          id: destinationTokenId,
        },
      ],
    };

    expect(pastedKeyframes(destination, clipboard, 0)).toMatchObject([
      {
        beat: 0,
        brightnessPercent: 25,
        easing: 'ease-in',
        track: 'brightness',
      },
      {
        beat: 1.5,
        easing: 'ease-out',
        paletteTokenId: destinationTokenId,
        track: 'colour',
      },
    ]);
  });

  it('preserves a matching target and falls back to direct LEDs for a missing group', () => {
    const { layer, project } = projectWithKeyframes();
    const clipboard = copyLayer(project, kmsFourString10LedProfile, layer);
    expect(
      pastedLayer(
        project,
        kmsFourString10LedProfile,
        project.scenes[0],
        clipboard,
        0,
      ).target,
    ).toEqual(layer.target);

    const projectGroupLayer: KeyframeLayer = {
      ...layer,
      target: { groupId: 'source-group', kind: 'project-group' },
    };
    const source = {
      ...project,
      groups: [
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          ledIds: ['fret-03-e-side'],
          name: 'Source Group',
        },
      ],
    };
    projectGroupLayer.target = {
      groupId: source.groups[0].id,
      kind: 'project-group',
    };
    const groupClipboard = copyLayer(
      source,
      kmsFourString10LedProfile,
      projectGroupLayer,
    );
    const pasted = pastedLayer(
      { ...project, groups: [] },
      kmsFourString10LedProfile,
      project.scenes[0],
      groupClipboard,
      0,
    );
    expect(pasted.target).toEqual({
      kind: 'leds',
      ledIds: ['fret-03-e-side'],
    });
  });

  it('rejects missing palette colours, LEDs, and overflowing layers', () => {
    const { layer, project } = projectWithKeyframes();
    const keyframes = copyKeyframes(project, layer, [
      { id: layer.tracks.colour.keyframes[0].id, track: 'colour' },
    ]);
    expect(() =>
      pastedKeyframes({ ...project, palette: [] }, keyframes, 0),
    ).toThrow(EditorClipboardError);

    const clipboard = copyLayer(project, kmsFourString10LedProfile, layer);
    expect(() =>
      pastedLayer(
        project,
        kmsFourString10LedProfile,
        project.scenes[0],
        { ...clipboard, resolvedLedIds: ['missing-led'] },
        0,
      ),
    ).toThrow(/unavailable in the destination hardware profile/);
    expect(() =>
      pastedLayer(
        project,
        kmsFourString10LedProfile,
        project.scenes[0],
        clipboard,
        1,
      ),
    ).toThrow(/fit within the scene loop/);
  });
});
