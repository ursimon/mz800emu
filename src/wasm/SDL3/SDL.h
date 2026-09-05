#ifndef FAKE_SDL3_SDL_H
#define FAKE_SDL3_SDL_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

typedef uint8_t Uint8;
typedef uint16_t Uint16;
typedef uint32_t Uint32;
typedef uint64_t Uint64;
typedef int8_t Sint8;
typedef int16_t Sint16;
typedef int32_t Sint32;
typedef int64_t Sint64;

typedef uint32_t SDL_Keycode;
typedef uint16_t SDL_Keymod;
typedef uint32_t SDL_JoystickID;
typedef uint32_t SDL_WindowID;
typedef uint32_t SDL_PropertiesID;
typedef void *SDL_GLContext;

#define SDL_EVENT_USER 0x8000

typedef struct SDL_Event {
    Uint32 type;
} SDL_Event;

typedef struct SDL_Window SDL_Window;
typedef struct SDL_Renderer SDL_Renderer;
typedef struct SDL_Surface SDL_Surface;
typedef struct SDL_Palette SDL_Palette;
typedef struct SDL_Joystick SDL_Joystick;
typedef struct SDL_Gamepad SDL_Gamepad;
typedef struct SDL_Color {
    Uint8 r, g, b, a;
} SDL_Color;

#endif
