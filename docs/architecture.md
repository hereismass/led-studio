# LED Studio architecture

LED Studio separates persisted project data, transient editor state, native application concerns, and real-time playback. These boundaries are intended to remain stable as the application grows.

## Project data

`packages/project-format` owns the versioned project document, validation, parsing, and serialization. It has no dependency on React, Tauri, a particular instrument, or editor state. Hardware profiles remain separate definitions referenced by opaque IDs; profile geometry does not belong in the generic project schema.

The desktop project-session controller owns the active document and revision history. Dirty state is derived by comparing the current and last-saved revisions. Native project paths stay in Rust and are represented in the webview by opaque handles.

## User interface

React owns application layout, controls, inspectors, and low-frequency state presentation. Presentational components receive state and commands from the project-session controller; they do not perform filesystem or lifecycle work directly.

Workspace panel sizes and collapsed state are versioned local application preferences. They are deliberately separate from project data so opening a project does not change the user's editor layout.

No additional global state library is needed while a reducer and controller hook provide a clear state transition boundary.

## Future playback and rendering

Playback will be a deterministic engine separate from both the project document and React. It will evaluate project data against an explicit clock and produce LED frames without updating React state on every frame.

Timeline and LED animation rendering should use Canvas or WebGL when those features are introduced. Work should move to a Web Worker only when profiling shows that evaluation or serialization blocks the UI; it is not required by the current project format.

## Native boundary

Tauri owns OS dialogs, project file paths, atomic persistence, and application exit coordination. The webview receives only the minimum commands and capabilities it needs. There is no network service or external backend.
