# LED Studio

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

On startup, choose to create an untitled project, open and validate a local JSON project, or load a bundled example. Opening is read-only for now; the application does not write back to the selected file.

## Tests and checks

```sh
pnpm test
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

Version 1 deliberately contains only a schema version, required project name, opaque hardware-profile identifier, and named colour palette. Project names and hardware-profile identifiers must be non-empty. A hardware profile will eventually describe LED numbering and physical layout separately; the current project format does not embed bass-specific geometry.

Project files are validated at runtime with Zod. See [`examples/kms-4-string-31-inlay-v1.ledstudio.json`](examples/kms-4-string-31-inlay-v1.ledstudio.json).

## Deliberately out of scope

There is currently no scene editor, timeline, playback engine, animation system, song model, tempo model, MIDI or Ableton integration, Bluetooth, USB communication, OLED or footswitch support, firmware, device-package export, backend, cloud service, account system, database, or external API.
