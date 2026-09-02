# LED Studio

The phased editor implementation is tracked in the [editor UI roadmap](docs/editor-roadmap.md).

LED Studio is a Mac-first desktop editor for lighting projects targeting configurable LED hardware. The first hardware profile represents a KMS Thunderbird-style four-string bass with 10 independently addressable RGB LEDs, but the project format is intentionally not instrument-specific.

This repository is a pnpm workspace so it can also contain controller firmware and supporting tools in the future.

## Repository layout

- `apps/desktop` — Tauri v2, React, and TypeScript desktop application
- `firmware/controller` — Zephyr controller application and portable C runtime
- `packages/project-format` — UI-independent project validation and TypeScript types
- `packages/editor-core` — UI-independent project creation, editor commands, and bounded grouped history
- `packages/hardware-profiles` — UI-independent hardware geometry, addressing, groups, and compatibility validation
- `packages/playback` — UI-independent scene evaluation and deterministic song/cue transport
- `examples` — example LED Studio project files

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`
- pnpm 11
- Rust 1.88 or newer and Cargo (the repository includes a rustup toolchain file)
- On macOS, Xcode Command Line Tools

The root pnpm scripts place rustup's standard Cargo directory first on macOS, avoiding conflicts when another version manager such as mise also provides a `cargo` shim.

## Install and run

```sh
pnpm install
pnpm dev
```

The second command starts the Vite development server and opens it in a Tauri window.

On startup, choose to create an untitled project, open and validate a local project, or load a bundled example as an unsaved template. Save atomically replaces the current file, while Save As chooses a new `.ledstudio` destination. New and example-derived projects use Save As for their first save. The app also accepts `.json` files when opening. Closing the window or quitting prompts before discarding unsaved work.

Inside a project, the name, preview BPM, time signature, linked palette colours, reusable LED groups, scenes, and songs are editable. New projects start with a four-beat `Scene 1` in which every profile LED is white at full brightness, plus `Song 1` with a manual cue for that shared scene. Palette tokens, groups, scenes, songs, cues, layers, and keyframes have hidden, stable UUIDs. A scene combines sparse static LED assignments with ordered Pulse, Chase, Wave, Sparkle, and keyframe layers; every layer can target LEDs directly or remain linked to built-in or project groups. Static LEDs at zero brightness retain their palette link, while the explicit off action removes the assignment. Project edits support Undo and Redo from the toolbar or with <kbd>⌘Z</kbd> and <kbd>⌘⇧Z</kbd> on macOS. History retains the latest 200 undo steps; live controls and timeline drags are grouped into one undoable interaction.

The KMS profile renders an interactive, physically proportioned four-string fretboard with 10 LEDs and built-in E-side and G-side selection groups. The editor numbers them from fret 3 toward fret 21. Independently, the electrical chain starts at fret 21 on the G side, crosses to the E side at fret 12, and ends at fret 3.

The active scene can be previewed with Play/Pause, Stop, and the Scene Timeline scrubber. Preview playback loops at the project BPM, updates immediately while scene LEDs, groups, layers, keyframes, or timing are edited, and remains transient rather than changing the project file. Layer rows can be dragged vertically to change compositing order. Chase and Wave travel through profile-defined visual positions from fret 3 toward fret 21; the two LEDs at fret 12 share one position and therefore move together when both are targeted. Their loop-length controls describe a complete repeating cycle, while deterministic Sparkle patterns remain independent per physical LED and can hold or fade between steps. The Add Layer menu also offers Slow Breath, Comet, Rolling Wave, and Soft Twinkle quick starts; these create ordinary editable layers rather than persisted preset references. Keyframe layers disclose independent brightness and linked palette-colour tracks; keys are authored at the snapped playhead, and each outgoing segment supports Linear, Ease In, Ease Out, or Ease In/Out shaping. Colour tracks support smooth RGB or step interpolation, with Step deliberately ignoring stored easing. A keyframe layer's start/end window masks stored keys without moving or deleting them. The timeline supports quarter-, half-, whole-beat, and bar snapping plus persistent manual zoom or Fit Scene. Offscreen labels and keyframe controls are omitted from the DOM while scrolling large loops.

Songs are ordered project assets that arrange shared scenes as cues without copying scene content. Each song owns its preview tempo, time signature, and launch quantization (`Immediate`, `Next beat`, or `Next bar`). A cue either waits for manual advancement or advances after a configured number of complete scene loops; the final cue keeps looping. Selecting a cue previews its referenced scene, while deleting a scene that is still used by any cue is rejected. Song order is the future controller browse order; setlists and external mappings remain separate deferred concepts.

Keyframes in one layer can be selected across both tracks with <kbd>⌘</kbd>/<kbd>Ctrl</kbd>-click, extended in one track with <kbd>Shift</kbd>-click, or selected together with <kbd>⌘A</kbd>/<kbd>Ctrl+A</kbd> after focusing the layer. Dragging or using the arrow keys moves the selection as one undoable edit. Layers and keyframe selections support contextual Copy, Cut, Paste, Duplicate, and Delete actions. The in-app clipboard lasts for the current app session, including project switches, but is neither persisted nor shared with the system clipboard. Cross-project paste preserves exact palette IDs, falls back to an exact colour value, and validates hardware targets before making an atomic change.

Press <kbd>Space</kbd> to toggle playback when focus is not inside an interactive editor control. Timeline shortcuts include <kbd>⌘C</kbd>/<kbd>⌘X</kbd>/<kbd>⌘V</kbd>, <kbd>⌘D</kbd>, Delete, <kbd>⌘+</kbd>/<kbd>⌘−</kbd>, and <kbd>⌘0</kbd> for Fit Scene; use Ctrl instead of Command on non-macOS platforms. Static scenes stay off the animation-frame render path; animated scenes use the UI-independent evaluator.

## Tests and checks

```sh
pnpm test
pnpm test:rust
pnpm typecheck
pnpm build:web
pnpm check:rust
pnpm format:check
pnpm lint
```

Run all non-bundling checks together with:

```sh
pnpm check
```

The portable controller runtime can also be tested independently with:

```sh
pnpm test:firmware
```

For repeatable microbenchmarks of the large editor-command and playback paths:

```sh
pnpm benchmark
```

To produce a native application bundle:

```sh
pnpm build
```

## Project format

Version 2 contains a schema version, required project name, opaque hardware-profile identifier, project-wide standalone preview timing, linked palette tokens, project-wide LED groups, shared scenes, and ordered songs. Each song has timing, launch quantization, and ordered cues that reference scenes. Scenes have unique UUIDs and names, a loop length in quarter-beat steps, sparse static LED assignments with brightness from zero to 100, and ordered typed scene layers. Effect layers contain Pulse, Chase, Wave, or deterministic Sparkle parameters. Keyframe layers contain independently optional brightness and linked palette-colour tracks with ordered quarter-beat keys. Every key stores the easing for its outgoing segment; omitted easing defaults to Linear. Version 1 files remain intentionally unsupported; schema v2 may continue changing without migrations during active development.

Hardware profiles describe canonical editor order, grouped effect positions, electrical addresses, and physical layout separately; the project format does not embed instrument-specific geometry.

Project files are JSON documents validated at runtime with Zod and use the `.ledstudio` extension. See [`examples/kms-4-string-10-led-v1.ledstudio`](examples/kms-4-string-10-led-v1.ledstudio).

To keep editing and playback responsive when opening untrusted local files, v2 currently caps projects at 32 MiB, 4,096 loop beats, 256 palette tokens, groups, scenes, and songs, 512 layers per scene and cues per song, 4,096 keys per track and loops per automatic cue, and 50,000 total project entities. These are generous development safeguards rather than a frozen compatibility policy.

## Deliberately out of scope

There is currently no palette or scene reordering, setlist model, autosave, recovery backup, native File menu, system clipboard integration, custom effect presets, freeform keyframe curve editor, blend modes, MIDI or Ableton integration, external clock, Bluetooth, USB communication, OLED or footswitch support, device-package export, external backend, cloud service, account system, database, or external API. Controller firmware is at its initial hard-coded bring-up stage and cannot yet load editor projects.
