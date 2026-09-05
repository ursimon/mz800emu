/**
 * @file mz_wasm_api.c
 * @brief Public WebAssembly JavaScript bridge API implementation for Sharp MZ-800 emulator.
 */

#include "wasm/mz_wasm_api.h"

#include "main.h"
#include <glib.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "emulator/emulator.h"
#include "emulator/display.h"
#include "emulator/cfgmain.h"
#include "emulator/audio.h"
#include "iface/iface_video.h"
#include "iface/iface_audio.h"
#include "mzarch/mzarch_platform_functions.h"
#include "mzarch/mzarch.h"
#include "mzarch/mzarch_config.h"
#include "mzarch/bootstrap.h"
#include "hw-generic/gdg/gdg.h"
#include "hw-generic/gdg/framebuffer.h"
#include "hw-generic/gdg/video.h"
#include "hw-generic/pio8255/pio8255.h"
#include "generic_driver/file_driver.h"
#include "generic_driver/memory_driver.h"
#include "libs/sdlapp/sdlapp_options.h"
#include "libs/sdlapp/sdlapp_paths.h"
#include "libs/mzf/mzf.h"

/* Forward declaration for video stub installer in wasm_stubs.c */
extern void wasm_install_video_stubs(void);

/* SdlApp instance stub for path resolution */
static SdlApp s_sdlapp_instance;
SdlApp *g_sdlapp = &s_sdlapp_instance;

/* Static RGBA Framebuffer (928 x 288) */
static uint32_t s_rgba_framebuffer[VIDEO_DISPLAY_WIDTH * VIDEO_DISPLAY_HEIGHT];

/* RGBA Palette lookup cache (16 Sharp MZ colors) */
static uint32_t s_palette_rgba[16];

/* Audio sample buffer (interleaved stereo float samples) */
#define MAX_AUDIO_SAMPLES 8192
static float s_audio_frame_buffer[MAX_AUDIO_SAMPLES];
static int s_audio_samples_count = 0;

/* Initialized flag */
static bool s_wasm_initialized = false;

static void update_palette_cache(void)
{
    uint32_t *colormap = display_get_default_color_schema();
    if (!colormap) {
        colormap = g_display_predef_colors;
    }
    for (int i = 0; i < 16; i++) {
        uint32_t c = colormap[i];
        uint32_t r = (c >> 16) & 0xFF;
        uint32_t g = (c >> 8) & 0xFF;
        uint32_t b = c & 0xFF;
        /* Little-endian RGBA: 0xAABBGGRR in memory gives [R, G, B, A] bytes */
        s_palette_rgba[i] = (0xFF000000u) | (b << 16) | (g << 8) | r;
    }
}

static void update_rgba_framebuffer(void)
{
    if (!g_framebuffer.pixels) return;
    const uint8_t *src = g_framebuffer.pixels;
    uint32_t *dst = s_rgba_framebuffer;
    size_t count = (size_t)VIDEO_DISPLAY_WIDTH * (size_t)VIDEO_DISPLAY_HEIGHT;
    for (size_t i = 0; i < count; i++) {
        dst[i] = s_palette_rgba[src[i] & 0x0F];
    }
}

int mz_wasm_init(void)
{
    if (s_wasm_initialized) {
        return 0;
    }

    /* 1. Install headless video stubs */
    wasm_install_video_stubs();

    /* 2. SdlApp Paths stub */
    g_sdlapp->paths = sdlapp_paths_new();

    /* 3. Disable saving config INI */
    static const char *s_argv[] = { "mz800", "--no-save-ini", NULL };
    sdlapp_options_init(2, (char **)s_argv);

    /* 4. Configuration */
    cfgmain_init();

    /* 5. Video & Audio interface */
    iface_video_init();
    iface_audio_init();

    /* Ensure audio sync does not block single-threaded execution */
    g_iface_audio.state = IFACE_AUDIO_BUFFER_STATE_UNSYNC;

    /* 6. Emulator core state */
    memset(&g_emulator, 0, sizeof(st_EMULATOR));
    g_emulator.paused = false;

    /* 7. Display and palette */
    display_init();
    update_palette_cache();

    /* 8. Drivers */
    file_driver_init();
    memory_driver_init();

    /* 9. Hardware architecture & chips (CPU, GDG, CTC, PIO, PSG, CMT, Unicard) */
    mzarch_platform_fn_init();

    /* 10. Architecture reset to boot ROM */
    mzarch_main_reset();

    /* 11. Keyboard matrix reset (all keys released, active-low 0xFF) */
    pio8255_keyboard_matrix_reset();

    s_wasm_initialized = true;
    printf("Sharp MZ-800 WebAssembly core initialized successfully.\n");
    return 0;
}

void mz_wasm_reset(void)
{
    if (!s_wasm_initialized) {
        mz_wasm_init();
        return;
    }
    mzarch_main_reset();
    pio8255_keyboard_matrix_reset();
    s_audio_samples_count = 0;
}

void mz_wasm_run_frame(void)
{
    if (!s_wasm_initialized) {
        mz_wasm_init();
    }

    /* Execute exactly 1 PAL screen (~20ms, ~70,938 CPU T-states) */
    mzarch_run_one_frame();

    /* Process audio if prepared */
    if (g_iface_audio.prepared_frame != g_iface_audio.played_frame) {
        size_t samples_bytes = 0;
        float *samples = iface_audio_wait_for_data(&samples_bytes);
        if (samples && samples_bytes > 0) {
            int count = (int)(samples_bytes / sizeof(float));
            if (count > MAX_AUDIO_SAMPLES) count = MAX_AUDIO_SAMPLES;
            memcpy(s_audio_frame_buffer, samples, (size_t)count * sizeof(float));
            s_audio_samples_count = count;
            g_free(samples);
        }
    }

    /* Update RGBA pixel buffer from GDG indexed pixels */
    update_rgba_framebuffer();
}

uint32_t* mz_wasm_get_framebuffer(void)
{
    return s_rgba_framebuffer;
}

int mz_wasm_get_screen_width(void)
{
    return VIDEO_DISPLAY_WIDTH;
}

int mz_wasm_get_screen_height(void)
{
    return VIDEO_DISPLAY_HEIGHT;
}

int mz_wasm_get_audio_samples(float *out_buffer, int max_samples)
{
    if (!out_buffer || max_samples <= 0) {
        return s_audio_samples_count;
    }
    int to_copy = (s_audio_samples_count < max_samples) ? s_audio_samples_count : max_samples;
    if (to_copy > 0) {
        memcpy(out_buffer, s_audio_frame_buffer, (size_t)to_copy * sizeof(float));
        if (to_copy < s_audio_samples_count) {
            memmove(s_audio_frame_buffer, &s_audio_frame_buffer[to_copy], (size_t)(s_audio_samples_count - to_copy) * sizeof(float));
            s_audio_samples_count -= to_copy;
        } else {
            s_audio_samples_count = 0;
        }
    }
    return to_copy;
}

void mz_wasm_key_event(int col, int bit, bool pressed)
{
    if (col < 0 || col >= 10 || bit < 0 || bit >= 8) {
        return;
    }
    /* Active-low: 0 when pressed, 1 when released */
    if (pressed) {
        g_pio8255.keyboard_matrix[col] &= (uint8_t)~(1 << bit);
    } else {
        g_pio8255.keyboard_matrix[col] |= (uint8_t)(1 << bit);
    }
}

int mz_wasm_load_mzf(const uint8_t *data, size_t size)
{
    if (!s_wasm_initialized) {
        mz_wasm_init();
    }
    if (!data || size < sizeof(st_MZF_HEADER)) {
        return -1;
    }

    const char *path = "/autorun.mzf";
    FILE *f = fopen(path, "wb");
    if (!f) {
        return -2;
    }
    size_t written = fwrite(data, 1, size, f);
    fclose(f);

    if (written != size) {
        return -3;
    }

    mzarch_bootstrap_run_mzf(path);
    return 0;
}
