/*
 * nish-gfx.c: the shim nish-gfx.h declares, over wgpu-native and SDL3.
 *
 * Every WebGPU request that answers through a callback is made synchronous
 * here: the callback runs in WGPUCallbackMode_AllowProcessEvents mode and
 * writes into a struct on the caller's stack, and a bounded loop of
 * wgpuInstanceProcessEvents() waits for it. The shim never calls
 * wgpuInstanceWaitAny() and never waits on a clock. Buffer readback maps with
 * wgpuBufferMapAsync() and blocks in wgpuDevicePoll(wait = true), which
 * returns once the queue is idle.
 *
 * Errors are copied, never handed to Nish code as they happen: the
 * device-lost and uncaptured-error callbacks (always installed) and the
 * shim's own failures put the kind and at most NISHGFX_ERROR_MESSAGE_MAX
 * bytes of the message into a fixed ring of NISHGFX_ERROR_RING entries under
 * the ring's mutex. A report that finds the ring full is counted, not kept.
 */
#include "nish-gfx.h"

#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <SDL3/SDL.h>
#include <webgpu/webgpu.h>
#include <webgpu/wgpu.h>

/* How many wgpuInstanceProcessEvents() rounds an adapter or device request
 * gets before it is given up as never answered. wgpu-native answers both
 * within the first round on every backend it has. */
#define NISHGFX_PROCESS_ROUNDS 1000

#define NISHGFX_MAX_ATTRIBUTES 16
#define NISHGFX_MAX_BINDINGS 16

/* ---- the error ring ---------------------------------------------------- */

typedef struct NishGfxError {
  int32_t kind;
  char message[NISHGFX_ERROR_MESSAGE_MAX + 1];
} NishGfxError;

typedef struct NishGfxRing {
  pthread_mutex_t lock;
  NishGfxError entries[NISHGFX_ERROR_RING];
  uint32_t head;  /* the oldest entry */
  uint32_t count; /* entries queued */
  uint32_t dropped;
} NishGfxRing;

static void ring_init(NishGfxRing *ring) {
  memset(ring, 0, sizeof *ring);
  pthread_mutex_init(&ring->lock, NULL);
}

static void ring_destroy(NishGfxRing *ring) { pthread_mutex_destroy(&ring->lock); }

/* Queue one report. `len` may be WGPU_STRLEN for a NUL-terminated message;
 * the copy keeps at most NISHGFX_ERROR_MESSAGE_MAX bytes and always ends in
 * a NUL. */
static void ring_push(NishGfxRing *ring, int32_t kind, const char *msg, size_t len) {
  if (msg == NULL) len = 0;
  else if (len == WGPU_STRLEN) len = strlen(msg);
  if (len > NISHGFX_ERROR_MESSAGE_MAX) len = NISHGFX_ERROR_MESSAGE_MAX;
  pthread_mutex_lock(&ring->lock);
  if (ring->count == NISHGFX_ERROR_RING) {
    if (ring->dropped != UINT32_MAX) ring->dropped++;
  } else {
    NishGfxError *e = &ring->entries[(ring->head + ring->count) % NISHGFX_ERROR_RING];
    e->kind = kind;
    if (len > 0) memcpy(e->message, msg, len);
    e->message[len] = '\0';
    ring->count++;
  }
  pthread_mutex_unlock(&ring->lock);
}

static int32_t ring_pop(NishGfxRing *ring, void *msg, size_t cap) {
  int32_t kind = NISHGFX_ERROR_NONE;
  pthread_mutex_lock(&ring->lock);
  if (ring->count > 0) {
    NishGfxError *e = &ring->entries[ring->head];
    kind = e->kind;
    if (msg != NULL && cap > 0) {
      size_t len = strlen(e->message);
      if (len > cap - 1) len = cap - 1;
      memcpy(msg, e->message, len);
      ((char *)msg)[len] = '\0';
    }
    ring->head = (ring->head + 1) % NISHGFX_ERROR_RING;
    ring->count--;
  }
  pthread_mutex_unlock(&ring->lock);
  return kind;
}

/* ---- the handles ------------------------------------------------------- */

struct NishGfxInstance {
  WGPUInstance instance;
  NishGfxRing errors;
};

struct NishGfxWindow {
  SDL_Window *window;
  NishGfxEvent events[NISHGFX_EVENT_RING];
  uint32_t head, count, dropped;
};

struct NishGfxSurface {
  NishGfxInstance *instance;
  SDL_MetalView metal_view;
  WGPUSurface surface;
  WGPUSurfaceConfiguration config;
  WGPUDevice device; /* the device configure saw, for its error ring */
  NishGfxDevice *owner;
  WGPUTexture texture;
  NishGfxView *view;
};

struct NishGfxAdapter {
  WGPUAdapter adapter;
};

struct NishGfxDevice {
  NishGfxInstance *instance;
  WGPUDevice device;
  WGPUQueue queue;
  NishGfxRing errors;
  uint32_t max_side; /* the device's maxTextureDimension2D, at most 16384 */
};

struct NishGfxBuffer {
  WGPUBuffer buffer;
};

struct NishGfxShader {
  WGPUShaderModule module;
};

struct NishGfxPipelineDesc {
  WGPUShaderModule module;
  char *vs_entry, *fs_entry;
  WGPUTextureFormat color_format;
  uint64_t stride;
  size_t attribute_count;
  WGPUVertexAttribute attributes[NISHGFX_MAX_ATTRIBUTES];
};

struct NishGfxPipeline {
  WGPURenderPipeline pipeline;
};

struct NishGfxBindGroupDesc {
  WGPUBindGroupLayout layout;
  size_t entry_count;
  WGPUBindGroupEntry entries[NISHGFX_MAX_BINDINGS];
};

struct NishGfxBindGroup {
  WGPUBindGroup group;
};

struct NishGfxEncoder {
  WGPUCommandEncoder encoder;
};

struct NishGfxPass {
  WGPURenderPassEncoder pass;
};

struct NishGfxView {
  WGPUTextureView view;
};

struct NishGfxOffscreen {
  NishGfxDevice *device;
  uint32_t width, height;
  uint32_t padded_row; /* bytesPerRow, width * 4 rounded up to 256 */
  WGPUTexture texture;
  NishGfxView view;
  WGPUBuffer readback;
};

static WGPUStringView string_view(const char *s) {
  WGPUStringView v = WGPU_STRING_VIEW_INIT;
  if (s != NULL) {
    v.data = s;
    v.length = strlen(s);
  }
  return v;
}

static char *copy_string(const char *s) {
  if (s == NULL) return NULL;
  size_t n = strlen(s) + 1;
  char *out = malloc(n);
  if (out != NULL) memcpy(out, s, n);
  return out;
}

/* ---- instance ---------------------------------------------------------- */

NishGfxInstance *nishgfx_instance_create(void) {
  NishGfxInstance *inst = calloc(1, sizeof *inst);
  if (inst == NULL) return NULL;
  inst->instance = wgpuCreateInstance(NULL);
  if (inst->instance == NULL) {
    free(inst);
    return NULL;
  }
  ring_init(&inst->errors);
  return inst;
}

void nishgfx_instance_release(NishGfxInstance *inst) {
  if (inst == NULL) return;
  wgpuInstanceRelease(inst->instance);
  ring_destroy(&inst->errors);
  free(inst);
}

int32_t nishgfx_instance_error_next(NishGfxInstance *inst, void *msg, size_t cap) {
  return inst == NULL ? NISHGFX_ERROR_NONE : ring_pop(&inst->errors, msg, cap);
}

/* ---- window and events ------------------------------------------------- */

NishGfxWindow *nishgfx_window_create(const char *title, uint32_t width, uint32_t height) {
  if (width == 0 || height == 0 || width > INT32_MAX || height > INT32_MAX) return NULL;
  if (!SDL_InitSubSystem(SDL_INIT_VIDEO)) return NULL;
  NishGfxWindow *w = calloc(1, sizeof *w);
  if (w == NULL) {
    SDL_QuitSubSystem(SDL_INIT_VIDEO);
    return NULL;
  }
  SDL_WindowFlags flags = SDL_WINDOW_RESIZABLE;
#ifdef __APPLE__
  /* Only cocoa makes Metal views: SDL refuses a METAL window under any other
   * driver (the offscreen one included) instead of ignoring the flag. */
  const char *driver = SDL_GetCurrentVideoDriver();
  if (driver != NULL && strcmp(driver, "cocoa") == 0) flags |= SDL_WINDOW_METAL;
#endif
  w->window = SDL_CreateWindow(title != NULL ? title : "", (int)width, (int)height, flags);
  if (w->window == NULL) {
    free(w);
    SDL_QuitSubSystem(SDL_INIT_VIDEO);
    return NULL;
  }
  return w;
}

void nishgfx_window_release(NishGfxWindow *w) {
  if (w == NULL) return;
  SDL_DestroyWindow(w->window);
  free(w);
  SDL_QuitSubSystem(SDL_INIT_VIDEO);
}

static void event_push(NishGfxWindow *w, const NishGfxEvent *e) {
  if (w->count == NISHGFX_EVENT_RING) {
    if (w->dropped != UINT32_MAX) w->dropped++;
    return;
  }
  w->events[(w->head + w->count) % NISHGFX_EVENT_RING] = *e;
  w->count++;
}

uint32_t nishgfx_events_poll(NishGfxWindow *w) {
  if (w == NULL) return 0;
  uint32_t queued = 0;
  SDL_Event ev;
  while (SDL_PollEvent(&ev)) {
    NishGfxEvent e;
    memset(&e, 0, sizeof e);
    switch (ev.type) {
    case SDL_EVENT_QUIT:
    case SDL_EVENT_WINDOW_CLOSE_REQUESTED:
      e.kind = NISHGFX_EVENT_QUIT;
      break;
    case SDL_EVENT_KEY_DOWN:
    case SDL_EVENT_KEY_UP:
      e.kind = ev.type == SDL_EVENT_KEY_DOWN ? NISHGFX_EVENT_KEY_DOWN : NISHGFX_EVENT_KEY_UP;
      e.key = ev.key.key;
      e.modifiers = ev.key.mod;
      break;
    case SDL_EVENT_MOUSE_MOTION:
      e.kind = NISHGFX_EVENT_MOUSE_MOVE;
      e.x = ev.motion.x;
      e.y = ev.motion.y;
      e.dx = ev.motion.xrel;
      e.dy = ev.motion.yrel;
      break;
    case SDL_EVENT_MOUSE_BUTTON_DOWN:
    case SDL_EVENT_MOUSE_BUTTON_UP:
      e.kind = ev.type == SDL_EVENT_MOUSE_BUTTON_DOWN ? NISHGFX_EVENT_MOUSE_DOWN : NISHGFX_EVENT_MOUSE_UP;
      e.button = ev.button.button;
      e.x = ev.button.x;
      e.y = ev.button.y;
      break;
    case SDL_EVENT_MOUSE_WHEEL:
      e.kind = NISHGFX_EVENT_WHEEL;
      e.x = ev.wheel.mouse_x;
      e.y = ev.wheel.mouse_y;
      e.dx = ev.wheel.x;
      e.dy = ev.wheel.y;
      break;
    case SDL_EVENT_WINDOW_PIXEL_SIZE_CHANGED:
      e.kind = NISHGFX_EVENT_RESIZED;
      e.width = ev.window.data1 > 0 ? (uint32_t)ev.window.data1 : 0;
      e.height = ev.window.data2 > 0 ? (uint32_t)ev.window.data2 : 0;
      break;
    default:
      continue;
    }
    event_push(w, &e);
    queued++;
  }
  return queued;
}

uint32_t nishgfx_event_next(NishGfxWindow *w, NishGfxEvent *out) {
  if (w == NULL || out == NULL) return NISHGFX_EVENT_NONE;
  if (w->count == 0) {
    memset(out, 0, sizeof *out);
    return NISHGFX_EVENT_NONE;
  }
  *out = w->events[w->head];
  w->head = (w->head + 1) % NISHGFX_EVENT_RING;
  w->count--;
  return out->kind;
}

uint32_t nishgfx_events_dropped(NishGfxWindow *w) { return w == NULL ? 0 : w->dropped; }

/* ---- surface ----------------------------------------------------------- */

NishGfxSurface *nishgfx_surface_create(NishGfxInstance *inst, NishGfxWindow *w) {
  if (inst == NULL || w == NULL) return NULL;
  NishGfxSurface *s = calloc(1, sizeof *s);
  if (s == NULL) return NULL;
  s->instance = inst;
  WGPUSurfaceDescriptor desc = WGPU_SURFACE_DESCRIPTOR_INIT;
  const char *driver = SDL_GetCurrentVideoDriver();
  if (driver == NULL) driver = "";
#ifdef __APPLE__
  WGPUSurfaceSourceMetalLayer metal = WGPU_SURFACE_SOURCE_METAL_LAYER_INIT;
  if (strcmp(driver, "cocoa") == 0) {
    s->metal_view = SDL_Metal_CreateView(w->window);
    metal.layer = s->metal_view != NULL ? SDL_Metal_GetLayer(s->metal_view) : NULL;
    if (metal.layer != NULL) desc.nextInChain = &metal.chain;
  }
#else
  SDL_PropertiesID props = SDL_GetWindowProperties(w->window);
  WGPUSurfaceSourceWaylandSurface wayland = WGPU_SURFACE_SOURCE_WAYLAND_SURFACE_INIT;
  WGPUSurfaceSourceXlibWindow xlib = WGPU_SURFACE_SOURCE_XLIB_WINDOW_INIT;
  if (strcmp(driver, "wayland") == 0) {
    wayland.display = SDL_GetPointerProperty(props, SDL_PROP_WINDOW_WAYLAND_DISPLAY_POINTER, NULL);
    wayland.surface = SDL_GetPointerProperty(props, SDL_PROP_WINDOW_WAYLAND_SURFACE_POINTER, NULL);
    if (wayland.display != NULL && wayland.surface != NULL) desc.nextInChain = &wayland.chain;
  } else if (strcmp(driver, "x11") == 0) {
    xlib.display = SDL_GetPointerProperty(props, SDL_PROP_WINDOW_X11_DISPLAY_POINTER, NULL);
    xlib.window = (uint64_t)SDL_GetNumberProperty(props, SDL_PROP_WINDOW_X11_WINDOW_NUMBER, 0);
    if (xlib.display != NULL && xlib.window != 0) desc.nextInChain = &xlib.chain;
  }
#endif
  if (desc.nextInChain == NULL) {
    char why[NISHGFX_ERROR_MESSAGE_MAX + 1];
    snprintf(why, sizeof why, "no WebGPU surface for SDL video driver \"%s\"", driver);
    ring_push(&inst->errors, NISHGFX_ERROR_INTERNAL, why, WGPU_STRLEN);
    nishgfx_surface_release(s);
    return NULL;
  }
  s->surface = wgpuInstanceCreateSurface(inst->instance, &desc);
  if (s->surface == NULL) {
    ring_push(&inst->errors, NISHGFX_ERROR_INTERNAL, "wgpuInstanceCreateSurface answered null", WGPU_STRLEN);
    nishgfx_surface_release(s);
    return NULL;
  }
  return s;
}

static void surface_drop_frame(NishGfxSurface *s) {
  if (s->view != NULL) {
    wgpuTextureViewRelease(s->view->view);
    free(s->view);
    s->view = NULL;
  }
  if (s->texture != NULL) {
    wgpuTextureRelease(s->texture);
    s->texture = NULL;
  }
}

void nishgfx_surface_release(NishGfxSurface *s) {
  if (s == NULL) return;
  surface_drop_frame(s);
  if (s->surface != NULL) {
    if (s->config.device != NULL) wgpuSurfaceUnconfigure(s->surface);
    wgpuSurfaceRelease(s->surface);
  }
#ifdef __APPLE__
  if (s->metal_view != NULL) SDL_Metal_DestroyView(s->metal_view);
#endif
  free(s);
}

static int has_mode(const WGPUSurfaceCapabilities *caps, WGPUPresentMode mode) {
  for (size_t i = 0; i < caps->presentModeCount; i++)
    if (caps->presentModes[i] == mode) return 1;
  return 0;
}

int32_t nishgfx_surface_configure(NishGfxSurface *s, NishGfxAdapter *adapter, NishGfxDevice *device,
                                  uint32_t width, uint32_t height, uint32_t vsync) {
  if (s == NULL || adapter == NULL || device == NULL) return -1;
  WGPUSurfaceCapabilities caps = WGPU_SURFACE_CAPABILITIES_INIT;
  if (wgpuSurfaceGetCapabilities(s->surface, adapter->adapter, &caps) != WGPUStatus_Success ||
      caps.formatCount == 0) {
    wgpuSurfaceCapabilitiesFreeMembers(caps);
    ring_push(&device->errors, NISHGFX_ERROR_INTERNAL, "the surface offers no texture format", WGPU_STRLEN);
    return -1;
  }
  WGPUPresentMode mode = WGPUPresentMode_Fifo;
  if (!vsync) {
    if (has_mode(&caps, WGPUPresentMode_Mailbox)) mode = WGPUPresentMode_Mailbox;
    else if (has_mode(&caps, WGPUPresentMode_Immediate)) mode = WGPUPresentMode_Immediate;
  }
  WGPUSurfaceConfiguration config = WGPU_SURFACE_CONFIGURATION_INIT;
  config.device = device->device;
  config.format = caps.formats[0];
  config.usage = WGPUTextureUsage_RenderAttachment;
  config.width = width;
  config.height = height;
  config.alphaMode = caps.alphaModeCount > 0 ? caps.alphaModes[0] : WGPUCompositeAlphaMode_Auto;
  config.presentMode = mode;
  wgpuSurfaceCapabilitiesFreeMembers(caps);
  surface_drop_frame(s);
  wgpuSurfaceConfigure(s->surface, &config);
  s->config = config;
  s->owner = device;
  return 0;
}

uint32_t nishgfx_surface_format(NishGfxSurface *s) { return s == NULL ? 0 : (uint32_t)s->config.format; }

NishGfxView *nishgfx_surface_acquire(NishGfxSurface *s) {
  if (s == NULL || s->config.device == NULL) return NULL;
  surface_drop_frame(s);
  WGPUSurfaceTexture frame = WGPU_SURFACE_TEXTURE_INIT;
  wgpuSurfaceGetCurrentTexture(s->surface, &frame);
  switch (frame.status) {
  case WGPUSurfaceGetCurrentTextureStatus_SuccessOptimal:
  case WGPUSurfaceGetCurrentTextureStatus_SuccessSuboptimal:
    break;
  case WGPUSurfaceGetCurrentTextureStatus_Timeout:
  case WGPUSurfaceGetCurrentTextureStatus_Outdated:
  case WGPUSurfaceGetCurrentTextureStatus_Lost:
    if (frame.texture != NULL) wgpuTextureRelease(frame.texture);
    wgpuSurfaceConfigure(s->surface, &s->config);
    return NULL;
  default:
    if (frame.texture != NULL) wgpuTextureRelease(frame.texture);
    ring_push(&s->owner->errors, NISHGFX_ERROR_INTERNAL, "the surface could not give a frame", WGPU_STRLEN);
    return NULL;
  }
  s->texture = frame.texture;
  s->view = calloc(1, sizeof *s->view);
  if (s->view == NULL) {
    surface_drop_frame(s);
    return NULL;
  }
  s->view->view = wgpuTextureCreateView(frame.texture, NULL);
  return s->view;
}

void nishgfx_surface_present(NishGfxSurface *s) {
  if (s == NULL || s->texture == NULL) return;
  wgpuSurfacePresent(s->surface);
  surface_drop_frame(s);
}

/* ---- adapter and device ------------------------------------------------ */

typedef struct AdapterAnswer {
  int done;
  WGPURequestAdapterStatus status;
  WGPUAdapter adapter;
  char message[NISHGFX_ERROR_MESSAGE_MAX + 1];
} AdapterAnswer;

static void copy_view(char *dst, WGPUStringView v) {
  size_t len = v.data == NULL ? 0 : v.length == WGPU_STRLEN ? strlen(v.data) : v.length;
  if (len > NISHGFX_ERROR_MESSAGE_MAX) len = NISHGFX_ERROR_MESSAGE_MAX;
  if (len > 0) memcpy(dst, v.data, len);
  dst[len] = '\0';
}

static void on_adapter(WGPURequestAdapterStatus status, WGPUAdapter adapter, WGPUStringView message,
                       void *userdata1, void *userdata2) {
  (void)userdata2;
  AdapterAnswer *a = userdata1;
  a->status = status;
  a->adapter = adapter;
  copy_view(a->message, message);
  a->done = 1;
}

NishGfxAdapter *nishgfx_adapter_request(NishGfxInstance *inst, NishGfxSurface *surface, uint32_t power) {
  if (inst == NULL) return NULL;
  WGPURequestAdapterOptions options = WGPU_REQUEST_ADAPTER_OPTIONS_INIT;
  options.powerPreference = (WGPUPowerPreference)power;
  options.compatibleSurface = surface != NULL ? surface->surface : NULL;
  AdapterAnswer answer;
  memset(&answer, 0, sizeof answer);
  WGPURequestAdapterCallbackInfo info = WGPU_REQUEST_ADAPTER_CALLBACK_INFO_INIT;
  info.mode = WGPUCallbackMode_AllowProcessEvents;
  info.callback = on_adapter;
  info.userdata1 = &answer;
  wgpuInstanceRequestAdapter(inst->instance, &options, info);
  for (int i = 0; !answer.done && i < NISHGFX_PROCESS_ROUNDS; i++) wgpuInstanceProcessEvents(inst->instance);
  if (!answer.done) {
    /* The callback still points at `answer`, which is about to go away: a
     * request wgpu-native never answers is a bug the shim cannot recover
     * from safely, so it stops the process rather than return into it. */
    ring_push(&inst->errors, NISHGFX_ERROR_INTERNAL, "the adapter request was never answered", WGPU_STRLEN);
    abort();
  }
  if (answer.status != WGPURequestAdapterStatus_Success || answer.adapter == NULL) {
    ring_push(&inst->errors, NISHGFX_ERROR_INTERNAL,
              answer.message[0] != '\0' ? answer.message : "no adapter", WGPU_STRLEN);
    if (answer.adapter != NULL) wgpuAdapterRelease(answer.adapter);
    return NULL;
  }
  NishGfxAdapter *a = calloc(1, sizeof *a);
  if (a == NULL) {
    wgpuAdapterRelease(answer.adapter);
    return NULL;
  }
  a->adapter = answer.adapter;
  return a;
}

void nishgfx_adapter_release(NishGfxAdapter *a) {
  if (a == NULL) return;
  wgpuAdapterRelease(a->adapter);
  free(a);
}

typedef struct DeviceAnswer {
  int done;
  WGPURequestDeviceStatus status;
  WGPUDevice device;
  char message[NISHGFX_ERROR_MESSAGE_MAX + 1];
} DeviceAnswer;

static void on_device(WGPURequestDeviceStatus status, WGPUDevice device, WGPUStringView message,
                      void *userdata1, void *userdata2) {
  (void)userdata2;
  DeviceAnswer *d = userdata1;
  d->status = status;
  d->device = device;
  copy_view(d->message, message);
  d->done = 1;
}

static void push_view(NishGfxRing *ring, int32_t kind, WGPUStringView v) {
  ring_push(ring, kind, v.data, v.data == NULL ? 0 : v.length);
}

/* The device's ring outlives every callback wgpu-native can still make, as
 * long as the program releases the device's objects before the device:
 * nishgfx_device_release() releases the device, which fires device-lost with
 * Destroyed or CallbackCancelled, before it frees the struct. An object used
 * after that can report into freed memory (GFX-5 in docs/security/gfx.md). */
static void on_lost(WGPUDevice const *device, WGPUDeviceLostReason reason, WGPUStringView message,
                    void *userdata1, void *userdata2) {
  (void)device;
  (void)userdata2;
  if (reason == WGPUDeviceLostReason_Destroyed || reason == WGPUDeviceLostReason_CallbackCancelled) return;
  push_view(&((NishGfxDevice *)userdata1)->errors, NISHGFX_ERROR_DEVICE_LOST, message);
}

static void on_error(WGPUDevice const *device, WGPUErrorType type, WGPUStringView message, void *userdata1,
                     void *userdata2) {
  (void)device;
  (void)userdata2;
  int32_t kind = type == WGPUErrorType_Validation    ? NISHGFX_ERROR_VALIDATION
                 : type == WGPUErrorType_OutOfMemory ? NISHGFX_ERROR_OUT_OF_MEMORY
                                                     : NISHGFX_ERROR_INTERNAL;
  push_view(&((NishGfxDevice *)userdata1)->errors, kind, message);
}

NishGfxDevice *nishgfx_device_request(NishGfxInstance *inst, NishGfxAdapter *adapter) {
  if (inst == NULL || adapter == NULL) return NULL;
  NishGfxDevice *dev = calloc(1, sizeof *dev);
  if (dev == NULL) return NULL;
  dev->instance = inst;
  ring_init(&dev->errors);
  WGPUDeviceDescriptor desc = WGPU_DEVICE_DESCRIPTOR_INIT;
  desc.deviceLostCallbackInfo.mode = WGPUCallbackMode_AllowProcessEvents;
  desc.deviceLostCallbackInfo.callback = on_lost;
  desc.deviceLostCallbackInfo.userdata1 = dev;
  desc.uncapturedErrorCallbackInfo.callback = on_error;
  desc.uncapturedErrorCallbackInfo.userdata1 = dev;
  DeviceAnswer answer;
  memset(&answer, 0, sizeof answer);
  WGPURequestDeviceCallbackInfo info = WGPU_REQUEST_DEVICE_CALLBACK_INFO_INIT;
  info.mode = WGPUCallbackMode_AllowProcessEvents;
  info.callback = on_device;
  info.userdata1 = &answer;
  wgpuAdapterRequestDevice(adapter->adapter, &desc, info);
  for (int i = 0; !answer.done && i < NISHGFX_PROCESS_ROUNDS; i++) wgpuInstanceProcessEvents(inst->instance);
  if (!answer.done) {
    ring_push(&inst->errors, NISHGFX_ERROR_INTERNAL, "the device request was never answered", WGPU_STRLEN);
    abort(); /* as in nishgfx_adapter_request */
  }
  if (answer.status != WGPURequestDeviceStatus_Success || answer.device == NULL) {
    ring_push(&inst->errors, NISHGFX_ERROR_INTERNAL,
              answer.message[0] != '\0' ? answer.message : "no device", WGPU_STRLEN);
    if (answer.device != NULL) wgpuDeviceRelease(answer.device);
    ring_destroy(&dev->errors);
    free(dev);
    return NULL;
  }
  dev->device = answer.device;
  dev->queue = wgpuDeviceGetQueue(dev->device);
  /* The device's own limit decides an offscreen side (Metal's default is
   * 8192, lavapipe's 16384). 8192 is WebGPU's default, the floor every
   * device meets, so a limit the device does not report falls back to it. */
  WGPULimits limits = WGPU_LIMITS_INIT;
  uint32_t side = wgpuDeviceGetLimits(dev->device, &limits) == WGPUStatus_Success
                      ? limits.maxTextureDimension2D
                      : 0;
  dev->max_side = side == 0 || side == WGPU_LIMIT_U32_UNDEFINED ? 8192 : side > 16384 ? 16384 : side;
  return dev;
}

void nishgfx_device_release(NishGfxDevice *dev) {
  if (dev == NULL) return;
  wgpuQueueRelease(dev->queue);
  wgpuDeviceRelease(dev->device);
  wgpuInstanceProcessEvents(dev->instance->instance);
  ring_destroy(&dev->errors);
  free(dev);
}

int32_t nishgfx_error_next(NishGfxDevice *dev, void *msg, size_t cap) {
  return dev == NULL ? NISHGFX_ERROR_NONE : ring_pop(&dev->errors, msg, cap);
}

uint32_t nishgfx_device_max_texture_side(NishGfxDevice *dev) { return dev == NULL ? 0 : dev->max_side; }

uint32_t nishgfx_errors_dropped(NishGfxDevice *dev) {
  if (dev == NULL) return 0;
  pthread_mutex_lock(&dev->errors.lock);
  uint32_t n = dev->errors.dropped;
  pthread_mutex_unlock(&dev->errors.lock);
  return n;
}

/* ---- resources --------------------------------------------------------- */

NishGfxBuffer *nishgfx_buffer_create(NishGfxDevice *dev, const NishGfxBufferDesc *d, const char *label) {
  if (dev == NULL || d == NULL) return NULL;
  WGPUBufferDescriptor desc = WGPU_BUFFER_DESCRIPTOR_INIT;
  desc.label = string_view(label);
  desc.size = d->size;
  desc.usage = d->usage;
  desc.mappedAtCreation = d->mapped_at_creation != 0;
  WGPUBuffer buffer = wgpuDeviceCreateBuffer(dev->device, &desc);
  if (buffer == NULL) return NULL;
  NishGfxBuffer *b = calloc(1, sizeof *b);
  if (b == NULL) {
    wgpuBufferRelease(buffer);
    return NULL;
  }
  b->buffer = buffer;
  return b;
}

void nishgfx_buffer_release(NishGfxBuffer *b) {
  if (b == NULL) return;
  wgpuBufferRelease(b->buffer);
  free(b);
}

void nishgfx_queue_write(NishGfxDevice *dev, NishGfxBuffer *b, uint64_t offset, const void *data, size_t len) {
  if (dev == NULL || b == NULL || (data == NULL && len > 0)) return;
  wgpuQueueWriteBuffer(dev->queue, b->buffer, offset, data, len);
}

NishGfxShader *nishgfx_shader_create(NishGfxDevice *dev, const char *wgsl) {
  if (dev == NULL || wgsl == NULL) return NULL;
  WGPUShaderSourceWGSL source = WGPU_SHADER_SOURCE_WGSL_INIT;
  source.code = string_view(wgsl);
  WGPUShaderModuleDescriptor desc = WGPU_SHADER_MODULE_DESCRIPTOR_INIT;
  desc.nextInChain = &source.chain;
  WGPUShaderModule module = wgpuDeviceCreateShaderModule(dev->device, &desc);
  if (module == NULL) return NULL;
  NishGfxShader *s = calloc(1, sizeof *s);
  if (s == NULL) {
    wgpuShaderModuleRelease(module);
    return NULL;
  }
  s->module = module;
  return s;
}

void nishgfx_shader_release(NishGfxShader *s) {
  if (s == NULL) return;
  wgpuShaderModuleRelease(s->module);
  free(s);
}

/* ---- pipelines --------------------------------------------------------- */

NishGfxPipelineDesc *nishgfx_pipeline_desc_new(NishGfxShader *shader, const char *vs_entry, const char *fs_entry,
                                               uint32_t color_format, uint64_t stride) {
  if (shader == NULL || vs_entry == NULL || fs_entry == NULL) return NULL;
  NishGfxPipelineDesc *d = calloc(1, sizeof *d);
  if (d == NULL) return NULL;
  d->vs_entry = copy_string(vs_entry);
  d->fs_entry = copy_string(fs_entry);
  if (d->vs_entry == NULL || d->fs_entry == NULL) {
    free(d->vs_entry);
    free(d->fs_entry);
    free(d);
    return NULL;
  }
  wgpuShaderModuleAddRef(shader->module);
  d->module = shader->module;
  d->color_format = (WGPUTextureFormat)color_format;
  d->stride = stride;
  return d;
}

int32_t nishgfx_pipeline_desc_attribute(NishGfxPipelineDesc *d, uint32_t format, uint64_t offset,
                                        uint32_t location) {
  if (d == NULL || d->attribute_count == NISHGFX_MAX_ATTRIBUTES) return -1;
  WGPUVertexAttribute *a = &d->attributes[d->attribute_count++];
  WGPUVertexAttribute init = WGPU_VERTEX_ATTRIBUTE_INIT;
  *a = init;
  a->format = (WGPUVertexFormat)format;
  a->offset = offset;
  a->shaderLocation = location;
  return 0;
}

static void pipeline_desc_free(NishGfxPipelineDesc *d) {
  wgpuShaderModuleRelease(d->module);
  free(d->vs_entry);
  free(d->fs_entry);
  free(d);
}

NishGfxPipeline *nishgfx_pipeline_create(NishGfxDevice *dev, NishGfxPipelineDesc *d) {
  if (d == NULL) return NULL;
  if (dev == NULL) {
    pipeline_desc_free(d);
    return NULL;
  }
  WGPUVertexBufferLayout layout = WGPU_VERTEX_BUFFER_LAYOUT_INIT;
  layout.stepMode = WGPUVertexStepMode_Vertex;
  layout.arrayStride = d->stride;
  layout.attributeCount = d->attribute_count;
  layout.attributes = d->attributes;
  WGPUColorTargetState target = WGPU_COLOR_TARGET_STATE_INIT;
  target.format = d->color_format;
  target.writeMask = WGPUColorWriteMask_All;
  WGPUFragmentState fragment = WGPU_FRAGMENT_STATE_INIT;
  fragment.module = d->module;
  fragment.entryPoint = string_view(d->fs_entry);
  fragment.targetCount = 1;
  fragment.targets = &target;
  WGPURenderPipelineDescriptor desc = WGPU_RENDER_PIPELINE_DESCRIPTOR_INIT;
  desc.vertex.module = d->module;
  desc.vertex.entryPoint = string_view(d->vs_entry);
  desc.vertex.bufferCount = d->stride > 0 ? 1 : 0;
  desc.vertex.buffers = d->stride > 0 ? &layout : NULL;
  desc.primitive.topology = WGPUPrimitiveTopology_TriangleList;
  desc.fragment = &fragment;
  WGPURenderPipeline pipeline = wgpuDeviceCreateRenderPipeline(dev->device, &desc);
  pipeline_desc_free(d);
  if (pipeline == NULL) return NULL;
  NishGfxPipeline *p = calloc(1, sizeof *p);
  if (p == NULL) {
    wgpuRenderPipelineRelease(pipeline);
    return NULL;
  }
  p->pipeline = pipeline;
  return p;
}

void nishgfx_pipeline_release(NishGfxPipeline *p) {
  if (p == NULL) return;
  wgpuRenderPipelineRelease(p->pipeline);
  free(p);
}

/* ---- bind groups ------------------------------------------------------- */

NishGfxBindGroupDesc *nishgfx_bind_group_desc_new(NishGfxPipeline *p, uint32_t index) {
  if (p == NULL) return NULL;
  NishGfxBindGroupDesc *d = calloc(1, sizeof *d);
  if (d == NULL) return NULL;
  d->layout = wgpuRenderPipelineGetBindGroupLayout(p->pipeline, index);
  return d;
}

int32_t nishgfx_bind_group_desc_buffer(NishGfxBindGroupDesc *d, uint32_t binding, NishGfxBuffer *b,
                                       uint64_t offset, uint64_t size) {
  if (d == NULL || b == NULL || d->entry_count == NISHGFX_MAX_BINDINGS) return -1;
  WGPUBindGroupEntry *e = &d->entries[d->entry_count++];
  WGPUBindGroupEntry init = WGPU_BIND_GROUP_ENTRY_INIT;
  *e = init;
  e->binding = binding;
  e->buffer = b->buffer;
  e->offset = offset;
  /* wgpu-native panics, and so aborts, on an entry of size 0; 0 means the rest
   * of the buffer here, as in nishgfx_pass_set_vertex_buffer. */
  e->size = size == 0 ? WGPU_WHOLE_SIZE : size;
  return 0;
}

NishGfxBindGroup *nishgfx_bind_group_create(NishGfxDevice *dev, NishGfxBindGroupDesc *d) {
  if (d == NULL) return NULL;
  WGPUBindGroup group = NULL;
  if (dev != NULL && d->layout != NULL) {
    WGPUBindGroupDescriptor desc = WGPU_BIND_GROUP_DESCRIPTOR_INIT;
    desc.layout = d->layout;
    desc.entryCount = d->entry_count;
    desc.entries = d->entries;
    group = wgpuDeviceCreateBindGroup(dev->device, &desc);
  }
  if (d->layout != NULL) wgpuBindGroupLayoutRelease(d->layout);
  free(d);
  if (group == NULL) return NULL;
  NishGfxBindGroup *g = calloc(1, sizeof *g);
  if (g == NULL) {
    wgpuBindGroupRelease(group);
    return NULL;
  }
  g->group = group;
  return g;
}

void nishgfx_bind_group_release(NishGfxBindGroup *g) {
  if (g == NULL) return;
  wgpuBindGroupRelease(g->group);
  free(g);
}

/* ---- encoding ---------------------------------------------------------- */

NishGfxEncoder *nishgfx_encoder_create(NishGfxDevice *dev) {
  if (dev == NULL) return NULL;
  WGPUCommandEncoder encoder = wgpuDeviceCreateCommandEncoder(dev->device, NULL);
  if (encoder == NULL) return NULL;
  NishGfxEncoder *e = calloc(1, sizeof *e);
  if (e == NULL) {
    wgpuCommandEncoderRelease(encoder);
    return NULL;
  }
  e->encoder = encoder;
  return e;
}

void nishgfx_encoder_submit(NishGfxDevice *dev, NishGfxEncoder *e) {
  if (e == NULL) return;
  if (dev != NULL) {
    WGPUCommandBuffer commands = wgpuCommandEncoderFinish(e->encoder, NULL);
    if (commands != NULL) {
      wgpuQueueSubmit(dev->queue, 1, &commands);
      wgpuCommandBufferRelease(commands);
    }
  }
  wgpuCommandEncoderRelease(e->encoder);
  free(e);
}

NishGfxPass *nishgfx_pass_begin(NishGfxEncoder *e, NishGfxView *view, uint32_t load, double r, double g,
                                double b, double a) {
  if (e == NULL || view == NULL) return NULL;
  WGPURenderPassColorAttachment color = WGPU_RENDER_PASS_COLOR_ATTACHMENT_INIT;
  color.view = view->view;
  color.depthSlice = WGPU_DEPTH_SLICE_UNDEFINED;
  color.loadOp = load ? WGPULoadOp_Load : WGPULoadOp_Clear;
  color.storeOp = WGPUStoreOp_Store;
  color.clearValue.r = r;
  color.clearValue.g = g;
  color.clearValue.b = b;
  color.clearValue.a = a;
  WGPURenderPassDescriptor desc = WGPU_RENDER_PASS_DESCRIPTOR_INIT;
  desc.colorAttachmentCount = 1;
  desc.colorAttachments = &color;
  WGPURenderPassEncoder pass = wgpuCommandEncoderBeginRenderPass(e->encoder, &desc);
  if (pass == NULL) return NULL;
  NishGfxPass *p = calloc(1, sizeof *p);
  if (p == NULL) {
    wgpuRenderPassEncoderEnd(pass);
    wgpuRenderPassEncoderRelease(pass);
    return NULL;
  }
  p->pass = pass;
  return p;
}

void nishgfx_pass_set_pipeline(NishGfxPass *p, NishGfxPipeline *pipeline) {
  if (p != NULL && pipeline != NULL) wgpuRenderPassEncoderSetPipeline(p->pass, pipeline->pipeline);
}

/* A null group or buffer is ignored, not passed on: wgpu-native's handle
 * conversion for either is not one this shim has seen report an error. */
void nishgfx_pass_set_bind_group(NishGfxPass *p, uint32_t index, NishGfxBindGroup *g) {
  if (p != NULL && g != NULL && g->group != NULL) wgpuRenderPassEncoderSetBindGroup(p->pass, index, g->group, 0, NULL);
}

void nishgfx_pass_set_vertex_buffer(NishGfxPass *p, uint32_t slot, NishGfxBuffer *b, uint64_t offset,
                                    uint64_t size) {
  if (p == NULL || b == NULL || b->buffer == NULL) return;
  wgpuRenderPassEncoderSetVertexBuffer(p->pass, slot, b->buffer, offset,
                                       size == 0 ? WGPU_WHOLE_SIZE : size);
}

void nishgfx_pass_draw(NishGfxPass *p, uint32_t vertices, uint32_t instances, uint32_t first_vertex,
                       uint32_t first_instance) {
  if (p != NULL) wgpuRenderPassEncoderDraw(p->pass, vertices, instances, first_vertex, first_instance);
}

void nishgfx_pass_end(NishGfxPass *p) {
  if (p == NULL) return;
  wgpuRenderPassEncoderEnd(p->pass);
  wgpuRenderPassEncoderRelease(p->pass);
  free(p);
}

/* ---- offscreen --------------------------------------------------------- */

NishGfxOffscreen *nishgfx_offscreen_create(NishGfxDevice *dev, uint32_t width, uint32_t height) {
  /* A side past the device's maxTextureDimension2D would be a texture the
   * device refuses. max_side is at most 16384, so width * 4 rounded to 256 and
   * its product with height fit in 32 and 64 bits. */
  if (dev == NULL || width == 0 || height == 0 || width > dev->max_side || height > dev->max_side) return NULL;
  NishGfxOffscreen *o = calloc(1, sizeof *o);
  if (o == NULL) return NULL;
  o->device = dev;
  o->width = width;
  o->height = height;
  o->padded_row = (width * 4 + 255) / 256 * 256;
  WGPUTextureDescriptor tex = WGPU_TEXTURE_DESCRIPTOR_INIT;
  tex.usage = WGPUTextureUsage_RenderAttachment | WGPUTextureUsage_CopySrc;
  tex.dimension = WGPUTextureDimension_2D;
  tex.size.width = width;
  tex.size.height = height;
  tex.size.depthOrArrayLayers = 1;
  tex.format = WGPUTextureFormat_RGBA8Unorm;
  o->texture = wgpuDeviceCreateTexture(dev->device, &tex);
  WGPUBufferDescriptor buf = WGPU_BUFFER_DESCRIPTOR_INIT;
  buf.usage = WGPUBufferUsage_CopyDst | WGPUBufferUsage_MapRead;
  buf.size = (uint64_t)o->padded_row * height;
  o->readback = wgpuDeviceCreateBuffer(dev->device, &buf);
  o->view.view = o->texture != NULL ? wgpuTextureCreateView(o->texture, NULL) : NULL;
  if (o->texture == NULL || o->readback == NULL || o->view.view == NULL) {
    nishgfx_offscreen_release(o);
    return NULL;
  }
  return o;
}

void nishgfx_offscreen_release(NishGfxOffscreen *o) {
  if (o == NULL) return;
  if (o->view.view != NULL) wgpuTextureViewRelease(o->view.view);
  if (o->texture != NULL) wgpuTextureRelease(o->texture);
  if (o->readback != NULL) wgpuBufferRelease(o->readback);
  free(o);
}

NishGfxView *nishgfx_offscreen_view(NishGfxOffscreen *o) { return o == NULL ? NULL : &o->view; }

typedef struct MapAnswer {
  int done;
  WGPUMapAsyncStatus status;
  char message[NISHGFX_ERROR_MESSAGE_MAX + 1];
} MapAnswer;

static void on_map(WGPUMapAsyncStatus status, WGPUStringView message, void *userdata1, void *userdata2) {
  (void)userdata2;
  MapAnswer *m = userdata1;
  m->status = status;
  copy_view(m->message, message);
  m->done = 1;
}

int32_t nishgfx_offscreen_read(NishGfxOffscreen *o, void *dst, size_t cap) {
  if (o == NULL || dst == NULL) return -1;
  size_t row = (size_t)o->width * 4;
  size_t need = row * o->height;
  if (cap < need) return -1;
  NishGfxDevice *dev = o->device;
  WGPUCommandEncoder encoder = wgpuDeviceCreateCommandEncoder(dev->device, NULL);
  WGPUTexelCopyTextureInfo src = WGPU_TEXEL_COPY_TEXTURE_INFO_INIT;
  src.texture = o->texture;
  WGPUTexelCopyBufferInfo to = WGPU_TEXEL_COPY_BUFFER_INFO_INIT;
  to.buffer = o->readback;
  to.layout.bytesPerRow = o->padded_row;
  to.layout.rowsPerImage = o->height;
  WGPUExtent3D size = {o->width, o->height, 1};
  wgpuCommandEncoderCopyTextureToBuffer(encoder, &src, &to, &size);
  WGPUCommandBuffer commands = wgpuCommandEncoderFinish(encoder, NULL);
  wgpuQueueSubmit(dev->queue, 1, &commands);
  wgpuCommandBufferRelease(commands);
  wgpuCommandEncoderRelease(encoder);

  size_t mapped = (size_t)o->padded_row * o->height;
  MapAnswer answer;
  memset(&answer, 0, sizeof answer);
  WGPUBufferMapCallbackInfo info = WGPU_BUFFER_MAP_CALLBACK_INFO_INIT;
  info.mode = WGPUCallbackMode_AllowProcessEvents;
  info.callback = on_map;
  info.userdata1 = &answer;
  wgpuBufferMapAsync(o->readback, WGPUMapMode_Read, 0, mapped, info);
  wgpuDevicePoll(dev->device, 1, NULL);
  for (int i = 0; !answer.done && i < NISHGFX_PROCESS_ROUNDS; i++) wgpuInstanceProcessEvents(dev->instance->instance);
  if (!answer.done) {
    ring_push(&dev->errors, NISHGFX_ERROR_INTERNAL, "the readback map was never answered", WGPU_STRLEN);
    abort(); /* as in nishgfx_adapter_request */
  }
  if (answer.status != WGPUMapAsyncStatus_Success) {
    ring_push(&dev->errors, NISHGFX_ERROR_INTERNAL,
              answer.message[0] != '\0' ? answer.message : "the readback map failed", WGPU_STRLEN);
    return -2;
  }
  const uint8_t *pixels = wgpuBufferGetConstMappedRange(o->readback, 0, mapped);
  if (pixels == NULL) {
    wgpuBufferUnmap(o->readback);
    ring_push(&dev->errors, NISHGFX_ERROR_INTERNAL, "the readback range is not mapped", WGPU_STRLEN);
    return -2;
  }
  /* Each copy reads row bytes at y * padded_row, which ends at most at
   * (height - 1) * padded_row + row <= mapped, and writes them at y * row,
   * which ends at need <= cap. */
  for (uint32_t y = 0; y < o->height; y++)
    memcpy((uint8_t *)dst + (size_t)y * row, pixels + (size_t)y * o->padded_row, row);
  wgpuBufferUnmap(o->readback);
  return 0;
}
