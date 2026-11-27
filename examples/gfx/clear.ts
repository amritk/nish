// The clear screen (WP89 S4): std/gpu/sys.ts's raw bindings of the nish-gfx
// shim open a window, clear it to a colour that changes each frame, and exit
// after FRAMES frames. With --offscreen it draws into a target with no window
// and reads each frame back, printing the first pixel and how many pixels
// match it, which is what tests/gfx.js compares with the expected colour.
//   NISH_GFX_PREFIX=build/gfx/linux-x86_64 nish examples/gfx/clear.ts --link build/clear
//   ./build/clear --offscreen
// It answers 77 when no GPU adapter answers, as tests/gfx/triangle.c does.
// smoke: skip links SDL3 and wgpu-native, which the examples job does not install; tests/gfx.js runs it
import {
  NISHGFX_ERROR_NONE,
  NishGfxAdapter,
  NishGfxDevice,
  NishGfxEncoder,
  NishGfxPass,
  NishGfxSurface,
  NishGfxView,
  NishGfxWindow,
  nishgfx_adapter_release,
  nishgfx_adapter_request,
  nishgfx_device_release,
  nishgfx_device_request,
  nishgfx_encoder_create,
  nishgfx_encoder_submit,
  nishgfx_error_next,
  nishgfx_events_poll,
  nishgfx_instance_create,
  nishgfx_instance_error_next,
  nishgfx_instance_release,
  nishgfx_offscreen_create,
  nishgfx_offscreen_read,
  nishgfx_offscreen_release,
  nishgfx_offscreen_view,
  nishgfx_pass_begin,
  nishgfx_pass_end,
  nishgfx_surface_acquire,
  nishgfx_surface_configure,
  nishgfx_surface_create,
  nishgfx_surface_present,
  nishgfx_surface_release,
  nishgfx_window_create,
  nishgfx_window_release,
} from "nish/gpu/sys"

const WIDTH: number = 16
const HEIGHT: number = 16
const FRAMES: number = 6

/** The bytes an error message is drained into: NISHGFX_ERROR_MESSAGE_MAX and its NUL. */
const MESSAGE_CAP: number = 256

/** The bytes one WIDTH x HEIGHT frame reads back into, 4 a pixel. */
const FRAME_BYTES: number = 1024

/**
 * Frame `frame`'s clear colour: red rises and green falls by a fifth a frame,
 * steps whose unorm bytes (0, 51, 102, ...) round exactly.
 */
const red = (frame: number): f64 => toF64(frame) * 0.2
const green = (frame: number): f64 => toF64(5 - frame) * 0.2

/** The text of a NUL-terminated message the shim drained into `msg`. */
const messageOf = (msg: u8[]): string => {
  let end = 0
  while (end < msg.length && msg[end] !== 0) {
    end++
  }
  return end <= msg.length ? String.fromBytes(msg, 0, end) : ""
}

/** The first RGBA pixel of `pixels`, and whether every other pixel is the same. */
const describe = (pixels: u8[]): string => {
  if (pixels.length < 4) {
    return "no pixels"
  }
  let uniform = true
  for (let i = 4; i < pixels.length; i++) {
    if (pixels[i] !== pixels[i % 4]) {
      uniform = false
    }
  }
  const rgba = `${pixels[0]},${pixels[1]},${pixels[2]},${pixels[3]}`
  return uniform ? `${rgba} on every pixel` : `${rgba}, not on every pixel`
}

// A handle is a C pointer, which only a local may hold, so main keeps every
// one of them and the helpers above see only numbers and bytes.
export const main = (): number => {
  const args = process.argv
  const offscreen = args.length > 1 && args[1] === "--offscreen"
  const instance = nishgfx_instance_create()
  if (instance === null) {
    console.error("clear: no instance")
    return 1
  }
  const window: NishGfxWindow | null = offscreen ? null : nishgfx_window_create("clear", toU32(WIDTH * 32), toU32(HEIGHT * 32))
  const surface: NishGfxSurface | null = window === null ? null : nishgfx_surface_create(instance, window)
  const adapter: NishGfxAdapter | null = offscreen
    ? nishgfx_adapter_request(instance, null, 0)
    : surface !== null
      ? nishgfx_adapter_request(instance, surface, 0)
      : null
  const device: NishGfxDevice | null = adapter === null ? null : nishgfx_device_request(instance, adapter)
  const msg = new Array<u8>(MESSAGE_CAP)
  let status = 0
  if (!offscreen && surface === null) {
    console.error(window === null ? "clear: no window" : "clear: no surface for the window (try --offscreen)")
    status = 1
  } else if (adapter === null || device === null) {
    nishgfx_instance_error_next(instance, msg, toU64(msg.length))
    console.log(`no adapter: ${messageOf(msg)}`)
    status = 77
  } else if (offscreen) {
    // Each frame is read back: the first pixel, and how many pixels match it.
    const target = nishgfx_offscreen_create(device, toU32(WIDTH), toU32(HEIGHT))
    const view: NishGfxView | null = target === null ? null : nishgfx_offscreen_view(target)
    const pixels = new Array<u8>(FRAME_BYTES)
    for (let frame = 0; frame < FRAMES && status === 0; frame++) {
      const encoder = nishgfx_encoder_create(device)
      // Load 0 clears the view to the colour rather than keeping its contents.
      const pass: NishGfxPass | null =
        encoder === null || view === null
          ? null
          : nishgfx_pass_begin(encoder, view, 0, red(frame), green(frame), 0.0, 1.0)
      if (pass !== null) {
        nishgfx_pass_end(pass)
      }
      if (encoder !== null) {
        nishgfx_encoder_submit(device, encoder)
      }
      if (pass === null || target === null || nishgfx_offscreen_read(target, pixels, toU64(pixels.length)) !== 0) {
        console.error(`clear: frame ${frame} was not drawn and read back`)
        status = 1
      } else {
        console.log(`frame ${frame}: ${describe(pixels)}`)
      }
    }
    if (target !== null) {
      nishgfx_offscreen_release(target)
    }
  } else if (
    surface !== null &&
    window !== null &&
    nishgfx_surface_configure(surface, adapter, device, toU32(WIDTH * 32), toU32(HEIGHT * 32), 1) === 0
  ) {
    for (let frame = 0; frame < FRAMES; frame++) {
      // Events are queued and counted but not read: nishgfx_event_next takes
      // a fielded class, which std/gpu/sys.ts keeps to itself.
      nishgfx_events_poll(window)
      const view = nishgfx_surface_acquire(surface)
      const encoder: NishGfxEncoder | null = view === null ? null : nishgfx_encoder_create(device)
      const pass: NishGfxPass | null =
        encoder === null || view === null
          ? null
          : nishgfx_pass_begin(encoder, view, 0, red(frame), green(frame), 0.0, 1.0)
      if (pass !== null) {
        nishgfx_pass_end(pass)
      }
      if (encoder !== null) {
        nishgfx_encoder_submit(device, encoder)
        nishgfx_surface_present(surface)
      }
    }
    console.log(`presented ${FRAMES} frames`)
  } else {
    console.error("clear: the surface was not configured")
    status = 1
  }
  if (device !== null) {
    let kind = nishgfx_error_next(device, msg, toU64(msg.length))
    while (kind !== NISHGFX_ERROR_NONE) {
      console.error(`clear: device error ${kind}: ${messageOf(msg)}`)
      status = 1
      kind = nishgfx_error_next(device, msg, toU64(msg.length))
    }
    nishgfx_device_release(device)
  }
  if (adapter !== null) {
    nishgfx_adapter_release(adapter)
  }
  if (surface !== null) {
    nishgfx_surface_release(surface)
  }
  if (window !== null) {
    nishgfx_window_release(window)
  }
  nishgfx_instance_release(instance)
  return status
}
