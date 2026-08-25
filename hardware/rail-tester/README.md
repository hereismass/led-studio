# 5-pixel rigid rail tester

This is the first functional prototype for the bass fingerboard LEDs. It is deliberately **not** the final flex PCB: it tests the exact LED package, power voltage, data chain, two-rail wiring, and diffusion before committing to the final fret spacing and flexible construction.

Order four identical boards: two for the actual two-rail test and two spares. Each board is 49.5 x 14 mm, 0.8 mm thick, 2-layer rigid FR-4, with five addressable RGB LEDs at a deliberately simple 7 mm pitch.

## Electrical layout

`VLED/GND/DIN IN` enters at J1. `DIN` passes through R1 (330 ohm) into D1, then chains through D5. TP1 exposes the final `DOUT` for diagnosis only. C1 is the input capacitor and C2-C6 provide local bypassing at each LED.

Use one controller data output for each board. The controller and both boards must share ground. Do not use a controller board's low-current 3.3 V pin to power the LEDs; provide a regulated LED supply suitable for the test current. At full white, budget up to 180 mA per board and 360 mA for the two-board test; use a supply rated for at least 0.5 A total with current limiting.

## Assembly request

Upload `rail-tester.kicad_pcb` to AISLER and request top-side assembly. Use 0.8 mm, 2-layer rigid FR-4. The supplied `rail-tester-bom.csv` is the human-readable assembly reference; confirm the imported parts in AISLER's BOM Manager before checkout.

Before ordering, verify all of the following in AISLER's preview:

- D1-D5 are assigned to the exact Worldsemi `WS2812B-2020-V6` part, with the pin-1 orientation matching the board preview.
- R1 is a 330 ohm, 1%, 0603 resistor.
- C1 is a 1 uF, 10 V or higher, X5R/X7R, 0603 capacitor; C2-C6 are 100 nF, 10 V or higher, X5R/X7R, 0603 capacitors.
- D1-D5, R1, and C1-C6 are fitted. J1 and TP1 are excluded from assembly.

Supplying the V6 LEDs yourself is only a fallback if AISLER cannot procure that exact part. J1 and TP1 are intentional hand-solder pads: solder a three-conductor cable to J1 after assembly, then secure it to the board during testing with a small clamp or tape strain relief.

## Test plan

1. Connect each board to the controller with VLED/GND/DIN and a common ground. Add strain relief before moving the board.
2. Test the same animation at regulated 3.3 V and 5 V. Start with a conservative current limit and low software brightness, then increase gradually.
3. Compare brightness, colour consistency, and data reliability through a sample fingerboard diffuser.
4. Choose the final rail voltage only after this comparison.

The eventual bass build will use two long FPC rails at the final marker positions, not this 7 mm prototype spacing.
