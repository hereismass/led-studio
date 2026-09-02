# Controller runtime v1 contract

This development contract defines the first embedded runtime for the KMS bass prototype. It is intentionally smaller than the LED Studio project format and may change while the prototype is being tested.

## Hardware target

- Controller: Seeed Studio XIAO nRF52840.
- Firmware platform: Zephyr 4.4.2.
- LED chain: ten addressable RGB NeoPixel Mini Button PCBs using the 800 kHz WS2812-compatible protocol.
- LED data output: XIAO D0 through the `SN74AHCT125N` level shifter.
- LED power: separately regulated 5 V supply with ground shared with the controller.
- Hardware profile: `kms-4-string-10-led-v1`.

The editor order and electrical order are deliberately different:

| Editor position | Fret/lane | Effect position | Electrical address |
| --------------: | --------- | --------------: | -----------------: |
|               0 | 3 E-side  |               0 |                  9 |
|               1 | 5 E-side  |               1 |                  8 |
|               2 | 7 E-side  |               2 |                  7 |
|               3 | 9 E-side  |               3 |                  6 |
|               4 | 12 E-side |               4 |                  5 |
|               5 | 12 G-side |               4 |                  4 |
|               6 | 15 G-side |               5 |                  3 |
|               7 | 17 G-side |               6 |                  2 |
|               8 | 19 G-side |               7 |                  1 |
|               9 | 21 G-side |               8 |                  0 |

Runtime framebuffers are always indexed by electrical address. Spatial effects use effect position, so the two fret-12 LEDs move together without becoming one physical pixel.

The TypeScript hardware profile remains the source of truth for this mapping. Firmware deliberately does not duplicate editor positions, fret labels, or effect positions; the future compiler resolves them into electrical-address output.

## Colour and output

Application and compiler code represent colours as `{ red, green, blue }`, with one unsigned byte per channel. The initial NeoPixel driver uses a GRB wire mapping: it transmits the green byte first, followed by red and blue. This is only a device-driver detail and does not change colour representation elsewhere.

NeoPixel colour order can vary between pixel revisions. Prototype firmware therefore starts with an address walk followed by red, green, and blue calibration frames. If the displayed primaries do not match, only the device-tree colour mapping changes.

The output driver applies a global 50% brightness limit after scene compositing. This is a prototype safety and visual-comfort default, not a project property. No gamma correction or per-channel colour calibration is applied in v1. Both can be introduced after testing the actual LEDs behind the final bass inlays.

## Time and frame cadence

- Nominal LED output cadence: 60 frames per second.
- Frame interval: approximately 16.67 ms.
- Musical time source: monotonic elapsed time, never a count of rendered frames.
- Internal beat positions: unsigned Q16.16 fixed-point beats.
- Song tempo: whole BPM for the first runtime.

The Mini Button chain uses an 800 kHz protocol. Ten 24-bit pixels require about 0.3 ms of data transmission plus reset time, leaving ample room inside a 16.67 ms frame. If a frame is delayed, the runtime advances musical time by the complete elapsed duration and renders the current position; it does not slow the song to replay missed frames.

The initial Zephyr integration uses its nRF52-supported GPIO driver for the simplest D0 wiring. Because that driver generates the signal in software, hardware testing must profile it alongside BLE before the controller architecture is considered final. If it causes unacceptable radio or scheduler latency, the output adapter can move to a peripheral-backed driver without changing transport, rendering, or the runtime colour model.

Display refresh, BLE traffic, USB communication, and input polling must not become musical clocks. They may run at independent rates.

## Initial transport behavior

- A song owns its BPM and ordered cues.
- A cue references one scene.
- A manual cue loops until an explicit cue command is received.
- An automatic cue advances after its configured number of complete scene loops.
- The final cue continues looping and reports that its automatic boundary has been reached.
- Launching a cue resets its scene position and completed-loop count.
- Scene changes are hard cuts in v1.

The portable runtime accepts commands such as launch cue and next cue. Buttons, footswitches, USB, and BLE MIDI will later translate their input into those commands rather than owning separate transport logic.

## Development boundaries

The controller does not parse `.ledstudio` JSON. A later desktop compiler will resolve project references and produce a compact, checksummed controller package. Until that package exists, firmware uses a built-in two-scene test song.

The following remain outside controller runtime v1:

- device-package parsing and persistent show storage;
- USB upload;
- BLE MIDI and external clock;
- OLED screens and final footswitch mappings;
- setlists and MIDI mapping documents;
- battery monitoring and production power management;
- scene-transition effects.
