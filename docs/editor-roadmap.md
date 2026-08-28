# Editor UI roadmap

## Summary

Build the editor through runnable, reviewable milestones. Stop after each milestone for UI feedback before its assumptions spread into later features. The active roadmap focuses on scene creation, preview, and animation; show-sequence and external-control work is deferred.

## Milestones

### 1. Interactive workspace shell

- Replace the current project preview with the proposed workspace:
  - compact project toolbar;
  - left asset panel;
  - central hardware editor area;
  - contextual right inspector;
  - a bottom Scene Timeline panel.
- Keep unavailable features clearly disabled or marked as empty states.
- Make the side and bottom panels resizable and collapsible, with sensible minimum sizes and a Reset Layout action.
- Remember layout preferences locally, independently from project JSON.
- Preserve the existing welcome screen, open/save/save-as flow, dirty state, and close protection.
- Review gate: window proportions, terminology, information density, resizing, and navigation.

### 2. Project and palette editing

Implementation complete; the UI review gate is open for feedback.

- Make the project name editable and surface saved/modified state compactly.
- Establish centralized editor commands and undo/redo before adding more mutations.
- Replace the palette record with ordered linked tokens:
  - hidden, stable UUID v4 ID;
  - editable display name;
  - six-digit uppercase hexadecimal value.
- Generate opaque IDs when tokens are created or duplicated; subsequent renames do not change IDs.
- Add palette create, edit, duplicate, and delete operations through the left panel and inspector. Palette reordering is deliberately deferred until ordering has an editor-visible purpose.
- Introduce project format v2 with empty collections reserved for scenes, sequence items, and groups. Reject v1 files without migration and update all examples.
- Review gate: token editing, inspector behavior, compactness, and undo/redo expectations.

### 3. Hardware profile and static scene editor

Implementation complete; the scene workflow and fretboard review gate are open for feedback.

- Add an independent hardware-profile registry. Projects continue to store only the profile ID.
- Define profile geometry using stable LED IDs, physical addresses, normalized coordinates, labels, and built-in groups.
- Add the 10-LED KMS profile and validate its body-to-neck chain addresses, E-side positions, and G-side positions.
- Render the central hardware surface with SVG initially; 10 elements do not justify Canvas or WebGL yet.
- Add reusable static scenes with:
  - stable ID and editable name;
  - a musical loop length in quarter-beat steps;
  - per-LED palette-token reference and brightness;
  - absent LED state meaning off.
- Support click, Shift-click, marquee, and profile-group selection. Applying a palette token affects the current selection.
- Add project-wide preview BPM and time signature, with a static musical loop ruler. External tempo overrides remain transient future runtime state.
- Keep the single available profile read-only. When profile switching is introduced, projects containing scenes remain bound until those scenes are removed or migrated explicitly.
- Review gate: fretboard representation, selection gestures, scene workflow, and inspector organization.

### 4. Scene playback and preview

Implementation complete; the transport and preview review gate is open for feedback.

- Create a pure, UI-independent evaluator that resolves scene LED output at an explicit musical position within its loop.
- Add preview play, pause, stop, scrub, loop, and current-position controls for a scene.
- Drive visual refresh with `requestAnimationFrame` and an isolated preview controller while keeping evaluation in a UI-independent package.
- Display evaluator output on the same hardware surface used for editing.
- Make scene edits visible during playback and stop/reset when the active scene changes.
- Create new projects with a ready-to-edit four-beat scene containing every profile LED in white at full brightness.
- Keep projects with no scenes valid and disable transport until a scene is created or selected.
- Review gate: transport behavior, timeline feedback, keyboard control, and preview clarity.

### 4.1. Editor architecture hardening

Implementation complete.

- Extract project creation, editor commands, and history into a reusable `editor-core` package.
- Keep history bounded to 200 revisions and group continuous slider or colour-picker updates into one undo step.
- Make entity-creation commands carry their generated IDs so selection does not depend on comparing collections after render.
- Compile scene evaluation once and isolate animation-frame subscriptions to moving playback UI.
- Split workspace layout, selection, preview lifecycle, toolbar, assets, timeline, and resizers into focused components and hooks.
- Preserve the active session behind a workspace error boundary with Retry, Save As, and Return actions.

### 5. Effect layers

Implementation complete; the layer, targeting, and timeline review gate is open for feedback.

- Extend scenes with ordered, targetable effect layers while retaining their static base state.
- Start with Pulse and Chase effects to validate temporal and spatial behavior without creating a large effect library.
- Give layers stable IDs, names, enabled/locked state, LED targets, musical start/end positions, and typed parameters.
- Add layer rows and duration bars to the Scene Timeline, with editing in the contextual inspector.
- Add user-defined LED groups now that reusable animation targeting needs them.
- Keep evaluation deterministic and define compositing centrally rather than in individual UI components.
- Pulse supports waveform and phase shaping. Chase supports direction, head width, and a fading trail.
- Custom groups are project-wide linked assets; changing their members updates every layer that targets them.
- Layer bars support quarter-beat drag, resize, keyboard adjustment, exact inspector values, ordering, locking, and grouped undo.
- Review gate: layer model, targeting, ordering, and whether the timeline remains understandable.

### 5.1. Timeline and inspector polish

Implementation complete.

- Remove redundant timeline scrolling and grow the panel with effect rows until its maximum height.
- Retain linked palette colours at zero static brightness while keeping explicit off as removal.
- Share active and mixed palette swatches between LED and effect inspectors.
- Replace effect selects with purpose-built target, waveform, direction, and colour controls.
- Clarify layer locking and normalize inspector spacing and secondary actions.
- Add pointer and keyboard effect-row reordering while preserving horizontal timing edits.

### 6. Keyframes and hybrid animation

- Add keyframe layers to the same scene-layer model.
- Initially support brightness and linked palette-colour tracks.
- Support create, move, duplicate, and delete keyframes, with linear interpolation initially.
- Show keyframe diamonds in collapsed rows and property tracks when expanded.
- Allow effect and keyframe layers to coexist and be reordered under the same evaluator.
- Review gate: editing precision, inspector/timeline balance, and whether more interpolation or curve tools are justified.

### 7. Workflow and performance polish

- Add keyboard shortcuts, copy/paste, context menus, stronger empty states, validation messaging, and deletion safeguards.
- Complete accessibility behavior for focus, keyboard selection, labels, and reduced motion.
- Profile playback and timeline rendering with realistic projects.
- Retain SVG and React rendering unless measurements demonstrate a need for Canvas, WebGL, virtualization, or a worker.
- Document the stable project format and editor architecture once the interaction model has passed review.

## Deferred work

- Revisit the reserved `sequence` collection only after the scene and animation workflow is established.
- Decide whether sequence order represents a MIDI-selectable scene bank, an automatic show, a song model, or separate concepts before adding UI or persisted data.
- Define MIDI mapping, external clock behavior, scene-switch transitions, ordering, and deletion safeguards together rather than baking those assumptions into the scene editor now.

## Interfaces and architecture

- Project-format schemas, profile definitions, editor commands, and playback evaluation remain independent from React and Tauri.
- React owns workspace presentation and user interaction; Tauri continues to own native dialogs and file persistence.
- Local workspace preferences use a versioned app-preference key and never enter project files.
- Format v2 remains the active development format and may change without migration until a compatibility policy is explicitly introduced.
- Scene time uses beat-relative positions. Sequence editing, MIDI input, hardware communication, firmware, and export remain out of scope until their dedicated milestones.

## Test plan

- Unit-test every schema, referential-integrity rule, editor command, undo/redo operation, profile definition, and playback position boundary.
- Add component tests for panel behavior, keyboard selection, palette editing, scene operations, playback controls, scrubbing, live preview edits, and zero-scene fallbacks.
- Round-trip representative v2 projects through save and load after every format-related milestone.
- Verify malformed files, duplicate IDs, missing references, invalid LED addresses, and invalid playback inputs are rejected clearly.
- Run the existing TypeScript, React, Rust, and native macOS checks at every review gate.
- Manually smoke-test welcome, create, example loading, open, save, save-as, close protection, and restored panel layout.

## Assumptions

- Only one milestone is implemented and reviewed at a time.
- The palette workflow is the first functional editor feature after the shell.
- Effects are delivered before keyframes.
- Existing v1 project files are intentionally unsupported after the v2 reset.
- The detailed appearance of later timeline and animation controls can be revised at their review gates without changing the earlier architectural boundaries.
