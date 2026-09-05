# Supported Formats & Web Port Feature Comparison

This document details the file formats supported across the **mz800emu** emulator subsystems and provides a comprehensive breakdown of desktop features that were modified, omitted, or adapted for the **WebAssembly / browser web-port**.

---

## 1. Supported File Formats Matrix

The table below outlines all file extensions and containers recognized by the emulator, contrasting the native desktop build with the browser WebAssembly player:

| Extension / Format | Peripheral Subsystem | Description | Native Desktop | WebAssembly Player |
| :--- | :--- | :--- | :---: | :---: |
| **`.mzf`** | Cassette (CMT) / QuickLoad | Standard Sharp MZ single-file tape container (128B header + body) | ✅ Full | ✅ Drag & drop / URL |
| **`.m12`** | Cassette (CMT) | MZ-1200 / alternate tape format (identical 128B header structure) | ✅ Full | ✅ Drag & drop / URL |
| **`.mzt`** | Cassette (CMT) | Multi-file MZF virtual tape archive with block index | ✅ Full | ✅ Drag & drop / URL |
| **`.tap`** | Cassette (CMT) | ZX Spectrum tape image (converted to CMT pulse stream via `libs/zxtape`) | ✅ Full | ❌ Not exposed in web UI |
| **`.wav` / `.wave`** | Cassette (CMT) | Real audio waveform recording (PCM audio input playback and live record) | ✅ Full (R/W) | ❌ Not exposed in web UI |
| **`.dsk`** | Floppy Controller (FDC) | Extended CPC DSK format for WD279x (3", 3.5", 5.25" disks) | ✅ Full (R/W) | ✅ Drag & drop / URL |
| **`.mzq`** | Quick Disk (MZ-1F11) | Quick Disk 2.8" magnetic spiral disk cartridge image | ✅ Full (R/W) | ❌ Not exposed in web UI |
| **Directory** | Quick Disk (MZ-1F11) | Mapped host directory with `.mzf` files as virtual QD cartridge | ✅ Full | ❌ Not exposed in web UI |
| **`.img` / `.dat`** | Hard Disk (IDE8) | Raw sector disk images for 8-bit IDE Master (`HDD0`) and Slave (`HDD1`) | ✅ Full (R/W) | ❌ Not exposed in web UI |
| **`.dat` / `.bin`** | RAM Disk / Memext | Memory backup images for Standard RAM disk, Pezik RAM, and L&uuml;ftner Flash | ✅ Full (R/W) | ❌ Not exposed in web UI |
| **`.rom` / `.bin`** | System ROMs | Custom Monitor ROMs, CGROM character generators, and extension ROMs | ✅ Full | ❌ Built-in ROMs only |
| **`.mzs`** | Snapshot Engine | Native emulator state snapshot (zipped state + XML manifest) | ✅ Full (R/W) | ❌ Not exposed in web UI |
| **`.zip`** | Web Decompressor | ZIP archives containing `.mzf`, `.mzt`, `.m12`, or `.dsk` | ❌ (manual) | ✅ Auto client-side extract |

---

## 2. Format Details & Specifications

### 2.1 Cassette Tape Formats (CMT)
* **`.mzf`** ([`src/libs/mzf/`](../src/libs/mzf/)): The standard 8-bit Sharp MZ cassette format. Contains a 128-byte header (`st_MZF_HEADER`) with file type, 16-character Sharp ASCII filename, size, load address, execution address, and comment, followed by binary payload.
* **`.m12`** ([`src/emulator/hw-generic/cmt/cmt_mzf.c`](../src/emulator/hw-generic/cmt/cmt_mzf.c)): Tape images from the MZ-1200 series or alternate loaders. Treated identically to MZF in the loader.
* **`.mzt`** ([`src/emulator/hw-generic/cmt/cmt_mzftape.c`](../src/emulator/hw-generic/cmt/cmt_mzftape.c)): Virtual tape reel container format storing multiple MZF blocks sequentially, with metadata indexing for seeking and multi-stage game loads.
* **`.tap`** ([`src/libs/zxtape/`](../src/libs/zxtape/)): Popular in Central and Eastern Europe for loading ZX Spectrum cassette software into Sharp computers. Modulated into pilot tones, sync bits, and data pulses for the CMT comparator.
* **`.wav`, `.wave`** ([`src/libs/wav/`](../src/libs/wav/), [`src/emulator/hw-generic/cmt/cmt_wav.c`](../src/emulator/hw-generic/cmt/cmt_wav.c)): Standard PCM audio. The desktop emulator can play raw tape audio into the comparator line and record tape output directly to WAV files ([`cmt_save.c`](../src/emulator/hw-generic/cmt/cmt_save.c)).

### 2.2 Floppy Disk Format (FDC)
* **`.dsk`** ([`src/libs/dsk/`](../src/libs/dsk/)): Uses the Extended CPC DSK disk image standard. Supports single/double-sided disks, up to 204 tracks, variable sectors per track, custom sector sizes (128B to 1024B), and GAP/filler bytes for the Western Digital WD279x controller.

### 2.3 Quick Disk Format (QD)
* **`.mzq`** ([`src/emulator/hw-generic/qdisk/`](../src/emulator/hw-generic/qdisk/)): Raw dump of the 2.8-inch spiral Quick Disk media used by the MZ-1F11 drive.
* **Virtual Directory**: Host directory containing `.mzf` files, dynamically mapped into a virtual Quick Disk directory.

### 2.4 IDE Hard Disk (IDE8)
* **`.img` / `.dat`** ([`src/emulator/hw-generic/ide8/`](../src/emulator/hw-generic/ide8/)): Raw uncompressed 512-byte-per-sector disk images mounted as IDE Master or Slave hard disks.

### 2.5 Emulator Snapshots
* **`.mzs`** ([`src/emulator/snapshot/`](../src/emulator/snapshot/)): ZIP-compressed system state captures including Z80 registers, RAM, VRAM, GDG state, audio generator, timers, and peripheral status.

---

## 3. Features Excluded or Adapted in the Web Port

The `web-port` branch is specifically architected for client-side browser execution. To eliminate binary bloat, comply with browser security models, and maintain smooth 50/60 FPS performance without multithreading requirements, several desktop components were omitted or replaced:

### 3.1 Integrated Z80 Debugger & Developer Suite
Compiled out via `-DMZ800EMU_NO_DEBUGGER`:
* **Disassembler & Inline Assembler:** Interactive Z80 disassembler, live memory assembler (`iasm`, `dasm-z80`), and symbol lookup.
* **Breakpoints & Watchpoints:** Breakpoint conditions, execution counts, memory zones, hardware event triggers, and IRQ filters.
* **Memory Browser & Heatmap (CDL):** Live memory editor and Code Data Logger heatmap tracking executed instructions vs. read/write data.
* **Trace Suite Subsystems:** Streaming execution log engines:
  * CPU execution trace (`.cputrack`)
  * I/O port activity log (`.iorqlog`)
  * Interrupt log (`.intlog`)
  * Hardware controller event log (`.hwlog`)
  * User marker log (`.marklog`)
* **Callstack & Variables:** Callstack inspector, register history, smart variable watches, and bookmarks.

### 3.2 Multi-Architecture Switching (MZ-700 & MZ-1500)
* **Desktop:** Supports runtime switching between **Sharp MZ-800**, **Sharp MZ-700** (PAL/NTSC), and **Sharp MZ-1500**.
* **Web Port:** Built exclusively with `-DMZARCH=800` (Sharp MZ-800 mode). Code for MZ-700 and MZ-1500 bootstrap, memory banking, and I/O dispatch is excluded to minimize WebAssembly binary size.

### 3.3 Model Context Protocol (MCP Server)
* Compiled out via `-DMZ800EMU_NO_MCP` and `-DMZ800EMU_NO_MCP_TCP`.
* The desktop's JSON-RPC / MCP socket server and pipe interface (used for automated testing and programmatic emulator control) are disabled.

### 3.4 Dear ImGui Desktop GUI & Window Management
* The desktop multi-window docking environment ([Dear ImGui](https://github.com/ocornut/imgui)), top menu bar, and OS file dialogues (`ImGuiFileDialog`) are removed.
* Replaced with a lightweight HTML5/CSS player interface ([`web/`](../web/)):
  * Canvas-based video renderer with CRT scanline simulation and integer scaling.
  * Virtual retro Sharp MZ on-screen keyboard.
  * Mobile touch overlay with D-Pad and action buttons.
  * Emulation speed controls (1x PAL ~50Hz, 3x Fast, and multi-frame MAX Turbo).

### 3.5 Single-Threaded Cooperative Loop vs. Multithreading
* **Desktop:** Uses POSIX/GThread multithreading where a dedicated worker thread runs the Z80/GDG core and blocks on audio condition variables (`iface_audio_20ms_sync`) to throttle timing.
* **Web Port:** Uses a non-blocking cooperative frame loop ([`mz_wasm_run_frame`](../src/wasm/mz_wasm_api.c)) driven by `requestAnimationFrame`. Audio samples are extracted synchronously per frame and streamed non-blocking via the Web Audio API. This avoids `SharedArrayBuffer` requirements and cross-origin isolation headers (COOP/COEP), allowing zero-config hosting on GitHub Pages and embedded iframes.

### 3.6 Dependency Decoupling & Shimming
* **GLib 2.0:** Replaced by [`src/wasm/glib_shim.h`](../src/wasm/glib_shim.h), eliminating 4–8 MB of POSIX library overhead.
* **libcurl:** Excluded via `-DMZ_NO_VERSION_CHECK` (no automatic online update checks).
* **minizip-ng & XML:** Snapshot archiving dependencies are excluded from the WebAssembly build.
* **Native SDL3 Drivers:** SDL3 video and audio hardware backends are replaced by HTML5 Canvas 2D and Web Audio API contexts.

### 3.7 Peripheral Hardware Deck Controls
* **Tape Deck Controls:** Physical CMT transport buttons (Play, Pause, Stop, Rewind, Fast-Forward, Tape Counter) and WAV recording are omitted in the web UI. Media loads directly via memory injection (`cmthack`) or auto-mounting.
* **Quick Disk & IDE8 Menus:** Lower-level emulation code is present, but interactive drive mounting and cartridge swapping controls are not exposed in the web interface.
* **Plotter/Printer:** The MZ-1P16 four-color pen plotter visual output window is not connected to the web canvas.

### 3.8 Persistence & Disk Write-Back
* Desktop writes modified floppy sectors back to host files and saves configuration to `.ini`.
* The web player runs in volatile in-memory storage (Emscripten `MEMFS`). Disk changes made during gameplay are not saved back to host files or synced to IndexedDB.

### 3.9 Multi-Language Localization (i18n)
* Desktop features 10 UI languages (cs, de, en, es, fr, it, ja, nl, pl, sk, uk) via GNU gettext `.mo` files.
* The web player interface is English-only.
