# Editor UI roadmap

## Summary

Build the editor through runnable, reviewable milestones. Stop after each milestone for UI feedback before its assumptions spread into later features.

The first milestone changes only the workspace layout. The project format changes once afterward to a forward-compatible development format; existing v1 files will not be migrated.

## Milestones

### 1. Interactive workspace shell

- Replace the current project preview with the proposed workspace:
  - compact project toolbar;
  - left asset panel;
  - central hardware editor area;
  - contextual right inspector;
  - switchable bottom panel for Show Sequence and Scene Timeline.
- Keep unavailable features clearly disabled or marked as empty states.
- Make the side and bottom panels resizable and collapsible, with sensible minimum sizes and a Reset Layout action.
- Remember layout preferences locally, independently from project JSON.
- Preserve the existing welcome screen, open/save/save-as flow, dirty state, and close protection.
- Review gate: window proportions, terminology, information density, resizing, and navigation.

### 2. Project and palette editing

- Make the project name editable and surface saved/modified state compactly.
- Establish centralized editor commands and undo/redo before adding more mutations.
- Replace the palette record with ordered linked tokens:
  - stable lowercase kebab-case ID;
  - editable display name;
  - six-digit uppercase hexadecimal value.
- Generate readable IDs from new token names, adding numeric suffixes for collisions; subsequent renames do not change IDs.
- Add palette create, edit, duplicate, reorder, and delete operations through the left panel and inspector.
- Introduce project format v2 with empty collections reserved for scenes, sequence items, and groups. Reject v1 files without migration and update all examples.
- Review gate: token editing, inspector behavior, compactness, and undo/redo expectations.

### 3. Hardware profile and static scene editor

- Add an independent hardware-profile registry. Projects continue to store only the profile ID.
- Define profile geometry using stable LED IDs, physical addresses, normalized coordinates, labels, and built-in groups.
- Add the 31-inlay KMS profile and validate that its addresses are unique and complete.
- Render the central hardware surface with SVG initially; 31 elements do not justify Canvas or WebGL yet.
- Add reusable static scenes with:
  - stable ID and editable name;
  - intrinsic duration in milliseconds;
  - per-LED palette-token reference and brightness;
  - absent LED state meaning off.
- Support click, Shift-click, marquee, and profile-group selection. Applying a palette token affects the current selection.
- Lock hardware-profile changes while any scenes exist; deleting all scenes unlocks it.
- Review gate: fretboard representation, selection gestures, scene workflow, and inspector organization.

### 4. Show sequence

- Add an ordered sequence whose items reference reusable scene definitions rather than copying them.
- Provide add, duplicate, remove, and drag-to-reorder operations in the Show Sequence bottom panel.
- Use each scene's intrinsic duration; the initial transition is a cut.
- Double-clicking a sequence item opens that scene in the Scene Timeline mode.
- Keep renames safe through stable IDs. When deleting a referenced scene, offer either cancellation or removal of all its sequence occurrences.
- Show total duration, current selection, and validation errors for missing references.
- Review gate: relationship between the scene library, sequence, bottom-panel modes, and navigation.

### 5. Playback and transitions

- Create a pure, UI-independent evaluator that resolves project LED output at an integer millisecond timestamp.
- Add play, pause, stop, scrub, loop, and current-time controls for both a scene and the complete sequence.
- Drive visual refresh with `requestAnimationFrame` while keeping time evaluation outside React components.
- Add cut and crossfade transitions. Crossfades overlap the end of the outgoing scene and beginning of the incoming scene; show duration subtracts these overlaps.
- Display evaluator output on the same hardware surface used for editing.
- Review gate: transport behavior, timeline feedback, transition semantics, and preview clarity.

### 6. Effect layers

- Extend scenes with ordered, targetable effect layers while retaining their static base state.
- Start with Pulse and Chase effects to validate temporal and spatial behavior without creating a large effect library.
- Give layers stable IDs, names, enabled/locked state, LED targets, start/end times, and typed parameters.
- Add layer rows and duration bars to the Scene Timeline, with editing in the contextual inspector.
- Add user-defined LED groups now that reusable animation targeting needs them.
- Keep evaluation deterministic and define compositing centrally rather than in individual UI components.
- Review gate: layer model, targeting, ordering, and whether the timeline remains understandable.

### 7. Keyframes and hybrid animation

- Add keyframe layers to the same scene-layer model.
- Initially support brightness and linked palette-colour tracks.
- Support create, move, duplicate, and delete keyframes, with linear interpolation initially.
- Show keyframe diamonds in collapsed rows and property tracks when expanded.
- Allow effect and keyframe layers to coexist and be reordered under the same evaluator.
- Review gate: editing precision, inspector/timeline balance, and whether more interpolation or curve tools are justified.

### 8. Workflow and performance polish

- Add keyboard shortcuts, copy/paste, context menus, stronger empty states, validation messaging, and deletion safeguards.
- Complete accessibility behavior for focus, keyboard selection, labels, and reduced motion.
- Profile playback and timeline rendering with realistic projects.
- Retain SVG and React rendering unless measurements demonstrate a need for Canvas, WebGL, virtualization, or a worker.
- Document the stable project format and editor architecture once the interaction model has passed review.

## Interfaces and architecture

- Project-format schemas, profile definitions, editor commands, and playback evaluation remain independent from React and Tauri.
- React owns workspace presentation and user interaction; Tauri continues to own native dialogs and file persistence.
- Local workspace preferences use a versioned app-preference key and never enter project files.
- Format v2 introduces stable IDs and forward-shaped collections. Later milestones add compatible layer and transition variants rather than repeatedly replacing the base format.
- All time values use integer milliseconds. Tempo, beats, MIDI, hardware communication, firmware, and export remain out of scope.

## Test plan

- Unit-test every schema, referential-integrity rule, editor command, undo/redo operation, profile definition, and playback timestamp boundary.
- Add component tests for panel behavior, keyboard selection, palette editing, scene operations, sequence reordering, and timeline mode switching.
- Round-trip representative v2 projects through save and load after every format-related milestone.
- Verify malformed files, duplicate IDs, missing references, invalid LED addresses, and invalid transition durations are rejected clearly.
- Run the existing TypeScript, React, Rust, and native macOS checks at every review gate.
- Manually smoke-test welcome, create, example loading, open, save, save-as, close protection, and restored panel layout.

## Assumptions

- Only one milestone is implemented and reviewed at a time.
- The palette workflow is the first functional editor feature after the shell.
- Effects are delivered before keyframes.
- Existing v1 project files are intentionally unsupported after the v2 reset.
- The detailed appearance of later timeline and animation controls can be revised at their review gates without changing the earlier architectural boundaries.
