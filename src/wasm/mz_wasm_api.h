/**
 * @file mz_wasm_api.h
 * @brief Public WebAssembly JavaScript bridge API for Sharp MZ-800 emulator.
 */

#ifndef MZ_WASM_API_H
#define MZ_WASM_API_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize the Sharp MZ-800 emulator in WebAssembly mode.
 * @return 0 on success, non-zero on error.
 */
int mz_wasm_init(void);

/**
 * @brief Reset the emulator.
 */
void mz_wasm_reset(void);

/**
 * @brief Execute CPU and chips for exactly one frame (20ms PAL, ~70,938 cycles).
 * Advances screen raster and audio synthesis.
 */
void mz_wasm_run_frame(void);

/**
 * @brief Get pointer to 32-bit RGBA pixel buffer (width x height).
 */
uint32_t* mz_wasm_get_framebuffer(void);

/**
 * @brief Get display width in pixels (e.g. 640 or 928 with borders).
 */
int mz_wasm_get_screen_width(void);

/**
 * @brief Get display height in pixels (e.g. 200 or 288 with borders).
 */
int mz_wasm_get_screen_height(void);

/**
 * @brief Extract generated audio samples for the frame.
 * @param out_buffer Destination buffer for interleaved float stereo samples.
 * @param max_samples Maximum number of floats the buffer can hold.
 * @return Actual number of float samples written.
 */
int mz_wasm_get_audio_samples(float *out_buffer, int max_samples);

/**
 * @brief Update Sharp MZ 8255 PPI keyboard matrix for key press/release.
 * @param col Matrix column (0 to 9).
 * @param bit Matrix bit (0 to 7).
 * @param pressed true if pressed, false if released.
 */
void mz_wasm_key_event(int col, int bit, bool pressed);

/**
 * @brief Inject and automatically boot an MZF tape image.
 * @param data Raw MZF binary buffer.
 * @param size Size in bytes.
 * @return 0 on success, non-zero on error.
 */
int mz_wasm_load_mzf(const uint8_t *data, size_t size);

/**
 * @brief Mount a DSK floppy image into FDC0 Drive 0 and reset machine.
 * @param data Raw DSK image buffer.
 * @param size Size in bytes.
 * @return 0 on success, non-zero on error.
 */
int mz_wasm_load_dsk(const uint8_t *data, size_t size);

/**
 * @brief Auto-detect format (MZF or DSK) by filename or data inspection and boot.
 * @param filename Optional filename or NULL.
 * @param data Raw binary buffer.
 * @param size Size in bytes.
 * @return 0 on success, non-zero on error.
 */
int mz_wasm_load_file(const char *filename, const uint8_t *data, size_t size);

#ifdef __cplusplus
}
#endif

#endif /* MZ_WASM_API_H */
