#ifndef LED_STUDIO_CONTROLLER_RUNTIME_H
#define LED_STUDIO_CONTROLLER_RUNTIME_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define LED_STUDIO_LED_COUNT 10U
#define LED_STUDIO_RENDER_HZ 60U
#define LED_STUDIO_BRIGHTNESS_LIMIT_PERCENT 50U
#define LED_STUDIO_BEAT_ONE_Q16 65536U
#define LED_STUDIO_MAX_TRANSPORT_TRANSITIONS 100000U

typedef struct {
  uint8_t red;
  uint8_t green;
  uint8_t blue;
} led_studio_rgb_t;

typedef struct {
  led_studio_rgb_t pixels[LED_STUDIO_LED_COUNT];
} led_studio_frame_t;

typedef struct {
  uint32_t loop_length_q16;
  const led_studio_frame_t *frame;
} led_studio_scene_t;

typedef enum {
  LED_STUDIO_CUE_MANUAL = 0,
  LED_STUDIO_CUE_AFTER_LOOPS = 1,
} led_studio_cue_advance_t;

typedef struct {
  uint16_t scene_index;
  led_studio_cue_advance_t advance;
  uint16_t loop_count;
} led_studio_cue_t;

typedef struct {
  uint16_t beats_per_minute;
  uint16_t cue_count;
  const led_studio_cue_t *cues;
} led_studio_song_t;

typedef struct {
  const led_studio_scene_t *scenes;
  size_t scene_count;
  const led_studio_song_t *song;
  uint16_t active_cue_index;
  uint32_t completed_loops;
  uint32_t cue_position_q16;
  uint64_t beat_fraction_remainder;
  bool final_cue_held;
  bool valid;
} led_studio_transport_t;

bool led_studio_transport_init(led_studio_transport_t *transport,
                               const led_studio_scene_t *scenes,
                               size_t scene_count,
                               const led_studio_song_t *song);

bool led_studio_transport_launch_cue(led_studio_transport_t *transport,
                                    uint16_t cue_index);

bool led_studio_transport_next_cue(led_studio_transport_t *transport);

bool led_studio_transport_advance_q16(led_studio_transport_t *transport,
                                     uint64_t elapsed_beats_q16);

bool led_studio_transport_advance_us(led_studio_transport_t *transport,
                                    uint64_t elapsed_microseconds);

const led_studio_scene_t *
led_studio_transport_current_scene(const led_studio_transport_t *transport);

void led_studio_transport_render(const led_studio_transport_t *transport,
                                 led_studio_frame_t *frame);

void led_studio_apply_brightness_limit(const led_studio_frame_t *source,
                                       led_studio_frame_t *destination,
                                       uint8_t limit_percent);

#endif
