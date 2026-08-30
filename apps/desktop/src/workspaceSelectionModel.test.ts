import { createDefaultProject } from '@led-studio/editor-core';
import { kmsFourString10LedProfile } from '@led-studio/hardware-profiles';
import { describe, expect, it } from 'vitest';
import { deriveWorkspaceSelection } from './workspaceSelectionModel';

describe('deriveWorkspaceSelection', () => {
  it('resolves the active scene and selected LEDs without UI state', () => {
    const ids = [
      '2eb35d36-d3aa-444a-b5dd-0d29371257d8',
      'd1961fe8-5a0a-4e3a-b7f6-b877b58622c2',
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
});
