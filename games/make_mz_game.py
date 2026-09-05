#!/usr/bin/env python3
"""
Generate a playable Sharp MZ-800 retro game: "MZ-RUNNER"
Packed into standard 128-byte MZF container.
"""

import struct

def build_game_mzf(output_path):
    # Z80 Machine Code Assembler for MZ-RUNNER
    code = bytearray()

    # Constants
    LOAD_ADDR = 0x1200
    VRAM_TEXT = 0xD000
    VRAM_ATTR = 0xD800

    def org(addr):
        pass

    # Labels and jumps
    label_locs = {}
    fixups = []

    def L(name):
        label_locs[name] = len(code) + LOAD_ADDR

    def emit(*bytes_list):
        for b in bytes_list:
            code.append(b & 0xFF)

    def emit_w(w):
        code.append(w & 0xFF)
        code.append((w >> 8) & 0xFF)

    def JR(cond, label_name):
        # cond: None, 'Z', 'NZ', 'C', 'NC'
        op = 0x18
        if cond == 'NZ': op = 0x20
        elif cond == 'Z':  op = 0x28
        elif cond == 'NC': op = 0x30
        elif cond == 'C':  op = 0x38
        emit(op, 0x00)
        fixups.append((len(code) - 1, label_name, 'rel'))

    def JP(label_name):
        emit(0xC3)
        emit_w(0x0000)
        fixups.append((len(code) - 2, label_name, 'abs'))

    def CALL(label_name):
        emit(0xCD)
        emit_w(0x0000)
        fixups.append((len(code) - 2, label_name, 'abs'))

    # Start of Program (0x1200)
    L("START")
    emit(0xF3)            # DI

    # Set Stack Pointer
    emit(0x31, 0xF0, 0x10) # LD SP, 0x10F0

    # Clear screen: 1000 bytes at 0xD000 with 0x00 (space), 0xD800 with 0x71 (white/blue)
    emit(0x21, 0x00, 0xD0) # LD HL, 0xD000
    emit(0x11, 0x01, 0xD0) # LD DE, 0xD001
    emit(0x01, 0xE7, 0x03) # LD BC, 999
    emit(0x36, 0x00)       # LD (HL), 0x00 (space)
    emit(0xED, 0xB0)       # LDIR

    # Clear color: 1000 bytes at 0xD800 with 0x71 (white foreground, blue background)
    emit(0x21, 0x00, 0xD8) # LD HL, 0xD800
    emit(0x11, 0x01, 0xD8) # LD DE, 0xD801
    emit(0x01, 0xE7, 0x03) # LD BC, 999
    emit(0x36, 0x71)       # LD (HL), 0x71 (white/blue)
    emit(0xED, 0xB0)       # LDIR

    # Draw top border (row 3, 40 blocks of 0x5C)
    emit(0x21, 0x78, 0xD0) # LD HL, 0xD078 (row 3: 3 * 40 = 120 = 0x78)
    emit(0x06, 0x28)       # LD B, 40
    L("TOP_BORDER_LOOP")
    emit(0x36, 0x5C)       # LD (HL), 0x5C
    emit(0x23)             # INC HL
    emit(0x10, 0xFB)       # DJNZ TOP_BORDER_LOOP (-5 bytes)

    # Draw bottom border (row 22, 40 blocks of 0x5C)
    emit(0x21, 0x70, 0xD3) # LD HL, 0xD370 (row 22: 22 * 40 = 880 = 0x370 -> 0xD370)
    emit(0x06, 0x28)       # LD B, 40
    L("BOT_BORDER_LOOP")
    emit(0x36, 0x5C)       # LD (HL), 0x5C
    emit(0x23)             # INC HL
    emit(0x10, 0xFB)       # DJNZ BOT_BORDER_LOOP (-5 bytes)

    # Draw vertical side borders (rows 4 to 21)
    emit(0x06, 0x12)       # LD B, 18 rows
    emit(0x21, 0xA0, 0xD0) # LD HL, 0xD0A0 (row 4, col 0)
    L("SIDE_BORDER_LOOP")
    emit(0x36, 0x5C)       # LD (HL), 0x5C (left wall)
    # Add 39 to HL for right wall
    emit(0x11, 0x27, 0x00) # LD DE, 39
    emit(0x19)             # ADD HL, DE
    emit(0x36, 0x5C)       # LD (HL), 0x5C (right wall)
    # Move to start of next row: +1 to HL
    emit(0x23)             # INC HL
    emit(0x10, 0xF5)       # DJNZ SIDE_BORDER_LOOP

    # Print Title: "SHARP MZ-800 WASM RUNNER" at row 1, col 8 (0xD028 + 8 = 0xD030)
    title_chars = [
        0x13, 0x08, 0x01, 0x12, 0x10, 0x00, # S H A R P _
        0x0D, 0x1A, 0x5B, 0x28, 0x20, 0x20, 0x00, # M Z - 8 0 0 _
        0x17, 0x01, 0x13, 0x0D, 0x00, # W A S M _
        0x12, 0x15, 0x0E, 0x0E, 0x05, 0x12  # R U N N E R
    ]
    emit(0x21, 0x30, 0xD0) # LD HL, 0xD030
    for ch in title_chars:
        emit(0x36, ch)     # LD (HL), ch
        emit(0x23)         # INC HL

    # Print Instructions at row 23, col 5 (0xD398 + 5 = 0xD39D): "DPAD:MOVE  FIRE:BOOST"
    inst_chars = [
        0x04, 0x10, 0x01, 0x04, 0x5A, # D P A D :
        0x0D, 0x0F, 0x16, 0x05, 0x00, 0x00, # M O V E _ _
        0x06, 0x09, 0x12, 0x05, 0x5A, # F I R E :
        0x02, 0x0F, 0x0F, 0x13, 0x14  # B O O S T
    ]
    emit(0x21, 0x9D, 0xD3) # LD HL, 0xD39D
    for ch in inst_chars:
        emit(0x36, ch)
        emit(0x23)

    # Initialize Variables
    # Variables in RAM at 0x1100:
    # 0x1100: Player X (20)
    # 0x1101: Player Y (12)
    # 0x1102: Dir DX (1)
    # 0x1103: Dir DY (0)
    # 0x1104: Food X (10)
    # 0x1105: Food Y (8)
    # 0x1106: Score (0)
    emit(0x3E, 20); emit(0x32, 0x00, 0x11) # X = 20
    emit(0x3E, 12); emit(0x32, 0x01, 0x11) # Y = 12
    emit(0x3E, 1);  emit(0x32, 0x02, 0x11) # DX = 1
    emit(0x3E, 0);  emit(0x32, 0x03, 0x11) # DY = 0
    emit(0x3E, 10); emit(0x32, 0x04, 0x11) # FoodX = 10
    emit(0x3E, 8);  emit(0x32, 0x05, 0x11) # FoodY = 8
    emit(0x3E, 0);  emit(0x32, 0x06, 0x11) # Score = 0

    # Draw Initial Food '*' (0x2A) with yellow color (0x61)
    CALL("DRAW_FOOD")

    # ==========================================
    # MAIN GAME LOOP
    # ==========================================
    L("GAME_LOOP")

    # 1. Frame Delay loop
    emit(0x01, 0x80, 0x18) # LD BC, 0x1880 (calibrated speed)
    # If Space (Boost) is held, delay is smaller
    emit(0x3A, 0x07, 0x11) # LD A, (0x1107) boost flag
    emit(0xB7)             # OR A
    JR('Z', "NORMAL_SPEED")
    emit(0x01, 0x40, 0x0C) # Half delay if boost
    L("NORMAL_SPEED")
    L("DELAY_LOOP")
    emit(0x0B)             # DEC BC
    emit(0x78)             # LD A, B
    emit(0xB1)             # OR C
    JR('NZ', "DELAY_LOOP")

    # 2. Input Polling via 8255 PPI
    # NOTE: The emulator boots with the rear DIP switch in MZ-700
    # compatibility mode. In that mode the MZ800 IORQ handler explicitly
    # does NOT route ports 0xD0-0xD3 to the PIO8255 (see mz800_iorq.c:
    # `if (!GDG_MZ800_DMD_TEST_MZ700) retval = pio8255_read(...)`) -- an
    # OUT/IN on those ports silently hits an unconnected floating bus.
    # In MZ-700 mode the *only* working path to the same PIO8255 chip is
    # its memory-mapped alias at 0xE000 (Port A / column select) and
    # 0xE001 (Port B / row read), so we must use LD (nn),A / LD A,(nn)
    # instead of OUT/IN.
    # Read Column 7 (Arrows)
    emit(0x3E, 0x07)       # LD A, 7 (Column 7)
    emit(0x32, 0x00, 0xE0) # LD (0xE000), A -- Port A (PIO 8255, MZ-700-mode memory alias)
    emit(0x3A, 0x01, 0xE0) # LD A, (0xE001) -- Port B (PIO 8255, MZ-700-mode memory alias)

    # Test UP (bit 5)
    emit(0xE6, 0x20)       # AND 0x20
    JR('NZ', "CHECK_DOWN")
    # UP Pressed: DX = 0, DY = -1
    emit(0xAF); emit(0x32, 0x02, 0x11)     # DX = 0
    emit(0x3E, 0xFF); emit(0x32, 0x03, 0x11) # DY = -1
    JP("INPUT_DONE")

    L("CHECK_DOWN")
    emit(0x3A, 0x01, 0xE0) # LD A, (0xE001)
    emit(0xE6, 0x10)       # AND 0x10 (Down = bit 4)
    JR('NZ', "CHECK_LEFT")
    # DOWN Pressed: DX = 0, DY = 1
    emit(0xAF); emit(0x32, 0x02, 0x11)     # DX = 0
    emit(0x3E, 1); emit(0x32, 0x03, 0x11)    # DY = 1
    JP("INPUT_DONE")

    L("CHECK_LEFT")
    emit(0x3A, 0x01, 0xE0) # LD A, (0xE001)
    emit(0xE6, 0x04)       # AND 0x04 (Left = bit 2)
    JR('NZ', "CHECK_RIGHT")
    # LEFT Pressed: DX = -1, DY = 0
    emit(0x3E, 0xFF); emit(0x32, 0x02, 0x11) # DX = -1
    emit(0xAF); emit(0x32, 0x03, 0x11)     # DY = 0
    JP("INPUT_DONE")

    L("CHECK_RIGHT")
    emit(0x3A, 0x01, 0xE0) # LD A, (0xE001)
    emit(0xE6, 0x08)       # AND 0x08 (Right = bit 3)
    JR('NZ', "CHECK_SPACE")
    # RIGHT Pressed: DX = 1, DY = 0
    emit(0x3E, 1); emit(0x32, 0x02, 0x11)    # DX = 1
    emit(0xAF); emit(0x32, 0x03, 0x11)     # DY = 0
    JP("INPUT_DONE")

    L("CHECK_SPACE")
    # Read Column 6 (Space)
    emit(0x3E, 0x06)       # LD A, 6
    emit(0x32, 0x00, 0xE0) # LD (0xE000), A -- Port A
    emit(0x3A, 0x01, 0xE0) # LD A, (0xE001) -- Port B
    emit(0xE6, 0x10)       # AND 0x10 (Space = bit 4)
    JR('NZ', "NO_BOOST")
    emit(0x3E, 1); emit(0x32, 0x07, 0x11) # Boost = 1
    JR(None, "INPUT_DONE")
    L("NO_BOOST")
    emit(0xAF); emit(0x32, 0x07, 0x11)    # Boost = 0

    L("INPUT_DONE")

    # 3. Erase old player position (draw dot trail 0x51 or space 0x00)
    CALL("GET_PLAYER_VRAM_ADDR") # returns HL = VRAM addr
    emit(0x36, 0x2E)             # LD (HL), '.' (leave runner trail)

    # 4. Update coordinates
    emit(0x3A, 0x00, 0x11) # LD A, (X)
    emit(0x21, 0x02, 0x11) # LD HL, DX
    emit(0x86)             # ADD A, (HL)
    emit(0x32, 0x00, 0x11) # LD (X), A

    emit(0x3A, 0x01, 0x11) # LD A, (Y)
    emit(0x21, 0x03, 0x11) # LD HL, DY
    emit(0x86)             # ADD A, (HL)
    emit(0x32, 0x01, 0x11) # LD (Y), A

    # 5. Collision checks
    # Check X bounds (1 <= X <= 38)
    emit(0x3A, 0x00, 0x11) # LD A, (X)
    emit(0xFE, 1)          # CP 1
    JR('C', "COLLISION")
    emit(0xFE, 39)         # CP 39
    JR('NC', "COLLISION")

    # Check Y bounds (4 <= Y <= 21)
    emit(0x3A, 0x01, 0x11) # LD A, (Y)
    emit(0xFE, 4)          # CP 4
    JR('C', "COLLISION")
    emit(0xFE, 22)         # CP 22
    JR('NC', "COLLISION")

    # Check if hit Food: FoodX == X and FoodY == Y
    emit(0x3A, 0x00, 0x11) # LD A, (X)
    emit(0x21, 0x04, 0x11) # LD HL, FoodX
    emit(0xBE)             # CP (HL)
    JR('NZ', "DRAW_NEW_PLAYER")
    emit(0x3A, 0x01, 0x11) # LD A, (Y)
    emit(0x21, 0x05, 0x11) # LD HL, FoodY
    emit(0xBE)             # CP (HL)
    JR('NZ', "DRAW_NEW_PLAYER")

    # Hit food!
    CALL("BEEP_HIGH")
    # Increment score
    emit(0x3A, 0x06, 0x11) # LD A, (Score)
    emit(0x3C)             # INC A
    emit(0x32, 0x06, 0x11) # LD (Score), A
    CALL("DRAW_SCORE")

    # Pick new food coordinates (semi-random from cycle counters)
    emit(0xED, 0x5F)       # LD A, R (refresh register for pseudo-random)
    emit(0xE6, 0x1F)       # AND 31
    emit(0xC6, 0x04)       # ADD 4 -> 4..35
    emit(0x32, 0x04, 0x11) # New FoodX

    emit(0xED, 0x5F)       # LD A, R
    emit(0xE6, 0x0F)       # AND 15
    emit(0xC6, 0x05)       # ADD 5 -> 5..20
    emit(0x32, 0x05, 0x11) # New FoodY
    CALL("DRAW_FOOD")

    L("DRAW_NEW_PLAYER")
    # Draw player '@' (0x40 or 0x5C) at new location
    CALL("GET_PLAYER_VRAM_ADDR")
    emit(0x36, 0x4F)       # LD (HL), 0x4F (Circle hero)

    # Set player color to bright yellow (0x74)
    # Color VRAM is HL + 0x0800
    emit(0x11, 0x00, 0x08) # LD DE, 0x0800
    emit(0x19)             # ADD HL, DE
    emit(0x36, 0x74)       # LD (HL), 0x74 (Yellow on Blue)

    JP("GAME_LOOP")

    # ==========================================
    # COLLISION / CRASH HANDLER
    # ==========================================
    L("COLLISION")
    CALL("BEEP_LOW")

    # Reset position to center (20, 12)
    emit(0x3E, 20); emit(0x32, 0x00, 0x11)
    emit(0x3E, 12); emit(0x32, 0x01, 0x11)
    emit(0x3E, 1);  emit(0x32, 0x02, 0x11)
    emit(0x3E, 0);  emit(0x32, 0x03, 0x11)

    # Clear playfield inner area
    emit(0x06, 18)         # 18 rows
    emit(0x21, 0xA1, 0xD0) # Row 4, col 1
    L("CLEAR_ROW_LOOP")
    emit(0x0E, 38)         # 38 columns
    L("CLEAR_COL_LOOP")
    emit(0x36, 0x00)       # LD (HL), 0x00 (space)
    emit(0x23)             # INC HL
    emit(0x0D)             # DEC C
    JR('NZ', "CLEAR_COL_LOOP")
    emit(0x23); emit(0x23) # Skip 2 border chars to next row
    emit(0x10, 0xF4)       # DJNZ CLEAR_ROW_LOOP (was 0xF3: off-by-one landed
                            # 1 byte before the label, on the trailing 0xD0
                            # byte of the preceding LD HL,nn -- misdecoded as
                            # a stray RET NC that could corrupt control flow)

    CALL("DRAW_FOOD")
    JP("GAME_LOOP")

    # ==========================================
    # HELPER SUBROUTINES
    # ==========================================

    # Subroutine: GET_PLAYER_VRAM_ADDR
    # Computes HL = 0xD000 + Y * 40 + X
    L("GET_PLAYER_VRAM_ADDR")
    emit(0x3A, 0x01, 0x11) # LD A, (Y)
    emit(0x6F); emit(0x26, 0x00) # LD L, A; LD H, 0 (HL = Y)
    # Multiply by 40: HL * 40 = ((Y * 4) + Y) * 8
    emit(0x54); emit(0x5D) # LD D, H; LD E, L (DE = Y)
    emit(0x29)             # ADD HL, HL (Y * 2)
    emit(0x29)             # ADD HL, HL (Y * 4)
    emit(0x19)             # ADD HL, DE (Y * 5)
    emit(0x29)             # ADD HL, HL (Y * 10)
    emit(0x29)             # ADD HL, HL (Y * 20)
    emit(0x29)             # ADD HL, HL (Y * 40)
    # Add X
    emit(0x3A, 0x00, 0x11) # LD A, (X)
    emit(0x5F); emit(0x16, 0x00) # LD E, A; LD D, 0
    emit(0x19)             # ADD HL, DE
    # Add 0xD000 (VRAM Text Base)
    emit(0x11, 0x00, 0xD0) # LD DE, 0xD000
    emit(0x19)             # ADD HL, DE
    emit(0xC9)             # RET

    # Subroutine: DRAW_FOOD
    L("DRAW_FOOD")
    # HL = 0xD000 + FoodY * 40 + FoodX
    emit(0x3A, 0x05, 0x11) # LD A, (FoodY)
    emit(0x6F); emit(0x26, 0x00) # LD L, A; LD H, 0
    emit(0x54); emit(0x5D) # LD D, H; LD E, L (DE = FoodY)
    emit(0x29)             # ADD HL, HL (* 2)
    emit(0x29)             # ADD HL, HL (* 4)
    emit(0x19)             # ADD HL, DE (* 5)
    emit(0x29)             # ADD HL, HL (* 10)
    emit(0x29)             # ADD HL, HL (* 20)
    emit(0x29)             # ADD HL, HL (* 40)
    emit(0x3A, 0x04, 0x11) # FoodX
    emit(0x5F); emit(0x16, 0x00)
    emit(0x19)
    emit(0x11, 0x00, 0xD0)
    emit(0x19)
    emit(0x36, 0x2A)       # LD (HL), '*' (character code 0x2A)
    # Color Yellow / Red:
    emit(0x11, 0x00, 0x08)
    emit(0x19)
    emit(0x36, 0x76)       # LD (HL), 0x76 (Yellow / Red)
    emit(0xC9)

    # Subroutine: DRAW_SCORE
    L("DRAW_SCORE")
    # Print score number at 0xD050 (row 2, col 16)
    emit(0x21, 0x58, 0xD0) # LD HL, 0xD058
    # "SCORE: "
    emit(0x36, 0x13); emit(0x23) # S
    emit(0x36, 0x03); emit(0x23) # C
    emit(0x36, 0x0F); emit(0x23) # O
    emit(0x36, 0x12); emit(0x23) # R
    emit(0x36, 0x05); emit(0x23) # E
    emit(0x36, 0x5A); emit(0x23) # :
    # Score digits: Score in A
    emit(0x3A, 0x06, 0x11) # LD A, (Score)
    # tens = A / 10, ones = A % 10
    emit(0x06, 0x00)       # LD B, 0 (tens)
    L("DIV10_LOOP")
    emit(0xFE, 10)         # CP 10
    JR('C', "DIV10_DONE")
    emit(0xD6, 10)         # SUB 10
    emit(0x04)             # INC B
    JR(None, "DIV10_LOOP")
    L("DIV10_DONE")
    # B = tens, A = ones
    # Convert tens to MZ ASCII digit ('0' = 0x20, '1' = 0x21)
    emit(0x4F)             # LD C, A (save ones in C)
    emit(0x78)             # LD A, B (tens)
    emit(0xC6, 0x20)       # ADD 0x20
    emit(0x77); emit(0x23) # LD (HL), A; INC HL
    emit(0x79)             # LD A, C (ones)
    emit(0xC6, 0x20)       # ADD 0x20
    emit(0x77)             # LD (HL), A
    emit(0xC9)

    # Subroutine: BEEP_HIGH (pleasant ding)
    # Port C is likewise unreachable via OUT (0xD2) in MZ-700 mode; use its
    # memory-mapped alias at 0xE002 instead (see input-polling note above).
    L("BEEP_HIGH")
    emit(0x06, 0x30)       # LD B, 48 pulses
    L("BEEP_H_LOOP")
    emit(0x3E, 0x01)       # Toggle bit 0 of Port C
    emit(0x32, 0x02, 0xE0) # LD (0xE002), A
    emit(0x0E, 0x40)       # Delay
    L("BEEP_H_D1")
    emit(0x0D); JR('NZ', "BEEP_H_D1")
    emit(0x3E, 0x00)
    emit(0x32, 0x02, 0xE0) # LD (0xE002), A
    emit(0x0E, 0x40)
    L("BEEP_H_D2")
    emit(0x0D); JR('NZ', "BEEP_H_D2")
    emit(0x10, 0xEA)       # DJNZ BEEP_H_LOOP (recomputed: +1 byte per LD vs OUT, x2)
    emit(0xC9)

    # Subroutine: BEEP_LOW (crash crunch)
    L("BEEP_LOW")
    emit(0x06, 0x20)       # LD B, 32 pulses
    L("BEEP_L_LOOP")
    emit(0x3E, 0x01)
    emit(0x32, 0x02, 0xE0) # LD (0xE002), A
    emit(0x0E, 0xC0)       # Longer delay
    L("BEEP_L_D1")
    emit(0x0D); JR('NZ', "BEEP_L_D1")
    emit(0x3E, 0x00)
    emit(0x32, 0x02, 0xE0) # LD (0xE002), A
    emit(0x0E, 0xC0)
    L("BEEP_L_D2")
    emit(0x0D); JR('NZ', "BEEP_L_D2")
    emit(0x10, 0xEA)       # DJNZ BEEP_L_LOOP (recomputed)
    emit(0xC9)

    # Resolve fixups
    for pos, target_label, mode in fixups:
        target_addr = label_locs[target_label]
        if mode == 'abs':
            code[pos] = target_addr & 0xFF
            code[pos + 1] = (target_addr >> 8) & 0xFF
        elif mode == 'rel':
            # Relative offset from instruction after JR (pos + 1)
            offset = target_addr - (pos + 1 + LOAD_ADDR)
            if not (-128 <= offset <= 127):
                raise ValueError(f"Relative jump to {target_label} out of range: {offset}")
            code[pos] = offset & 0xFF

    # ==========================================
    # Build 128-byte MZF Header
    # ==========================================
    # Format:
    # 0x00: ftype = 0x01 (OBJ)
    # 0x01..0x11: filename (16 bytes) + 0x0D terminator
    # 0x12..0x13: fsize (uint16_t)
    # 0x14..0x15: fstrt (uint16_t = 0x1200)
    # 0x16..0x17: fexec (uint16_t = 0x1200)
    # 0x18..0x7F: comment (104 bytes)
    header = bytearray(128)
    header[0] = 0x01 # MZF_FTYPE_OBJ

    game_name = b"MZ-RUNNER\x0D"
    header[1:1 + len(game_name)] = game_name

    body_size = len(code)
    struct.pack_into("<HHH", header, 0x12, body_size, LOAD_ADDR, LOAD_ADDR)

    comment = b"SHARP MZ-800 ARCADE WASM DEMO GAME (C) 2026"
    header[0x18:0x18 + len(comment)] = comment

    # Write output
    full_mzf = header + code
    with open(output_path, "wb") as f:
        f.write(full_mzf)

    print(f"Successfully created '{output_path}': Header=128B, Body={body_size}B, Total={len(full_mzf)}B")

if __name__ == "__main__":
    build_game_mzf("web/games/mz_runner.mzf")
