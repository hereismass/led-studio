# LED Studio controller firmware

This folder contains the Zephyr-based controller firmware for the XIAO nRF52840 prototype. Its transport and output preparation are portable C so they can be tested on the development Mac without a Zephyr installation.

The current firmware:

- targets `xiao_ble/nrf52840`;
- drives ten WS2812-compatible pixels from XIAO D0;
- configures the wire channel order as GRB;
- applies the runtime's 50% output limit;
- refreshes LEDs at a nominal 60 Hz from monotonic time;
- performs a startup address and RGB calibration test;
- then plays a built-in two-scene song whose first cue advances automatically.

See [the controller runtime contract](../../docs/controller-runtime-v1.md) for the exact addressing and timing rules.

## Host tests

From the repository root:

```sh
pnpm test:firmware
```

The test compiles the portable runtime with the system C compiler using strict warnings, runs transport and output tests, and removes its temporary executable afterward.

## Zephyr build

The firmware manifest pins Zephyr 4.4.2. Install the Zephyr prerequisites and SDK, then create or initialize a west workspace from `firmware/west.yml`. From that workspace run:

```sh
west build -b xiao_ble/nrf52840 /absolute/path/to/led-studio/firmware/controller
west flash
```

The XIAO bootloader also accepts the generated UF2 file after entering bootloader mode with a double reset. A debug probe is optional for UF2 flashing but will be useful once the firmware grows beyond bring-up.

The Zephyr toolchain is not installed by the JavaScript workspace and is deliberately not managed by pnpm. Follow Zephyr's official Getting Started guide for the host dependencies rather than installing unpinned build tools into this repository.

The bring-up build uses Zephyr's GPIO WS2812 driver so the prototype can keep its D0 wiring. Profile that implementation once BLE is active; the LED output boundary is isolated so a peripheral-backed driver can replace it if software-generated LED timing interferes with radio scheduling.

## Prototype wiring

- XIAO D0 connects to one `SN74AHCT125N` input.
- The corresponding level-shifter output connects to data-in on electrical LED address 0, the fret-21 G-side LED.
- The LED rail and level shifter use the separate 5 V supply.
- The XIAO and 5 V supply grounds must be connected.

Do not power the complete LED chain from the XIAO's 3.3 V output.
