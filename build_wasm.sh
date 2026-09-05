#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"

if [ -d "$ROOT_DIR/src" ]; then
    REPO_DIR="$ROOT_DIR"
else
    REPO_DIR="$ROOT_DIR/repo"
fi

EMSDK_DIR="${EMSDK_DIR:-$ROOT_DIR/emsdk}"
if [ ! -d "$EMSDK_DIR" ] && [ -d "$ROOT_DIR/../emsdk" ]; then
    EMSDK_DIR="$ROOT_DIR/../emsdk"
fi

if [ -f "$EMSDK_DIR/emsdk_env.sh" ]; then
    source "$EMSDK_DIR/emsdk_env.sh" > /dev/null 2>&1
fi
WEB_DIR="$REPO_DIR/web"
mkdir -p "$WEB_DIR"

SOURCES=(
    # WASM Bridge & Stubs
    "$REPO_DIR/src/wasm/mz_wasm_api.c"
    "$REPO_DIR/src/wasm/wasm_stubs.c"

    # Core libs
    "$REPO_DIR/src/libs/cpu-z80/z80.c"
    "$REPO_DIR/src/libs/generic_driver/generic_driver.c"
    "$REPO_DIR/src/libs/cfgfile/cfgelement.c"
    "$REPO_DIR/src/libs/cfgfile/cfgmodule.c"
    "$REPO_DIR/src/libs/cfgfile/cfgroot.c"
    "$REPO_DIR/src/libs/cfgfile/cfgtools.c"
    "$REPO_DIR/src/libs/dsk/dsk.c"
    "$REPO_DIR/src/libs/dsk/dsk_tools.c"
    "$REPO_DIR/src/libs/mzf/mzf.c"
    "$REPO_DIR/src/libs/mzf/mzf_tools.c"
    "$REPO_DIR/src/libs/endianity/endianity.c"
    "$REPO_DIR/src/libs/sdlapp/sdlapp_options.c"
    "$REPO_DIR/src/libs/sdlapp/sdlapp_paths.c"
    "$REPO_DIR/src/libs/cmt_stream/cmt_bitstream.c"
    "$REPO_DIR/src/libs/cmt_stream/cmt_stream.c"
    "$REPO_DIR/src/libs/cmt_stream/cmt_vstream.c"
    "$REPO_DIR/src/libs/cmtspeed/cmtspeed.c"
    "$REPO_DIR/src/libs/wav/wav.c"
    "$REPO_DIR/src/libs/sharpmz_ascii/sharpmz_ascii.c"
    "$REPO_DIR/src/libs/mztape/mztape.c"
    "$REPO_DIR/src/libs/zxtape/zxtape.c"
    "$REPO_DIR/src/emulator/hw-generic/mz1p16/mcs48.c"
    "$REPO_DIR/src/emulator/hw-generic/mz1p16/mz1p16.c"
    "$REPO_DIR/src/emulator/hw-generic/mz1p16/mz1p16_rom.c"

    # Root src
    "$REPO_DIR/src/fs_layer.c"
    "$REPO_DIR/src/time_profiler.c"

    # Iface
    "$REPO_DIR/src/iface/iface.c"
    "$REPO_DIR/src/iface/iface_audio.c"
    "$REPO_DIR/src/iface/iface_audio_resampler.c"
    "$REPO_DIR/src/iface/iface_video.c"

    # BaseUI & Generic Driver
    "$REPO_DIR/src/baseui/baseui_tools.c"
    "$REPO_DIR/src/generic_driver/file_driver.c"
    "$REPO_DIR/src/generic_driver/memory_driver.c"

    # Emulator core
    "$REPO_DIR/src/emulator/audio.c"
    "$REPO_DIR/src/emulator/cfgmain.c"
    "$REPO_DIR/src/emulator/customspeed.c"
    "$REPO_DIR/src/emulator/display.c"
    "$REPO_DIR/src/emulator/emulator.c"

    # MZArch flat
    "$REPO_DIR/src/emulator/mzarch/bootstrap.c"
    "$REPO_DIR/src/emulator/mzarch/interrupt.c"
    "$REPO_DIR/src/emulator/mzarch/mzarch.c"
    "$REPO_DIR/src/emulator/mzarch/mzarch_platform.c"
    "$REPO_DIR/src/emulator/i18n_lang.c"

    # HW Generic
    "$REPO_DIR/src/emulator/hw-generic/cmt/cmt.c"
    "$REPO_DIR/src/emulator/hw-generic/cmt/cmt_mzf.c"
    "$REPO_DIR/src/emulator/hw-generic/cmt/cmt_mzftape.c"
    "$REPO_DIR/src/emulator/hw-generic/cmt/cmt_save.c"
    "$REPO_DIR/src/emulator/hw-generic/cmt/cmt_tap.c"
    "$REPO_DIR/src/emulator/hw-generic/cmt/cmt_wav.c"
    "$REPO_DIR/src/emulator/hw-generic/cmt/cmtext.c"
    "$REPO_DIR/src/emulator/hw-generic/cmt/cmtext_block.c"
    "$REPO_DIR/src/emulator/hw-generic/cmt/cmtext_container.c"
    "$REPO_DIR/src/emulator/hw-generic/cmt/cmthack.c"
    "$REPO_DIR/src/emulator/hw-generic/ctc8253/ctc8253.c"
    "$REPO_DIR/src/emulator/hw-generic/fdc/fdc.c"
    "$REPO_DIR/src/emulator/hw-generic/fdc/wd279x.c"
    "$REPO_DIR/src/emulator/hw-generic/fdc/wd279x_read_track.c"
    "$REPO_DIR/src/emulator/hw-generic/fdc/wd279x_write_track.c"
    "$REPO_DIR/src/emulator/hw-generic/joy/joy.c"
    "$REPO_DIR/src/emulator/hw-generic/joy/joymz-1x03.c"
    "$REPO_DIR/src/emulator/hw-generic/memory/memext.c"
    "$REPO_DIR/src/emulator/hw-generic/memory/rom.c"
    "$REPO_DIR/src/emulator/hw-generic/pio8255/pio8255.c"
    "$REPO_DIR/src/emulator/hw-generic/pioz80/pioz80.c"
    "$REPO_DIR/src/emulator/hw-generic/printer/printer.c"
    "$REPO_DIR/src/emulator/hw-generic/psg/psg.c"
    "$REPO_DIR/src/emulator/hw-generic/ide8/ide8.c"
    "$REPO_DIR/src/emulator/hw-generic/qdisk/qdisk.c"
    "$REPO_DIR/src/emulator/hw-generic/ramdisk/ramdisk.c"
    "$REPO_DIR/src/emulator/hw-generic/mz1p16/mz1p16_emu.c"
    "$REPO_DIR/src/emulator/hw-generic/unicard/unicard.c"
    "$REPO_DIR/src/emulator/hw-generic/unicard/unicard_sfn.c"
    "$REPO_DIR/src/emulator/hw-generic/unicard/unimgr.c"
    "$REPO_DIR/src/emulator/hw-generic/unicard/MGR1500_V211B_MZF.c"
    "$REPO_DIR/src/emulator/hw-generic/unicard/MGR700_V211B_MZF.c"
    "$REPO_DIR/src/emulator/hw-generic/unicard/MGR800_V211B_MZF.c"
    "$REPO_DIR/src/emulator/hw-generic/unicard/MGR_V24_MZF.c"
    "$REPO_DIR/src/emulator/hw-generic/unicard/MZFLOADER_MZF.c"
    "$REPO_DIR/src/emulator/hw-generic/unicard/SC3SROM_MZF.c"
    "$REPO_DIR/src/emulator/hw-generic/unicard/SDERR1500_MZF.c"
    "$REPO_DIR/src/emulator/hw-generic/unicard/SDERR800_MZF.c"

    # MZ800 specific
    "$REPO_DIR/src/emulator/mzarch/mz800/mz800_bootstrap.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/mz800_iorq.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/mz800_main.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/cmt/mz800_cmthack.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/gdg/mz800_framebuffer.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/gdg/mz800_gdg.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/gdg/mz800_gdg_event.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/gdg/mz800_gdg_mirror.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/gdg/mz800_hwscroll.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/gdg/mz800_vramctrl.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/mz800_memory.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/mz800_rom.c"

    # ROMs
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/ROM_MZ800_0000.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/ROM_MZ800_CGROM.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/ROM_MZ800_E000.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/JSS-1.3/ROM_JSS103_0000.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/JSS-1.3/ROM_JSS103_CGROM.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/JSS-1.3/ROM_JSS103_E000.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/JSS-1.5C/ROM_JSS105C_0000.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/JSS-1.5C/ROM_JSS105C_CGROM.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/JSS-1.5C/ROM_JSS105C_E000.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/JSS-1.6A/ROM_JSS106A_0000.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/JSS-1.6A/ROM_JSS106A_CGROM.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/JSS-1.6A/ROM_JSS106A_E000.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/JSS-1.8C/ROM_JSS108C_0000.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/JSS-1.8C/ROM_JSS108C_CGROM.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/JSS-1.8C/ROM_JSS108C_E000.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/WILLY/ROM_WILLY_0000.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/WILLY/ROM_WILLY_en_CGROM.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/WILLY/ROM_WILLY_en_E000.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/WILLY/ROM_WILLY_ge_CGROM.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/WILLY/ROM_WILLY_ge_E000.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/WILLY/ROM_WILLY_jap_CGROM.c"
    "$REPO_DIR/src/emulator/mzarch/mz800/memory/ROM/WILLY/ROM_WILLY_jap_E000.c"
)

echo "Compiling ${#SOURCES[@]} source files to $WEB_DIR/mz800.js..."

emcc -O3 -flto \
    -I"$REPO_DIR/src/wasm" \
    -I"$REPO_DIR/src" \
    -I"$REPO_DIR/src/emulator" \
    -I"$REPO_DIR/src/emulator/hw-generic" \
    -I"$REPO_DIR/src/emulator/mzarch" \
    -I"$REPO_DIR/src/emulator/mzarch/mz800" \
    -include "$REPO_DIR/src/wasm/glib_shim.h" \
    -DMZARCH=800 -DMZARCH_NAME=\"mz800\" -DMZTVSYS_PAL=50 -DMZTVSYS_NTSC=60 -DMZTVSYS=MZTVSYS_PAL -DMZTVSYS_NAME=\"PAL\" \
    -DMZ800EMU_NO_DEBUGGER -DMZ800EMU_NO_MCP -DMZ800EMU_NO_MCP_TCP -DMZ_NO_VERSION_CHECK -DUSE_COMPUTED_GOTO=1 -DMZTEST_HEADLESS -DUSE_SDL3_AUDIO \
    -sEXPORTED_FUNCTIONS="['_mz_wasm_init','_mz_wasm_reset','_mz_wasm_run_frame','_mz_wasm_get_framebuffer','_mz_wasm_get_screen_width','_mz_wasm_get_screen_height','_mz_wasm_get_audio_samples','_mz_wasm_key_event','_mz_wasm_load_mzf','_mz_wasm_load_dsk','_mz_wasm_load_file','_malloc','_free']" \
    -sEXPORTED_RUNTIME_METHODS="['ccall','cwrap','getValue','setValue','HEAPU8','HEAPU32','HEAPF32']" \
    -sALLOW_MEMORY_GROWTH=1 \
    -sINITIAL_MEMORY=33554432 \
    -sSTACK_SIZE=2097152 \
    "${SOURCES[@]}" \
    -o "$WEB_DIR/mz800.js"

echo "Build complete: $WEB_DIR/mz800.js and $WEB_DIR/mz800.wasm created."
