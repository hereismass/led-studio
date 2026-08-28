# LED Studio

The phased editor implementation is tracked in the [editor UI roadmap](docs/editor-roadmap.md).

LED Studio is a Mac-first desktop editor for lighting projects targeting configurable LED hardware. The first hardware profile represents a KMS Thunderbird-style four-string bass with 10 independently addressable RGB LEDs, but the project format is intentionally not instrument-specific.

This repository is a pnpm workspace so it can also contain controller firmware and supporting tools in the future.

## Repository layout

- `apps/desktop` — Tauri v2, React, and TypeScript desktop application
- `packages/project-format` — UI-independent project validation and TypeScript types
- `packages/editor-core` — UI-independent project creation, editor commands, and bounded grouped history
- `packages/hardware-profiles` — UI-independent hardware geometry, addressing, groups, and compatibility validation
- `packages/playback` — UI-independent scene timing and LED-frame evaluation
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

Inside a project, the name, preview BPM, time signature, linked palette colours, reusable LED groups, and scenes are editable. New projects start with a four-beat `Scene 1` in which every profile LED is white at full brightness. Palette tokens, groups, scenes, layers, and keyframes have hidden, stable UUIDs. A scene combines sparse static LED assignments with ordered Pulse, Chase, and keyframe layers; every layer can target LEDs directly or remain linked to built-in or project groups. Static LEDs at zero brightness retain their palette link, while the explicit off action removes the assignment. Project edits support Undo and Redo from the toolbar or with <kbd>⌘Z</kbd> and <kbd>⌘⇧Z</kbd> on macOS. History retains the latest 200 undo steps; live controls and timeline drags are grouped into one undoable interaction.

The KMS profile renders an interactive, physically proportioned four-string fretboard with 10 LEDs and built-in E-side and G-side selection groups. The electrical chain starts at fret 21 on the G side, crosses to the E side at fret 12, and ends at fret 3.

The active scene can be previewed with Play/Pause, Stop, and the Scene Timeline scrubber. Preview playback loops at the project BPM, updates immediately while scene LEDs, groups, layers, keyframes, or timing are edited, and remains transient rather than changing the project file. Layer rows can be dragged vertically to change compositing order. Keyframe layers disclose independent brightness and linked palette-colour tracks; keys are authored at the quarter-beat playhead, and colour tracks support smooth RGB or step interpolation. A keyframe layer's start/end window masks stored keys without moving or deleting them. The timeline grows with all visible rows until reaching its scrollable maximum height. Press <kbd>Space</kbd> to toggle playback when focus is not inside an interactive editor control. Static scenes stay off the animation-frame render path; animated scenes use the UI-independent evaluator.

## Tests and checks

```sh
pnpm test
pnpm test:rust
pnpm typecheck
pnpm build:web
pnpm check:rust
pnpm format:check
```

Run all non-bundling checks together with:

```sh
pnpm check
```

To produce a native application bundle:

```sh
pnpm build
```

## Project format

Version 2 contains a schema version, required project name, opaque hardware-profile identifier, project-wide preview timing, linked palette tokens, project-wide LED groups, scenes, and an empty collection reserved for sequence items. Scenes have unique UUIDs and names, a loop length in quarter-beat steps, sparse static LED assignments with brightness from zero to 100, and ordered typed scene layers. Effect layers contain Pulse or Chase parameters. Keyframe layers contain independently optional brightness and linked palette-colour tracks with ordered quarter-beat keys. Earlier v2 scenes without `layers` load with an empty layer list, and documents without timing load with a 120 BPM, 4/4 default. Version 1 files remain intentionally unsupported; schema v2 may continue changing without migrations during active development.

Hardware profiles describe LED numbering and physical layout separately; the project format does not embed instrument-specific geometry.

Project files are JSON documents validated at runtime with Zod and use the `.ledstudio` extension. See [`examples/kms-4-string-10-led-v1.ledstudio`](examples/kms-4-string-10-led-v1.ledstudio).

## Deliberately out of scope

There is currently no palette or scene reordering, autosave, recovery backup, native File menu, keyframe curve editor, easing presets, blend modes, show sequence, song model, MIDI or Ableton integration, Bluetooth, USB communication, OLED or footswitch support, firmware, device-package export, external backend, cloud service, account system, database, or external API.
