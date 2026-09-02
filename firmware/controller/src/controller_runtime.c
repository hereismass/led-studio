#include <led_studio/controller_runtime.h>

#include <limits.h>
#include <string.h>

#define MICROSECONDS_PER_MINUTE 60000000ULL

static bool song_is_valid(const led_studio_scene_t *scenes,
                          size_t scene_count,
                          const led_studio_song_t *song) {
  size_t index;

  if (scenes == NULL || scene_count == 0U || song == NULL ||
      song->cues == NULL || song->cue_count == 0U ||
      song->beats_per_minute == 0U) {
    return false;
  }

  for (index = 0U; index < scene_count; index += 1U) {
    if (scenes[index].frame == NULL || scenes[index].loop_length_q16 == 0U) {
      return false;
    }
  }

  for (index = 0U; index < song->cue_count; index += 1U) {
    const led_studio_cue_t *cue = &song->cues[index];
    if (cue->scene_index >= scene_count) {
      return false;
    }
    if (cue->advance == LED_STUDIO_CUE_AFTER_LOOPS && cue->loop_count == 0U) {
      return false;
    }
    if (cue->advance != LED_STUDIO_CUE_MANUAL &&
        cue->advance != LED_STUDIO_CUE_AFTER_LOOPS) {
      return false;
    }
  }

  return true;
}

static void reset_cue_position(led_studio_transport_t *transport,
                               uint16_t cue_index) {
  transport->active_cue_index = cue_index;
  transport->completed_loops = 0U;
  transport->cue_position_q16 = 0U;
  transport->final_cue_held = false;
}

bool led_studio_transport_init(led_studio_transport_t *transport,
                               const led_studio_scene_t *scenes,
                               size_t scene_count,
                               const led_studio_song_t *song) {
  if (transport == NULL) {
    return false;
  }

  memset(transport, 0, sizeof(*transport));
  if (!song_is_valid(scenes, scene_count, song)) {
    return false;
  }

  transport->scenes = scenes;
  transport->scene_count = scene_count;
  transport->song = song;
  transport->valid = true;
  reset_cue_position(transport, 0U);
  return true;
}

bool led_studio_transport_launch_cue(led_studio_transport_t *transport,
                                    uint16_t cue_index) {
  if (transport == NULL || !transport->valid ||
      cue_index >= transport->song->cue_count) {
    return false;
  }

  reset_cue_position(transport, cue_index);
  transport->beat_fraction_remainder = 0U;
  return true;
}

bool led_studio_transport_next_cue(led_studio_transport_t *transport) {
  if (transport == NULL || !transport->valid ||
      transport->active_cue_index + 1U >= transport->song->cue_count) {
    return false;
  }

  return led_studio_transport_launch_cue(
      transport, (uint16_t)(transport->active_cue_index + 1U));
}

bool led_studio_transport_advance_q16(led_studio_transport_t *transport,
                                     uint64_t elapsed_beats_q16) {
  uint32_t transitions = 0U;

  if (transport == NULL || !transport->valid) {
    return false;
  }

  while (elapsed_beats_q16 > 0U) {
    const led_studio_cue_t *cue =
        &transport->song->cues[transport->active_cue_index];
    const led_studio_scene_t *scene =
        &transport->scenes[cue->scene_index];
    const uint32_t until_loop_end =
        scene->loop_length_q16 - transport->cue_position_q16;

    if (elapsed_beats_q16 < until_loop_end) {
      transport->cue_position_q16 += (uint32_t)elapsed_beats_q16;
      return true;
    }

    elapsed_beats_q16 -= until_loop_end;
    transport->cue_position_q16 = 0U;
    transport->completed_loops += 1U;

    if (cue->advance == LED_STUDIO_CUE_AFTER_LOOPS &&
        transport->completed_loops >= cue->loop_count) {
      if (transport->active_cue_index + 1U < transport->song->cue_count) {
        const uint16_t next_cue =
            (uint16_t)(transport->active_cue_index + 1U);
        reset_cue_position(transport, next_cue);
      } else {
        transport->final_cue_held = true;
      }
    }

    transitions += 1U;
    if (transitions > LED_STUDIO_MAX_TRANSPORT_TRANSITIONS) {
      return false;
    }
  }

  return true;
}

bool led_studio_transport_advance_us(led_studio_transport_t *transport,
                                    uint64_t elapsed_microseconds) {
  uint64_t numerator;
  uint64_t elapsed_beats_q16;

  if (transport == NULL || !transport->valid) {
    return false;
  }
  if (elapsed_microseconds == 0U) {
    return true;
  }
  if (elapsed_microseconds >
      (UINT64_MAX - transport->beat_fraction_remainder) /
          transport->song->beats_per_minute / LED_STUDIO_BEAT_ONE_Q16) {
    return false;
  }

  numerator = elapsed_microseconds * transport->song->beats_per_minute *
                  LED_STUDIO_BEAT_ONE_Q16 +
              transport->beat_fraction_remainder;
  elapsed_beats_q16 = numerator / MICROSECONDS_PER_MINUTE;
  transport->beat_fraction_remainder = numerator % MICROSECONDS_PER_MINUTE;
  return led_studio_transport_advance_q16(transport, elapsed_beats_q16);
}

const led_studio_scene_t *
led_studio_transport_current_scene(const led_studio_transport_t *transport) {
  const led_studio_cue_t *cue;

  if (transport == NULL || !transport->valid) {
    return NULL;
  }

  cue = &transport->song->cues[transport->active_cue_index];
  return &transport->scenes[cue->scene_index];
}

void led_studio_transport_render(const led_studio_transport_t *transport,
                                 led_studio_frame_t *frame) {
  const led_studio_scene_t *scene;

  if (frame == NULL) {
    return;
  }
  memset(frame, 0, sizeof(*frame));
  scene = led_studio_transport_current_scene(transport);
  if (scene != NULL) {
    memcpy(frame, scene->frame, sizeof(*frame));
  }
}

static uint8_t scale_channel(uint8_t value, uint8_t limit_percent) {
  const uint16_t scaled =
      (uint16_t)value * (uint16_t)limit_percent + (uint16_t)50U;
  return (uint8_t)(scaled / 100U);
}

void led_studio_apply_brightness_limit(const led_studio_frame_t *source,
                                       led_studio_frame_t *destination,
                                       uint8_t limit_percent) {
  size_t index;

  if (source == NULL || destination == NULL) {
    return;
  }
  if (limit_percent > 100U) {
    limit_percent = 100U;
  }

  for (index = 0U; index < LED_STUDIO_LED_COUNT; index += 1U) {
    destination->pixels[index].red =
        scale_channel(source->pixels[index].red, limit_percent);
    destination->pixels[index].green =
        scale_channel(source->pixels[index].green, limit_percent);
    destination->pixels[index].blue =
        scale_channel(source->pixels[index].blue, limit_percent);
  }
}
