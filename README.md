# LED Studio

The phased editor implementation is tracked in the [editor UI roadmap](docs/editor-roadmap.md).

LED Studio is a Mac-first desktop editor for lighting projects targeting configurable LED hardware. The first hardware profile represents a KMS Thunderbird-style four-string bass with 31 independently addressable RGB inlays, but the project format is intentionally not instrument-specific.

This repository is a pnpm workspace so it can also contain controller firmware and supporting tools in the future.

## Repository layout

- `apps/desktop` — Tauri v2, React, and TypeScript desktop application
- `packages/project-format` — UI-independent project validation and TypeScript types
- `examples` — example LED Studio project files

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`
- pnpm 11
- Rust 1.88 or newer and Cargo (the repository includes a rustup toolchain file)
- On macOS, Xcode Command Line Tools

If another version manager such as mise intercepts `cargo`, configure it for Rust 1.88 or ensure rustup's Cargo directory precedes its shim directory.

## Install and run

```sh
pnpm install
pnpm dev
```

The second command starts the Vite development server and opens it in a Tauri window.

On startup, choose to create an untitled project, open and validate a local project, or load a bundled example as an unsaved template. Save atomically replaces the current file, while Save As chooses a new `.ledstudio` destination. New and example-derived projects use Save As for their first save. The app also accepts `.json` files when opening. Closing the window or quitting prompts before discarding unsaved work.

Inside a project, the name and linked palette colours are editable. New projects start with a white palette token. Palette tokens have hidden, stable UUIDs so future scenes can reference them safely without exposing implementation identifiers in the editor. Project edits support Undo and Redo from the toolbar or with <kbd>⌘Z</kbd> and <kbd>⌘⇧Z</kbd> on macOS.

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

Version 2 contains a schema version, required project name, opaque hardware-profile identifier, an ordered array of linked palette tokens, and empty collections reserved for scenes, sequence items, and groups. Each palette token has an opaque UUID v4 ID, a unique display name, and an uppercase six-digit hexadecimal value. Project names and hardware-profile identifiers must be non-empty. Version 1 files are intentionally unsupported during development and are not migrated.

A hardware profile will eventually describe LED numbering and physical layout separately; the current project format does not embed bass-specific geometry.

Project files are JSON documents validated at runtime with Zod and use the `.ledstudio` extension. See [`examples/kms-4-string-31-inlay-v1.ledstudio`](examples/kms-4-string-31-inlay-v1.ledstudio).

## Deliberately out of scope

There is currently no palette reordering, autosave, recovery backup, native File menu, scene editor, functional timeline, playback engine, animation system, song model, tempo model, MIDI or Ableton integration, Bluetooth, USB communication, OLED or footswitch support, firmware, device-package export, external backend, cloud service, account system, database, or external API.
