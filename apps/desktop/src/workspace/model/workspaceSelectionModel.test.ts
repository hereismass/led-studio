import { createDefaultProject } from '@led-studio/editor-core';
import { kmsFourString10LedProfile } from '@led-studio/hardware-profiles';
import { describe, expect, it } from 'vitest';
import { deriveWorkspaceSelection } from './workspaceSelectionModel';

describe('deriveWorkspaceSelection', () => {
  it('resolves the active scene and selected LEDs without UI state', () => {
    const ids = [
      '2eb35d36-d3aa-444a-b5dd-0d29371257d8',
      'd1961fe8-5a0a-4e3a-b7f6-b877b58622c2',
      '55555555-5555-4555-8555-555555555555',
      '77777777-7777-4777-8777-777777777777',
    ];
    const project = createDefaultProject(
      { name: 'Test', profile: kmsFourString10LedProfile },
      () => ids.shift()!,
    );
    const selectedLedId = kmsFourString10LedProfile.leds[2].id;

    const model = deriveWorkspaceSelection(
      project,
      kmsFourString10LedProfile,
      project.scenes[0].id,
      { id: project.scenes[0].id, kind: 'scene' },
      [selectedLedId],
    );

    expect(model.activeScene).toBe(project.scenes[0]);
    expect(model.selectedScene).toBe(project.scenes[0]);
    expect(model.selectedLeds.map(({ id }) => id)).toEqual([selectedLedId]);
    expect(model.selectedLayer).toBeNull();
  });

  it('does not resolve a target belonging to another scene', () => {
    const project = createDefaultProject(
      { name: 'Test', profile: kmsFourString10LedProfile },
      (() => {
        const ids = [
          '20e88cf4-3b82-4c9a-9a8e-a5aa9e229cb3',
          '92b40c49-1c9e-47f7-af64-9f5847e563b1',
          '66666666-6666-4666-8666-666666666666',
          '88888888-8888-4888-8888-888888888888',
        ];
        return () => ids.shift()!;
      })(),
    );

    const model = deriveWorkspaceSelection(
      project,
      kmsFourString10LedProfile,
      project.scenes[0].id,
      {
        id: 'a51546ae-1fc8-4835-a78b-18d8f63fb209',
        kind: 'layer',
        sceneId: '7625856d-ae4e-4cb9-93ac-d8fe5ac39d93',
      },
      [],
    );

    expect(model.selectedLayer).toBeNull();
  });

  it('resolves a selected song independently from its previewed scene', () => {
    const ids = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
    ];
    const project = createDefaultProject(
      { name: 'Test', profile: kmsFourString10LedProfile },
      () => ids.shift()!,
    );

    const model = deriveWorkspaceSelection(
      project,
      kmsFourString10LedProfile,
      project.scenes[0].id,
      { id: project.songs[0].id, kind: 'song' },
      [],
    );

    expect(model.activeScene).toBe(project.scenes[0]);
    expect(model.selectedSong).toBe(project.songs[0]);
    expect(model.selectedScene).toBeNull();
  });
});
