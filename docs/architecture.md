# LED Studio architecture

LED Studio separates persisted project data, transient editor state, native application concerns, and real-time playback. These boundaries are intended to remain stable as the application grows.

## Project data

`packages/project-format` owns the project document, validation, parsing, and serialization. It has no dependency on React, Tauri, a particular instrument, or editor state. `packages/hardware-profiles` owns validated profile geometry, canonical editor order, grouped effect positions, physical addresses, stable LED IDs, and built-in selection groups. Projects reference profiles by opaque ID and are cross-validated against the registry when activated. During active development, schema v2 may change without migrations; a compatibility policy is deliberately deferred.

`packages/editor-core` owns default project creation, editor command application, project queries, and immutable revision history. Commands carry the IDs of entities they create, making outcomes explicit and testable. Shared command validation lives in `commandSupport`, song and cue mutations live in `songCommands`, and the package entry point composes those focused modules with the remaining commands. Untouched project branches retain referential identity, semantic no-ops create no revisions, and history retains at most 200 undo steps. Updates from one continuous interaction share a group ID and replace the current grouped revision, so a drag remains one undo step.

Schema and command limits reject pathological documents before they can create unbounded editor work. The current v2 limits are development safeguards, not a frozen compatibility contract. New-ID batches are checked against one entity index, keyframe edits preserve sorted tracks through ordered insertion, and common commands validate only the changed value and its local invariants.

The desktop project-session controller combines that core history with file source, saved revision, and operation feedback. Undo and redo move between revisions, while dirty state compares the current revision ID with the last-saved one. Saving captures a specific revision, so edits made while a save is running remain dirty. Native project paths stay in Rust and are represented in the webview by opaque handles.

## User interface

React owns application layout, controls, inspectors, and low-frequency state presentation. Presentational components receive state and commands from the project-session controller; they do not perform filesystem or lifecycle work directly. Active scene, selected LEDs, the source of an LED selection, inspector target, and panel dimensions are transient UI state and never enter project files. Workspace selection derivation is a pure model function, while its state repair and setters remain in the selection hook.

Text fields keep temporary drafts locally and dispatch one command when an edit is committed. Continuous sliders and native colour input preview live at most once per animation frame and share one history group. Static LED states may retain a linked colour at zero brightness; only the explicit off command removes the sparse assignment. Workspace rendering is split into panel components and hooks for layout, selection, and preview lifecycle; the project-session hook remains the mutation boundary.

Workspace panel sizes, collapsed state, timeline zoom, and timeline snap are transient versioned application preferences. They are deliberately separate from project data so opening a project does not change the user's editor layout. The saved timeline height is a preferred floor; its effective height grows with the active scene's visible layer and property rows up to a fixed cap, after which one vertical viewport scrolls. Expanded keyframe tracks and editor selection remain workspace-session state rather than saved preferences.

Song selection, cue selection, the previewed scene, and song transport are coordinated by one workspace controller. The selected timeline tab is presentation state only: changing tabs does not silently switch or reset the active song transport. Cue-row drafts remain local until commit, rejected edits restore the persisted value, and Escape cancels without triggering the subsequent blur commit. Cue rows are memoized, receive stable command callbacks, and use browser layout containment so offscreen rows in a maximum-size song do not require repeated layout and paint work.

The editor clipboard is owned above an individual project workspace, so copied layers or keys survive switching projects during one app session. Clipboard snapshots contain no file handles and are not serialized. Cross-project paste maps linked colours by exact token ID and then exact hexadecimal value, resolves missing group targets to their concrete LED IDs, and rejects the entire command if any colour, LED, timing destination, or entity ID is invalid. Bulk move, paste, and delete commands are atomic editor-core operations and therefore create one history revision.

No additional global state library is needed while a reducer and controller hook provide a clear state transition boundary.

### Desktop source organization

The desktop uses a hybrid feature-first layout under `apps/desktop/src`:

- `app` owns application composition, the launcher, recovery boundary, and project-session orchestration.
- `workspace` coordinates cross-feature selection, layout, clipboard state, and panel composition.
- `features` owns cohesive editor surfaces such as assets, inspectors, playback, hardware preview, project settings, and the timeline.
- `platform/ports` defines filesystem and lifecycle contracts without Tauri imports; `platform/tauri` contains their concrete native adapters.
- `shared` contains reusable controls and interaction hooks that cannot import higher-level desktop modules.
- `styles` keeps the existing global CSS cascade in explicit, ordered files grouped by editor surface.

Cross-module desktop imports use the `@/` source alias, while imports inside one feature remain relative. ESLint applies the same dependency restrictions to aliased and relative imports: shared code cannot depend on higher-level modules, features cannot depend on app/workspace or concrete Tauri adapters, and project-session/workspace code stays behind platform ports. The app composition root is the only normal consumer of concrete Tauri gateways.

Tests stay beside the behavior they cover, except for the global test environment setup. Feature folders are not workspace packages: package extraction is reserved for code with a real non-React consumer or an independently useful public API.

## Playback and rendering

`packages/playback` owns deterministic loop timing and scene evaluation. It compiles a scene, palette, project groups, and hardware profile into an evaluator, validating and indexing references once. Given an explicit musical position, the evaluator composites the static base with ordered Pulse, Chase, Wave, Sparkle, and keyframe layers and produces a complete LED frame without depending on React, Tauri, or wall-clock time. Layer zero is topmost; Pulse and Wave replace every targeted LED while active, Chase replaces only its head and fading trail, Sparkle replaces only deterministically active LEDs, and a keyframe track independently replaces brightness or colour when that property has keys. Chase and Wave traverse profile-defined effect positions; multiple targeted LEDs at one position receive the same spatial value without expanding the target. Chase derives its internal step duration from its complete loop length and the number of targeted positions. Sparkle instead combines its persisted seed, musical step, and physical LED address as unsigned 32-bit words using FNV multiplication followed by the MurmurHash3 finalizer, retaining deterministic cross-runtime output while decorrelating adjacent LEDs. Each key stores Linear, Ease In, Ease Out, or Ease In/Out shaping for its outgoing segment. Brightness and smooth RGB colour use the same deterministic quadratic progress helper; step colour remains discrete and ignores easing. A keyframe layer's active window is a non-destructive mask over stored beat positions.

The desktop preview controller owns the transient clock and transport state. It advances with `requestAnimationFrame`, reports exact elapsed beats to the deterministic song state machine, and exposes small external-store selectors. Passing elapsed beats separately from the wrapped scene position preserves multiple completed loops after a delayed frame or a suspended webview. A compiled song transport indexes cue and scene references once and is reused across animation frames. Playback buttons subscribe only to status; static fretboards do not subscribe to position, while animated fretboards and the timeline playhead refresh each tick. Keyframe authoring subscribes to quarter-beat changes rather than every animation frame. Play, pause, stop, and seek never create project revisions. Project tempo and scene-loop edits reconfigure the running preview without restarting its phase; selecting another scene stops and resets it.

The timeline renders fine grid divisions with CSS and creates text-label and interactive keyframe nodes only for the visible viewport plus a small overscan. Eased brightness paths and colour gradients sample only those visible segments and call the same playback interpolation functions used by the LED preview. Scroll and resize measurement is animation-frame throttled, and layer-reorder geometry is captured once at drag start. Timeline zoom remains a rendering preference; persisted beats keep quarter-beat precision regardless of the active authoring snap.

Animation evaluation remains independent from the rendering surface and caches repeat requests for the same position. Chase and hold-style Sparkle reuse frames within a derived or persisted musical step; Pulse, Wave, fading Sparkle, and interpolated keyframes remain continuous. Newly added Chase and Wave layers default their loop length to the active scene loop, then remain independently editable. Built-in quick starts resolve to ordinary layer values in editor-core and do not add preset references to project files. Future effects, interpolation modes, and curve tools can extend the same centralized compositing model. Persisted preview tempo remains an editing default; any future external tempo override must remain transient runtime state.

The 10-LED hardware surface remains SVG because it benefits from native accessibility and direct interaction. Dense animation timelines may use Canvas or WebGL when introduced. Work should move to a Web Worker only when profiling shows that evaluation or serialization blocks the UI.

A React error boundary surrounds the project workspace. If rendering fails, the active session remains above the boundary and offers Retry, Save As, and Return to projects recovery actions.

## Native boundary

Tauri owns OS dialogs, project file paths, atomic persistence, and application exit coordination. File reads and writes run on the blocking task pool, enforce the 32 MiB project-file limit, and return stable structured error codes. Opaque paths are explicitly released from the native registry when files are replaced, rejected, or closed. The webview receives only the minimum commands and capabilities it needs. There is no network service or external backend.
