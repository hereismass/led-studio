#include <led_studio/controller_runtime.h>

#include <stddef.h>
#include <stdint.h>

#include <zephyr/device.h>
#include <zephyr/devicetree.h>
#include <zephyr/drivers/led_strip.h>
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <zephyr/sys/util.h>

LOG_MODULE_REGISTER(led_studio_controller, LOG_LEVEL_INF);

#define LED_STRIP_NODE DT_CHOSEN(zephyr_led_strip)
#define STARTUP_WALK_STEP_US 200000ULL
#define STARTUP_WALK_DURATION_US                                            \
  (STARTUP_WALK_STEP_US * (uint64_t)LED_STUDIO_LED_COUNT)
#define STARTUP_PRIMARY_DURATION_US 500000ULL
#define STARTUP_TEST_DURATION_US                                            \
  (STARTUP_WALK_DURATION_US + 3ULL * STARTUP_PRIMARY_DURATION_US)
#define RENDER_INTERVAL_US (1000000ULL / LED_STUDIO_RENDER_HZ)

static const struct device *const led_strip = DEVICE_DT_GET(LED_STRIP_NODE);

static const led_studio_frame_t marker_glow_frame = {
    .pixels =
        {
            {0U, 255U, 64U},
            {0U, 255U, 64U},
            {0U, 255U, 64U},
            {0U, 255U, 64U},
            {255U, 43U, 154U},
            {255U, 43U, 154U},
            {0U, 255U, 64U},
            {0U, 255U, 64U},
            {0U, 255U, 64U},
            {0U, 255U, 64U},
        },
};

static const led_studio_frame_t pink_hold_frame = {
    .pixels =
        {
            {255U, 43U, 154U},
            {255U, 43U, 154U},
            {255U, 43U, 154U},
            {255U, 43U, 154U},
            {255U, 43U, 154U},
            {255U, 43U, 154U},
            {255U, 43U, 154U},
            {255U, 43U, 154U},
            {255U, 43U, 154U},
            {255U, 43U, 154U},
        },
};

static const led_studio_scene_t demo_scenes[] = {
    {
        .loop_length_q16 = 4U * LED_STUDIO_BEAT_ONE_Q16,
        .frame = &marker_glow_frame,
    },
    {
        .loop_length_q16 = 4U * LED_STUDIO_BEAT_ONE_Q16,
        .frame = &pink_hold_frame,
    },
};

static const led_studio_cue_t demo_cues[] = {
    {
        .scene_index = 0U,
        .advance = LED_STUDIO_CUE_AFTER_LOOPS,
        .loop_count = 2U,
    },
    {
        .scene_index = 1U,
        .advance = LED_STUDIO_CUE_MANUAL,
        .loop_count = 0U,
    },
};

static const led_studio_song_t demo_song = {
    .beats_per_minute = 120U,
    .cue_count = 2U,
    .cues = demo_cues,
};

static uint64_t monotonic_microseconds(void) {
  return k_ticks_to_us_floor64(k_uptime_ticks());
}

static void render_startup_test(uint64_t elapsed_us,
                                led_studio_frame_t *frame) {
  size_t index;

  *frame = (led_studio_frame_t){0};
  if (elapsed_us < STARTUP_WALK_DURATION_US) {
    const size_t address = (size_t)(elapsed_us / STARTUP_WALK_STEP_US);
    frame->pixels[address] = (led_studio_rgb_t){255U, 255U, 255U};
    return;
  }

  index = (size_t)((elapsed_us - STARTUP_WALK_DURATION_US) /
                   STARTUP_PRIMARY_DURATION_US);
  if (index == 0U) {
    for (index = 0U; index < LED_STUDIO_LED_COUNT; index += 1U) {
      frame->pixels[index].red = 255U;
    }
  } else if (index == 1U) {
    for (index = 0U; index < LED_STUDIO_LED_COUNT; index += 1U) {
      frame->pixels[index].green = 255U;
    }
  } else {
    for (index = 0U; index < LED_STUDIO_LED_COUNT; index += 1U) {
      frame->pixels[index].blue = 255U;
    }
  }
}

static int write_frame(const led_studio_frame_t *frame) {
  struct led_rgb pixels[LED_STUDIO_LED_COUNT] = {0};
  size_t index;

  for (index = 0U; index < LED_STUDIO_LED_COUNT; index += 1U) {
    pixels[index].r = frame->pixels[index].red;
    pixels[index].g = frame->pixels[index].green;
    pixels[index].b = frame->pixels[index].blue;
  }
  return led_strip_update_rgb(led_strip, pixels, LED_STUDIO_LED_COUNT);
}

int main(void) {
  led_studio_transport_t transport;
  led_studio_frame_t scene_frame;
  led_studio_frame_t output_frame;
  uint64_t previous_us;
  uint64_t next_render_us;
  uint64_t started_us;
  bool demo_started = false;

  if (!device_is_ready(led_strip)) {
    LOG_ERR("LED strip device is not ready");
    return 0;
  }
  if (led_strip_length(led_strip) < LED_STUDIO_LED_COUNT) {
    LOG_ERR("LED strip exposes fewer than %u pixels", LED_STUDIO_LED_COUNT);
    return 0;
  }
  if (!led_studio_transport_init(&transport, demo_scenes,
                                 ARRAY_SIZE(demo_scenes), &demo_song)) {
    LOG_ERR("Built-in demo song is invalid");
    return 0;
  }

  started_us = monotonic_microseconds();
  previous_us = started_us;
  next_render_us = started_us;
  LOG_INF("Starting 10-address walk and RGB calibration at %u%% brightness",
          LED_STUDIO_BRIGHTNESS_LIMIT_PERCENT);

  while (true) {
    const uint64_t now_us = monotonic_microseconds();
    const uint64_t startup_elapsed_us = now_us - started_us;

    if (!demo_started && startup_elapsed_us >= STARTUP_TEST_DURATION_US) {
      demo_started = true;
      previous_us = now_us;
      LOG_INF("Starting built-in two-scene song at %u BPM",
              (unsigned int)demo_song.beats_per_minute);
    }
    if (demo_started) {
      if (!led_studio_transport_advance_us(&transport,
                                           now_us - previous_us)) {
        LOG_ERR("Transport could not advance");
        break;
      }
      previous_us = now_us;
    }

    if (now_us >= next_render_us) {
      if (demo_started) {
        led_studio_transport_render(&transport, &scene_frame);
      } else {
        render_startup_test(startup_elapsed_us, &scene_frame);
      }
      led_studio_apply_brightness_limit(
          &scene_frame, &output_frame,
          LED_STUDIO_BRIGHTNESS_LIMIT_PERCENT);
      if (write_frame(&output_frame) != 0) {
        LOG_ERR("LED strip update failed");
        break;
      }
      next_render_us += RENDER_INTERVAL_US;
      if (next_render_us <= now_us) {
        next_render_us = now_us + RENDER_INTERVAL_US;
      }
    }

    k_sleep(K_MSEC(1));
  }

  return 0;
}
