#include <led_studio/controller_runtime.h>

#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>

static const led_studio_frame_t first_frame = {
    .pixels =
        {
            {255U, 128U, 1U},
            {0U, 0U, 0U},
        },
};

static const led_studio_frame_t second_frame = {
    .pixels =
        {
            {1U, 2U, 3U},
            {4U, 5U, 6U},
        },
};

static const led_studio_scene_t scenes[] = {
    {
        .loop_length_q16 = 4U * LED_STUDIO_BEAT_ONE_Q16,
        .frame = &first_frame,
    },
    {
        .loop_length_q16 = 2U * LED_STUDIO_BEAT_ONE_Q16,
        .frame = &second_frame,
    },
};

static const led_studio_cue_t automatic_cues[] = {
    {
        .scene_index = 0U,
        .advance = LED_STUDIO_CUE_AFTER_LOOPS,
        .loop_count = 2U,
    },
    {
        .scene_index = 1U,
        .advance = LED_STUDIO_CUE_AFTER_LOOPS,
        .loop_count = 1U,
    },
};

static const led_studio_song_t automatic_song = {
    .beats_per_minute = 120U,
    .cue_count = 2U,
    .cues = automatic_cues,
};

static void test_runtime_defaults(void) {
  assert(LED_STUDIO_LED_COUNT == 10U);
  assert(LED_STUDIO_RENDER_HZ == 60U);
  assert(LED_STUDIO_BRIGHTNESS_LIMIT_PERCENT == 50U);
}

static void test_brightness_limit(void) {
  led_studio_frame_t output = {0};

  led_studio_apply_brightness_limit(&first_frame, &output, 50U);
  assert(output.pixels[0].red == 128U);
  assert(output.pixels[0].green == 64U);
  assert(output.pixels[0].blue == 1U);

  led_studio_apply_brightness_limit(&first_frame, &output, 200U);
  assert(output.pixels[0].red == 255U);
  assert(output.pixels[0].green == 128U);
}

static void test_delayed_automatic_advance(void) {
  led_studio_transport_t transport;
  led_studio_frame_t rendered = {0};

  assert(led_studio_transport_init(&transport, scenes, 2U, &automatic_song));
  assert(led_studio_transport_advance_us(&transport, 4250000U));
  assert(transport.active_cue_index == 1U);
  assert(transport.completed_loops == 0U);
  assert(transport.cue_position_q16 == LED_STUDIO_BEAT_ONE_Q16 / 2U);
  assert(!transport.final_cue_held);

  led_studio_transport_render(&transport, &rendered);
  assert(rendered.pixels[0].red == second_frame.pixels[0].red);
  assert(rendered.pixels[1].green == second_frame.pixels[1].green);
}

static void test_fractional_elapsed_time_accumulates(void) {
  led_studio_transport_t transport;

  assert(led_studio_transport_init(&transport, scenes, 2U, &automatic_song));
  assert(led_studio_transport_advance_us(&transport, 333333U));
  assert(transport.cue_position_q16 < LED_STUDIO_BEAT_ONE_Q16);
  assert(led_studio_transport_advance_us(&transport, 166667U));
  assert(transport.cue_position_q16 == LED_STUDIO_BEAT_ONE_Q16);
  assert(transport.beat_fraction_remainder == 0U);
}

static void test_final_automatic_cue_holds(void) {
  led_studio_transport_t transport;

  assert(led_studio_transport_init(&transport, scenes, 2U, &automatic_song));
  assert(led_studio_transport_launch_cue(&transport, 1U));
  assert(led_studio_transport_advance_q16(
      &transport, 5U * LED_STUDIO_BEAT_ONE_Q16));
  assert(transport.active_cue_index == 1U);
  assert(transport.completed_loops == 2U);
  assert(transport.cue_position_q16 == LED_STUDIO_BEAT_ONE_Q16);
  assert(transport.final_cue_held);
  assert(!led_studio_transport_next_cue(&transport));
}

static void test_manual_cue_loops_until_command(void) {
  const led_studio_cue_t manual_cues[] = {
      {
          .scene_index = 0U,
          .advance = LED_STUDIO_CUE_MANUAL,
          .loop_count = 0U,
      },
      {
          .scene_index = 1U,
          .advance = LED_STUDIO_CUE_MANUAL,
          .loop_count = 0U,
      },
  };
  const led_studio_song_t manual_song = {
      .beats_per_minute = 120U,
      .cue_count = 2U,
      .cues = manual_cues,
  };
  led_studio_transport_t transport;

  assert(led_studio_transport_init(&transport, scenes, 2U, &manual_song));
  assert(led_studio_transport_advance_q16(
      &transport, 10U * LED_STUDIO_BEAT_ONE_Q16));
  assert(transport.active_cue_index == 0U);
  assert(transport.completed_loops == 2U);
  assert(transport.cue_position_q16 == 2U * LED_STUDIO_BEAT_ONE_Q16);
  assert(led_studio_transport_next_cue(&transport));
  assert(transport.active_cue_index == 1U);
  assert(transport.completed_loops == 0U);
  assert(transport.cue_position_q16 == 0U);
}

static void test_invalid_documents_are_rejected(void) {
  const led_studio_scene_t invalid_scene = {
      .loop_length_q16 = 0U,
      .frame = &first_frame,
  };
  const led_studio_cue_t invalid_cue = {
      .scene_index = 2U,
      .advance = LED_STUDIO_CUE_MANUAL,
      .loop_count = 0U,
  };
  const led_studio_song_t invalid_song = {
      .beats_per_minute = 120U,
      .cue_count = 1U,
      .cues = &invalid_cue,
  };
  led_studio_transport_t transport;

  assert(!led_studio_transport_init(&transport, &invalid_scene, 1U,
                                    &automatic_song));
  assert(!led_studio_transport_init(&transport, scenes, 2U, &invalid_song));
}

int main(void) {
  test_runtime_defaults();
  test_brightness_limit();
  test_delayed_automatic_advance();
  test_fractional_elapsed_time_accumulates();
  test_final_automatic_cue_holds();
  test_manual_cue_loops_until_command();
  test_invalid_documents_are_rejected();
  puts("controller runtime host tests passed");
  return 0;
}
