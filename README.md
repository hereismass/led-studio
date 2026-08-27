# LED Studio

The phased editor implementation is tracked in the [editor UI roadmap](docs/editor-roadmap.md).

LED Studio is a Mac-first desktop editor for lighting projects targeting configurable LED hardware. The first hardware profile represents a KMS Thunderbird-style four-string bass with 10 independently addressable RGB LEDs, but the project format is intentionally not instrument-specific.

This repository is a pnpm workspace so it can also contain controller firmware and supporting tools in the future.

## Repository layout

- `apps/desktop` — Tauri v2, React, and TypeScript desktop application
- `packages/project-format` — UI-independent project validation and TypeScript types
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

Inside a project, the name, preview BPM, time signature, linked palette colours, and reusable static scenes are editable. New projects start with a four-beat `Scene 1` in which every profile LED is white at full brightness. Palette tokens and scenes have hidden, stable UUIDs. Scene LEDs reference palette tokens, store integer brightness percentages, and remain off when no state is present. Project edits support Undo and Redo from the toolbar or with <kbd>⌘Z</kbd> and <kbd>⌘⇧Z</kbd> on macOS.

The KMS profile renders an interactive, physically proportioned four-string fretboard with 10 LEDs and built-in E-side and G-side selection groups. The electrical chain starts at fret 21 on the G side, crosses to the E side at fret 12, and ends at fret 3.

The active scene can be previewed with Play/Pause, Stop, and the Scene Timeline scrubber. Preview playback loops at the project BPM, updates immediately while scene LEDs or timing are edited, and remains transient rather than changing the project file. Press <kbd>Space</kbd> to toggle playback when focus is not inside an interactive editor control. The current evaluator renders the scene's static LED frame at every position; effect and keyframe animation come in later milestones.

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

Version 2 contains a schema version, required project name, opaque hardware-profile identifier, project-wide preview timing, an ordered array of linked palette tokens, reusable static scenes, and empty collections reserved for sequence items and user groups. Each palette token has an opaque UUID v4 ID, a unique display name, and an uppercase six-digit hexadecimal value. Scenes have unique UUIDs and names, a loop length in quarter-beat steps, and sparse per-LED palette and brightness assignments. Earlier v2 documents without timing load with a 120 BPM, 4/4 default. Version 1 files remain intentionally unsupported.

Hardware profiles describe LED numbering and physical layout separately; the project format does not embed instrument-specific geometry.

Project files are JSON documents validated at runtime with Zod and use the `.ledstudio` extension. See [`examples/kms-4-string-10-led-v1.ledstudio`](examples/kms-4-string-10-led-v1.ledstudio).

## Deliberately out of scope

There is currently no palette or scene reordering, autosave, recovery backup, native File menu, animation/layer system, show sequence, song model, MIDI or Ableton integration, Bluetooth, USB communication, OLED or footswitch support, firmware, device-package export, external backend, cloud service, account system, database, or external API.
