/**
 * @file wasm_stubs.c
 * @brief Headless stubs for WebAssembly build of Sharp MZ-800 emulator.
 */

#include "main.h"
#include <glib.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdarg.h>

#include "app/app_thread.h"
#include "iface/iface_video.h"
#include "iface/iface_audio.h"

/* ================================================================
 * Video stubs
 * ================================================================ */
iface_video_callbacks_t *g_iface_video_callbacks = NULL;

static gboolean stub_video_init(void)
{
    if (g_iface_video) {
        APP_MUTEX_LOCK(g_iface_video->is_initialized_mutex);
        g_iface_video->is_initialized = true;
        APP_COND_SIGNAL(g_iface_video->is_initialized_cond);
        APP_MUTEX_UNLOCK(g_iface_video->is_initialized_mutex);
    }
    return TRUE;
}

static void stub_video_exit(void) {}
static void stub_video_set_colors(uint32_t *colormap) { (void)colormap; }
static void stub_video_set_window_focus(void) {}
static void stub_video_fix_window_aspect_ratio(char correction_by) { (void)correction_by; }
static void stub_video_set_window_size_by_scale(float scale) { (void)scale; }
static void stub_video_set_framerate_mode(en_DISPLAY_FRAMERATE_MODE mode, int custom_fps) {
    (void)mode;
    (void)custom_fps;
}
static void stub_video_set_fullscreen(bool enabled) { (void)enabled; }
static void stub_video_switch_fullscreen(void) {}
static void stub_video_reset_hdr(void) {}

static iface_video_callbacks_t s_stub_video_callbacks = {
    .init = stub_video_init,
    .exit = stub_video_exit,
    .set_colors = stub_video_set_colors,
    .set_window_focus = stub_video_set_window_focus,
    .fix_window_aspect_ratio = stub_video_fix_window_aspect_ratio,
    .set_window_size_by_scale = stub_video_set_window_size_by_scale,
    .set_framerate_mode = stub_video_set_framerate_mode,
    .set_fullscreen = stub_video_set_fullscreen,
    .switch_fullscreen = stub_video_switch_fullscreen,
    .reset_hdr = stub_video_reset_hdr,
};

void wasm_install_video_stubs(void)
{
    g_iface_video_callbacks = &s_stub_video_callbacks;
}

/* ================================================================
 * Audio stubs
 * ================================================================ */
bool iface_audio_lowlevel_init(void) { return true; }
void iface_audio_lowlevel_quit(void) {}
void iface_audio_lowlevel_pause(void) {}
void iface_audio_lowlevel_resume(void) {}

/* ================================================================
 * SdlApp stubs
 * ================================================================ */
gboolean sdlapp_is_running(SdlApp *app)
{
    (void)app;
    return TRUE; /* In Wasm single-thread, emulator is running */
}

void sdlapp_quit(SdlApp *app) { (void)app; }

gboolean sdlapp_is_quit_requested(SdlApp *app)
{
    (void)app;
    return FALSE;
}

SdlAppWindowManager *sdlapp_get_winmanager(SdlApp *app)
{
    (void)app;
    return NULL;
}

SdlAppWindow *sdlapp_winmanager_get_window_by_name(SdlAppWindowManager *wm, const gchar *name)
{
    (void)wm;
    (void)name;
    return NULL;
}

int sdlapp_send_message_for_SDL_windowID(uint32_t win_id, uint32_t type, int32_t code, void *data1, void *data2)
{
    (void)win_id; (void)type; (void)code; (void)data1; (void)data2;
    return 0;
}

/* ================================================================
 * Version check stubs
 * ================================================================ */
void version_check_init(void) {}
void version_check_exit(void) {}
void *version_check_report_new(void) { return NULL; }
void version_check_report_add_branch(void *report, void *branch) { (void)report; (void)branch; }
void *version_check_branch_new(const char *name, const char *version, uint32_t version_int) {
    (void)name; (void)version; (void)version_int;
    return NULL;
}
void version_check_branch_set_msg(void *branch, const char *msg) { (void)branch; (void)msg; }
int version_xml_document_parse(const char *xml, void *report) { (void)xml; (void)report; return -1; }

/* ================================================================
 * Build revision stubs
 * ================================================================ */
uint32_t build_revision_get_int(void) { return 0; }

/* ================================================================
 * BaseUI & File chooser stubs
 * ================================================================ */
void *baseui_filechooser_open_file(const char *title, const char *filter) {
    (void)title; (void)filter;
    return NULL;
}

void *baseui_filechooser_open_file_wait(const char *title, const char *filter) {
    (void)title; (void)filter;
    return NULL;
}

void *baseui_filechooser_save_file(const char *title, const char *filter) {
    (void)title; (void)filter;
    return NULL;
}

void *baseui_filechooser_open_dir(const char *title) {
    (void)title;
    return NULL;
}

void *baseui_filechooser_open_rw_file(const char *title, const char *filter) {
    (void)title; (void)filter;
    return NULL;
}

const char *baseui_filechooser_get_extension_ptr(void *fc) {
    (void)fc;
    return NULL;
}

void baseui_filechooser_destroy(void *fc) { (void)fc; }

void baseui_show_message(const char *msg) {
    fprintf(stderr, "[Wasm baseui_msg] %s\n", msg);
}

void baseui_show_error_message(const char *msg) {
    fprintf(stderr, "[Wasm baseui_err] %s\n", msg);
}

int baseui_cmt_check_mzf_filesize(const char *filename, unsigned int expected_size, unsigned int real_size) {
    (void)filename; (void)expected_size; (void)real_size;
    return 0;
}

/* ================================================================
 * ImGui stubs
 * ================================================================ */
void imgui_cmt_tape_update_filelist(void) {}
void imgui_cmt_fix_mzfsize_popup_activate(void) {}
void imgui_message_vprintf(int type, const char *fmt, va_list args) {
    (void)type;
    vfprintf(stderr, fmt, args);
    fprintf(stderr, "\n");
}
void imgui_version_check_report_done(void *report) { (void)report; }
void imgui_filechooser_new(void) {}

/* ================================================================
 * Debugger UI stubs
 * ================================================================ */
void ui_debugger_show_main_window(void) {}
void ui_debugger_hide_main_window(void) {}
void bpt_state_init(void) {}

/* ================================================================
 * Joystick stubs
 * ================================================================ */
bool iface_joy_lowlevel_init(void) { return true; }
void iface_joy_lowlevel_exit(void) {}
void iface_joy_get_calibration(void) {}
bool iface_joy_init(void) { return true; }
void iface_joy_exit(void) {}
int iface_joy_open_configured_joyid(int joy_devid) { (void)joy_devid; return -1; }
uint8_t iface_joy_scan(int joy_devid) { (void)joy_devid; return 0xff; }

/* ================================================================
 * UI Persistence stubs
 * ================================================================ */
void mhmap_window_register_persistence(void *cmod_void) { (void)cmod_void; }
void dasm_window_register_persistence(void *cmod_void) { (void)cmod_void; }
void dasm_window_apply_persisted(void) {}

/* ================================================================
 * Snapshot stubs
 * ================================================================ */
void snapshot_init(void) {}
void snapshot_exit(void) {}
void snapshot_config_init(void) {}

/* ================================================================
 * Emulator Measuring stubs
 * ================================================================ */
#include "emulator/emulator_measuring.h"

st_EMULATOR_MEASURING g_emulator_measuring;

void emulator_measuring_init(void) {}
void emulator_measuring_exit(void) {}
void emulator_measuring_frame_timing_reset(void) {}
void emulator_measuring_frame_timing_event(void) {}
void emulator_measuring_gdg_init(st_EMULATOR_MEASURING_GDG *msgdg) { (void)msgdg; }
void emulator_measuring_gdg_exit(st_EMULATOR_MEASURING_GDG *msgdg) { (void)msgdg; }
void emulator_measuring_gdg_event(st_EMULATOR_MEASURING_GDG *msgdg) { (void)msgdg; }
bool emulator_measuring_gdg_set_enabled(st_EMULATOR_MEASURING_GDG *msgdg, bool enabled, int update_time_sec) { (void)msgdg; (void)enabled; (void)update_time_sec; return false; }
void emulator_measuring_maxspeed_init(st_EMULATOR_MEASURING_MAXSPEED *ms) { (void)ms; }
void emulator_measuring_maxspeed_exit(st_EMULATOR_MEASURING_MAXSPEED *ms) { (void)ms; }
void emulator_measuring_maxspeed_reset(void) {}
void emulator_measuring_maxspeed_update_segment(void) {}
void emulator_measuring_maxspeed_stall_begin(void) {}
void emulator_measuring_maxspeed_stall_end(void) {}
void emulator_measuring_maxspeed_report(st_MAXSPEED_BENCH_RESULT *out) { if (out) out->valid = false; }
void emulator_measuring_maxspeed_print(void) {}
