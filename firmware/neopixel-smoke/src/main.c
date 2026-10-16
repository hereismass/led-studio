#include <stddef.h>

#include <zephyr/device.h>
#include <zephyr/devicetree.h>
#include <zephyr/drivers/gpio.h>
#include <zephyr/drivers/led_strip.h>
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <zephyr/sys/util.h>

LOG_MODULE_REGISTER(neopixel_smoke, LOG_LEVEL_INF);

#define PIXEL_NODE DT_CHOSEN(zephyr_led_strip)
#define DIM_LEVEL 25U /* 25 / 255 = 9.8% channel duty cycle. */
#define RESET_DELAY_US DT_PROP(PIXEL_NODE, reset_delay)

BUILD_ASSERT(DT_PROP(PIXEL_NODE, chain_length) == 1,
             "This smoke test must drive exactly one pixel");
BUILD_ASSERT(DT_PROP(PIXEL_NODE, zephyr_deferred_init),
             "Set D0 low before initializing the WS2812 driver");

static const struct device *const pixel = DEVICE_DT_GET(PIXEL_NODE);
static const struct gpio_dt_spec data = GPIO_DT_SPEC_GET(PIXEL_NODE, gpios);

static const struct led_rgb sequence[] = {
    {.r = 0U, .g = 0U, .b = 0U},
    {.r = DIM_LEVEL, .g = 0U, .b = 0U},
    {.r = 0U, .g = DIM_LEVEL, .b = 0U},
    {.r = 0U, .g = 0U, .b = DIM_LEVEL},
    {.r = DIM_LEVEL, .g = DIM_LEVEL, .b = DIM_LEVEL},
};

int main(void) {
  int ret;

  if (!gpio_is_ready_dt(&data)) {
    LOG_ERR("D0 GPIO device is not ready");
    return 0;
  }

  /* Preload the physical output low while enabling it, before driver init. */
  ret = gpio_pin_configure_dt(&data, GPIO_OUTPUT_LOW);
  if (ret != 0) {
    LOG_ERR("Could not initialize D0 low: %d", ret);
    return 0;
  }
  k_busy_wait(RESET_DELAY_US);

  ret = device_init(pixel);
  if (ret != 0 || !device_is_ready(pixel)) {
    LOG_ERR("WS2812 initialization failed: %d", ret);
    return 0;
  }

  LOG_INF("One GRB pixel on D0: off, red, green, blue, white at 25/255");
  while (true) {
    for (size_t i = 0U; i < ARRAY_SIZE(sequence); i += 1U) {
      /* The GPIO driver rewrites this buffer into GRB order in place. */
      struct led_rgb frame = sequence[i];

      ret = led_strip_update_rgb(pixel, &frame, 1U);
      if (ret != 0) {
        (void)gpio_pin_set_raw(data.port, data.pin, 0);
        LOG_ERR("Pixel update failed; holding D0 low: %d", ret);
        return 0;
      }
      /* This GPIO driver leaves the wire low but does not wait for reset. */
      k_busy_wait(RESET_DELAY_US);
      k_sleep(K_SECONDS(1));
    }
  }
}
