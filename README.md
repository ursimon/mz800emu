# mz800emu — WebAssembly & Web Port

[![Play Online](https://img.shields.io/badge/Play%20Online-Live%20Demo-brightgreen?style=for-the-badge&logo=googlechrome&logoColor=white)](https://ursimon.github.io/mz800emu/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Upstream](https://img.shields.io/badge/Upstream-michalhucik%2Fmz800emu-orange)](https://github.com/michalhucik/mz800emu)

> **Interactive WebAssembly port of the [Sharp MZ-800/700/1500 emulator](https://github.com/michalhucik/mz800emu) by Michal Hučík.**
>
> 🕹️ **[Click here to play in your browser](https://ursimon.github.io/mz800emu/)**

---

### About this WebAssembly Port

This repository branch (`web-port`) contains a high-performance WebAssembly compilation and browser-based player for **mz800emu**, enabling faithful, cycle-accurate Sharp MZ emulation directly in any modern desktop or mobile browser without plugins or installation.

#### Web Features
- **Zero-Install Web Player:** Pure client-side execution via WebAssembly and HTML5 Canvas with CRT integer scaling.
- **Synchronous Web Audio:** Resampled audio streaming through Web Audio API with zero audio drift or pops.
- **Controls & Input:** Full physical keyboard mapping, virtual retro on-screen keyboard, and mobile touch D-Pad & action buttons.
- **Speed & Turbo:** 1x authentic PAL (~50Hz), Fast (3x), and multi-frame MAX Turbo fast-forward.
- **Media Loading:** Drag & drop support for `.mzf`, `.mzt`, `.dsk`, and tape/disk images.
- **Zero-Leak Runtime:** Cooperative non-blocking frame loop designed for 60Hz browser `requestAnimationFrame`.

#### GPLv3 Compliance & Upstream Attribution
This port is distributed under the **GNU General Public License v3.0 (GPLv3)** in compliance with the original software license.
- **Original Author & Upstream Project:** [Michal Hučík](https://github.com/michalhucik) — [https://github.com/michalhucik/mz800emu](https://github.com/michalhucik/mz800emu)
- **Port Author:** [Michal Ursiny](https://github.com/ursimon)
- **Modifications (GPLv3 Section 5 Notice):**
  - Added WebAssembly C runtime bridge (`src/wasm/mz_wasm_api.c`, `mz_wasm_api.h`).
  - Added GLib shim header (`src/wasm/glib_shim.h`) to decouple the core emulator from heavy POSIX desktop dependencies.
  - Implemented cooperative, non-blocking single-threaded frame execution (`mz_wasm_run_frame`) replacing desktop blocking audio/video loops.
  - Added HTML5 / Web Audio frontend, touch controls, and Emscripten build toolchain (`build_wasm.sh`, `web/`).

---

### Building the WebAssembly Port

Prerequisites: [Emscripten SDK (emsdk)](https://emscripten.org/docs/getting_started/downloads.html).

```bash
# Compile C core to web/mz800.js and web/mz800.wasm
./build_wasm.sh

# Run headless verification test suite
node test_node.js
node test_speed.js
node test_memory_audit.js

# Serve the web player locally
python3 -m http.server -d web 8080
```

---

### Deploying to GitHub Pages

The live web player is hosted on GitHub Pages from the `gh-pages` branch at:
🎮 **[https://ursimon.github.io/mz800emu/](https://ursimon.github.io/mz800emu/)**

Whenever changes are made to the WebAssembly core or the web frontend on `web-port`, deploy the updated `web/` assets directly to `gh-pages` using:

```bash
# 1. Rebuild WebAssembly binary and JS glue
./build_wasm.sh

# 2. Deploy web/ tree directly to the gh-pages branch
COMMIT_ID=$(git commit-tree $(git rev-parse HEAD:web) -m "feat(pages): update web player build")
git branch -f gh-pages $COMMIT_ID
git push origin gh-pages
```

GitHub Pages will automatically pick up the new commit on `gh-pages` and update the live site within seconds.

---

# Original mz800emu Project

[![Build](https://github.com/michalhucik/mz800emu/actions/workflows/build.yml/badge.svg)](https://github.com/michalhucik/mz800emu/actions/workflows/build.yml)

Open-source emulator of the 8-bit Sharp MZ-800, MZ-700 and MZ-1500 home computers.

[Česky](README_cz.md)

## Project has moved to GitHub

The project was previously hosted on SourceForge:
https://sourceforge.net/projects/mz800emu/

**Source code is no longer updated on SourceForge** - all development now happens here on GitHub. The SourceForge page will continue to receive release archives only (binary distributions for users who prefer to download from there).

## Features

- Emulation of three Sharp MZ-series machines:
  - **Sharp MZ-800**
  - **Sharp MZ-700**
  - **Sharp MZ-1500**
- Cycle-accurate Z80A CPU emulation (uses the [z80-mz800](https://github.com/michalhucik/z80-mz800) library)
- Faithful emulation of original chips:
  - GDG WHID 65040-032 (video controller)
  - i8253 CTC, Z80 PIO, i8255 PIO
  - SN76489AN PSG
- Precise internal signal timing
- Wide range of supported peripherals:
  - Cassette (CMT): MZF, MZT, TAP, WAV
  - Floppy disk controller (FDC WD279x)
  - Quick Disk
  - RAM disk, memory extensions
  - Unicard
  - IDE8 hard disk interface
- Integrated Z80 debugger:
  - Disassembler with inline assembler
  - Memory browser with heatmap
  - Breakpoints, watchpoints, symbols, bookmarks, variables
- Multi-platform GUI:
  - Virtual keyboard, autotype
  - Joystick support
  - Variable emulation speed
  - Snapshot system (.mzs)
- Full localization into 10 languages (cs, de, en, es, fr, it, ja, nl, pl, sk, uk)

## Technology

- C / C++ (C11 / C++17)
- [SDL3](https://www.libsdl.org/) for video, audio, input
- [Dear ImGui](https://github.com/ocornut/imgui) for the GUI
- [GLib](https://gitlab.gnome.org/GNOME/glib) for utilities
- [libcurl](https://curl.se/libcurl/) and [minizip-ng](https://github.com/zlib-ng/minizip-ng) for I/O
- CMake build system (also supports legacy GNU make on MSYS2)

## Supported platforms

- **Linux** (tested on Ubuntu 24.04)
- **Windows** (MSYS2/MINGW64 toolchain)
- BSD systems may work but are not regularly tested

## Building

Detailed build instructions are available in `docs/`:

- [docs/build_ubuntu.md](docs/build_ubuntu.md) - building on Ubuntu / Linux
- [docs/build_windows.md](docs/build_windows.md) - building on Windows via MSYS2
- [docs/build_osx.md](docs/build_osx.md) - building on macOS

Quick build (when dependencies are already installed):

```sh
cmake -S . -B build -G Ninja
cmake --build build
```

## Documentation

- [docs/](docs/) - user-facing build and usage documentation, changelog

## Related projects

The emulator builds on a family of related libraries and tools maintained in the same author's account:

- [z80-mz800](https://github.com/michalhucik/z80-mz800) - Z80A CPU core and disassembler
- [TapeMZ](https://github.com/michalhucik/TapeMZ) - tape archive format for Sharp MZ
- [mzdisk](https://github.com/michalhucik/mzdisk) - disk image tools for Sharp MZ

## License

GNU General Public License v3.0 (GPLv3). See [LICENSE](LICENSE).

## Author

Michal Hučík (https://github.com/michalhucik)
