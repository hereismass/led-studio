# LED Studio architecture

LED Studio separates persisted project data, transient editor state, native application concerns, and real-time playback. These boundaries are intended to remain stable as the application grows.

## Project data

`packages/project-format` owns the versioned project document, validation, parsing, and serialization. It has no dependency on React, Tauri, a particular instrument, or editor state. `packages/hardware-profiles` owns validated profile geometry, physical addresses, stable LED IDs, and built-in selection groups. Projects reference profiles by opaque ID and are cross-validated against the registry when activated.

The desktop project-session controller owns the active document and immutable revision history. Every committed editor command creates a revision with a stable ID; undo and redo move between those revisions, while dirty state compares the current revision ID with the last-saved one. Saving captures a specific revision, so edits made while a save is running remain dirty. Native project paths stay in Rust and are represented in the webview by opaque handles.

## User interface

React owns application layout, controls, inspectors, and low-frequency state presentation. Presentational components receive state and commands from the project-session controller; they do not perform filesystem or lifecycle work directly. Active scene, selected LEDs, inspector target, and panel dimensions are transient UI state and never enter project files.

Pure editor commands apply validated project mutations without depending on React or Tauri. Text fields keep temporary drafts locally and dispatch one command when an edit is committed, preventing keystrokes from flooding revision history.

Workspace panel sizes and collapsed state are versioned local application preferences. They are deliberately separate from project data so opening a project does not change the user's editor layout.

No additional global state library is needed while a reducer and controller hook provide a clear state transition boundary.

## Future playback and rendering

Playback will be a deterministic engine separate from both the project document and React. It will evaluate scene data at an explicit musical position and produce LED frames without updating React state on every frame. Persisted preview tempo is an editing default; a future external MIDI tempo override will remain transient runtime state.

The 31-element hardware surface remains SVG because it benefits from native accessibility and direct interaction. Dense animation timelines may use Canvas or WebGL when introduced. Work should move to a Web Worker only when profiling shows that evaluation or serialization blocks the UI.

## Native boundary

Tauri owns OS dialogs, project file paths, atomic persistence, and application exit coordination. The webview receives only the minimum commands and capabilities it needs. There is no network service or external backend.
