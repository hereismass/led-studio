# One-NeoPixel hardware smoke test

Standalone Zephyr application for the Seeed XIAO nRF52840 and one WS2812 RGB
NeoPixel Mini Button. The ten-LED application in `../controller` is independent
and unchanged.

- Data: XIAO **D0** (nRF52840 **P0.02**), active high.
- Wire channel order: **RGB**. Changed from GRB after the initial hardware test
  showed swapped red/green output; this revised order awaits hardware confirmation.
- Repeats **off → red → green → blue → dim white**, approximately one second
  per state (five seconds per cycle).
- Every lit channel is **25/255**, approximately **9.8%** duty cycle, including
  all three channels in the white state. No full-brightness startup animation.
- Defers WS2812 driver initialization until the application configures D0 as
  `GPIO_OUTPUT_LOW`, then holds it low for 300 microseconds. The first frame
  clears the pixel. Each transmitted frame gets an explicit 300-microsecond
  low reset/latch period.

This uses Zephyr's [deferred device initialization](https://docs.zephyrproject.org/latest/kernel/drivers/index.html#deferred-initialization).

The low initialization applies once this application runs; it does not control
the pin during the bootloader or before firmware startup.

## Build with the existing local environment

The inspected workspace is `/Users/mass/zephyrproject`, with Zephyr **v4.4.2**,
its existing `.venv`, and Zephyr SDK **1.0.1**. From that workspace:

```sh
source /Users/mass/zephyrproject/.venv/bin/activate
export ZEPHYR_SDK_INSTALL_DIR=/Users/mass/zephyr-sdk-1.0.1
west build -b xiao_ble/nrf52840 \
  -d /Users/mass/Documents/GitHub/led-studio/firmware/neopixel-smoke/build \
  /Users/mass/Documents/GitHub/led-studio/firmware/neopixel-smoke \
  -- -DUSER_CACHE_DIR=/Users/mass/Documents/GitHub/led-studio/firmware/neopixel-smoke/build/.cache
```

The application has its own build directory and does not reuse or
overwrite `/Users/mass/zephyrproject/build` (the existing controller build).

Flashable output:

```text
/Users/mass/Documents/GitHub/led-studio/firmware/neopixel-smoke/build/zephyr/zephyr.uf2
```

The board's UF2 application partition and nRF52840 family ID are used. Building
does not flash hardware. Hardware colour order, signal timing, and electrical
operation still require a physical test.

## Build verification

The local build completed for `xiao_ble/nrf52840` using the environment above.
The UF2 is 112,640 bytes (220 blocks), with nRF52840 family ID `0xADA52840`
and application start address `0x27000`. Its block headers, numbering, address
range, initial stack/reset vectors, and payload equality with `zephyr.bin`
were checked. The compiled devicetree confirms one pixel, RGB, P0.02,
deferred initialization, and the 300-microsecond reset period.

The existing controller runtime host tests passed during the initial build.
The user subsequently flashed and ran the GRB version; the revised RGB build
has not been flashed or physically tested.

## Wiring for the later hardware test

Use D0 through the existing `SN74AHCT125N` level shifter to the single button's
**DIN**, with its channel enabled. Power the pixel and shifter from the regulated
5 V rail and join that supply's ground to XIAO ground. Power the XIAO by USB.
This test addresses only one pixel.
