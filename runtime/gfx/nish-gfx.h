/*
 * nish-gfx.h: the C surface Nish programs draw through.
 *
 * A thin, synchronous shim over wgpu-native (WebGPU) and SDL3. It exists so
 * that `nish c-import` can read it: every parameter is a scalar, an opaque
 * handle or a struct passed by pointer; there are no unions, no structs by
 * value, no callbacks and no variadics. A byte buffer is a `void *` or
 * `const void *` followed by its `size_t` length. WebGPU enum and flag values
 * cross as plain uint32_t, with webgpu.h's numbering. This header does not
 * include webgpu.h or SDL.h; only nish-gfx.c does.
 *
 * Errors never cross as callbacks. Every device-lost and uncaptured-error
 * report is copied into a fixed ring inside the device and drained with
 * nishgfx_error_next(); a report that finds the ring full is counted by
 * nishgfx_errors_dropped(). Failures before a device exists (no adapter, a
 * refused device) are queued on the instance the same way.
 */
#ifndef NISH_GFX_H
#define NISH_GFX_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct NishGfxInstance NishGfxInstance;
typedef struct NishGfxWindow NishGfxWindow;
typedef struct NishGfxSurface NishGfxSurface;
typedef struct NishGfxAdapter NishGfxAdapter;
typedef struct NishGfxDevice NishGfxDevice;
typedef struct NishGfxBuffer NishGfxBuffer;
typedef struct NishGfxShader NishGfxShader;
typedef struct NishGfxPipelineDesc NishGfxPipelineDesc;
typedef struct NishGfxPipeline NishGfxPipeline;
typedef struct NishGfxBindGroupDesc NishGfxBindGroupDesc;
typedef struct NishGfxBindGroup NishGfxBindGroup;
typedef struct NishGfxEncoder NishGfxEncoder;
typedef struct NishGfxPass NishGfxPass;
typedef struct NishGfxView NishGfxView;
typedef struct NishGfxOffscreen NishGfxOffscreen;

/* Error kinds nishgfx_error_next() answers. */
#define NISHGFX_ERROR_NONE 0
#define NISHGFX_ERROR_VALIDATION 1
#define NISHGFX_ERROR_OUT_OF_MEMORY 2
#define NISHGFX_ERROR_INTERNAL 3
#define NISHGFX_ERROR_DEVICE_LOST 4

/* The error ring's size, per instance and per device. */
#define NISHGFX_ERROR_RING 16
/* The longest message an entry keeps, without its NUL. */
#define NISHGFX_ERROR_MESSAGE_MAX 255

/* Event kinds nishgfx_event_next() answers. */
#define NISHGFX_EVENT_NONE 0
#define NISHGFX_EVENT_QUIT 1
#define NISHGFX_EVENT_KEY_DOWN 2
#define NISHGFX_EVENT_KEY_UP 3
#define NISHGFX_EVENT_MOUSE_MOVE 4
#define NISHGFX_EVENT_MOUSE_DOWN 5
#define NISHGFX_EVENT_MOUSE_UP 6
#define NISHGFX_EVENT_WHEEL 7
#define NISHGFX_EVENT_RESIZED 8

/* The event ring's size, per window. */
#define NISHGFX_EVENT_RING 64

/* One input or window event. Fields a kind does not use are zero. */
typedef struct NishGfxEvent {
  uint32_t kind;      /* NISHGFX_EVENT_* */
  uint32_t key;       /* SDL keycode, for KEY_DOWN and KEY_UP */
  uint32_t button;    /* 1 left, 2 middle, 3 right, for MOUSE_DOWN and MOUSE_UP */
  uint32_t modifiers; /* SDL_Keymod bits, for keys */
  float x, y;         /* pointer position in window pixels */
  float dx, dy;       /* motion or wheel delta */
  uint32_t width, height; /* new size in pixels, for RESIZED */
} NishGfxEvent;

/* A buffer to create. `usage` is WGPUBufferUsage bits. */
typedef struct NishGfxBufferDesc {
  uint64_t size;
  uint32_t usage;
  uint32_t mapped_at_creation;
} NishGfxBufferDesc;

/* ---- instance, window, surface ---------------------------------------- */

/* A WebGPU instance. Answers null if wgpu-native refuses one. */
NishGfxInstance *nishgfx_instance_create(void);
void nishgfx_instance_release(NishGfxInstance *instance);
/* Drain one queued instance error (adapter or device refusal) into msg,
 * NUL-terminated and cut to cap - 1 bytes; answers its kind, 0 when empty. */
int32_t nishgfx_instance_error_next(NishGfxInstance *instance, void *msg, size_t cap);

/* An SDL3 window of width x height pixels; `title` is NUL-terminated UTF-8.
 * Answers null when SDL has no video driver. */
NishGfxWindow *nishgfx_window_create(const char *title, uint32_t width, uint32_t height);
void nishgfx_window_release(NishGfxWindow *window);
/* Move every pending SDL event into the window's ring; answers how many were
 * queued. Events past the ring's size are dropped and counted. */
uint32_t nishgfx_events_poll(NishGfxWindow *window);
/* Take the oldest queued event into *out; answers its kind, 0 when empty. */
uint32_t nishgfx_event_next(NishGfxWindow *window, NishGfxEvent *out);
uint32_t nishgfx_events_dropped(NishGfxWindow *window);

/* A surface on the window, through Metal, Wayland or X11 as SDL's current
 * video driver says. Answers null (and queues an instance error) otherwise. */
NishGfxSurface *nishgfx_surface_create(NishGfxInstance *instance, NishGfxWindow *window);
void nishgfx_surface_release(NishGfxSurface *surface);
/* Configure for width x height. vsync != 0 is Fifo; otherwise Mailbox, then
 * Immediate, then Fifo, whichever the surface offers first. Answers 0, or -1
 * when the surface offers no format. */
int32_t nishgfx_surface_configure(NishGfxSurface *surface, NishGfxAdapter *adapter, NishGfxDevice *device,
                                  uint32_t width, uint32_t height, uint32_t vsync);
/* The WGPUTextureFormat configure picked. */
uint32_t nishgfx_surface_format(NishGfxSurface *surface);
/* The next frame's view, or null to skip this frame (an outdated or timed-out
 * surface is reconfigured; an error is queued on the device). The view lives
 * until nishgfx_surface_present(). */
NishGfxView *nishgfx_surface_acquire(NishGfxSurface *surface);
void nishgfx_surface_present(NishGfxSurface *surface);

/* ---- adapter, device, errors ------------------------------------------- */

/* An adapter, compatible with `surface` when it is not null. power is a
 * WGPUPowerPreference. Answers null and queues an instance error on failure. */
NishGfxAdapter *nishgfx_adapter_request(NishGfxInstance *instance, NishGfxSurface *surface, uint32_t power);
void nishgfx_adapter_release(NishGfxAdapter *adapter);
/* A device with default limits. Answers null and queues an instance error on
 * failure. Its device-lost and uncaptured-error reports go to its ring. */
NishGfxDevice *nishgfx_device_request(NishGfxInstance *instance, NishGfxAdapter *adapter);
/* Release every buffer, shader, pipeline, bind group, offscreen target and
 * surface made from the device first: one used after this can report an
 * error into the freed device. */
void nishgfx_device_release(NishGfxDevice *device);
/* Drain one queued device error into msg (as nishgfx_instance_error_next). */
int32_t nishgfx_error_next(NishGfxDevice *device, void *msg, size_t cap);
/* The longest side nishgfx_offscreen_create takes on this device: its
 * maxTextureDimension2D, at most 16384 (8192 when it reports none). */
uint32_t nishgfx_device_max_texture_side(NishGfxDevice *device);
/* How many reports found the ring full, since the device was made. */
uint32_t nishgfx_errors_dropped(NishGfxDevice *device);

/* ---- resources --------------------------------------------------------- */

/* `label` may be null. Answers null when wgpu-native does. */
NishGfxBuffer *nishgfx_buffer_create(NishGfxDevice *device, const NishGfxBufferDesc *desc, const char *label);
void nishgfx_buffer_release(NishGfxBuffer *buffer);
/* Copy len bytes of data into buffer at offset, on the device's queue. */
void nishgfx_queue_write(NishGfxDevice *device, NishGfxBuffer *buffer, uint64_t offset,
                         const void *data, size_t len);
/* A shader module from NUL-terminated WGSL. A compile error is queued on the
 * device; the module answered is then invalid but safe to pass on. */
NishGfxShader *nishgfx_shader_create(NishGfxDevice *device, const char *wgsl);
void nishgfx_shader_release(NishGfxShader *shader);

/* A render pipeline builder: one vertex buffer of `stride` bytes (0 for no
 * vertex buffer), one color target of `color_format`, triangle list. */
NishGfxPipelineDesc *nishgfx_pipeline_desc_new(NishGfxShader *shader, const char *vs_entry, const char *fs_entry,
                                               uint32_t color_format, uint64_t stride);
/* Add a vertex attribute (a WGPUVertexFormat at offset, shader location).
 * Answers 0, or -1 once the builder holds 16. */
int32_t nishgfx_pipeline_desc_attribute(NishGfxPipelineDesc *desc, uint32_t format, uint64_t offset,
                                        uint32_t location);
/* Build the pipeline and free the builder, either way. */
NishGfxPipeline *nishgfx_pipeline_create(NishGfxDevice *device, NishGfxPipelineDesc *desc);
void nishgfx_pipeline_release(NishGfxPipeline *pipeline);

/* A bind group builder for group `index` of the pipeline's layout. */
NishGfxBindGroupDesc *nishgfx_bind_group_desc_new(NishGfxPipeline *pipeline, uint32_t index);
/* Bind size bytes of buffer at offset to `binding`; size 0 binds the rest of
 * the buffer from offset. Answers 0, or -1 once the builder holds 16. */
int32_t nishgfx_bind_group_desc_buffer(NishGfxBindGroupDesc *desc, uint32_t binding, NishGfxBuffer *buffer,
                                       uint64_t offset, uint64_t size);
/* Build the bind group and free the builder, either way. */
NishGfxBindGroup *nishgfx_bind_group_create(NishGfxDevice *device, NishGfxBindGroupDesc *desc);
void nishgfx_bind_group_release(NishGfxBindGroup *group);

/* ---- encoding ---------------------------------------------------------- */

NishGfxEncoder *nishgfx_encoder_create(NishGfxDevice *device);
/* Finish the encoder, submit it on the device's queue, and free it. */
void nishgfx_encoder_submit(NishGfxDevice *device, NishGfxEncoder *encoder);

/* A render pass on one color view. load != 0 keeps the view's contents;
 * otherwise it is cleared to (r, g, b, a). */
NishGfxPass *nishgfx_pass_begin(NishGfxEncoder *encoder, NishGfxView *view, uint32_t load,
                                double r, double g, double b, double a);
void nishgfx_pass_set_pipeline(NishGfxPass *pass, NishGfxPipeline *pipeline);
void nishgfx_pass_set_bind_group(NishGfxPass *pass, uint32_t index, NishGfxBindGroup *group);
/* size 0 binds the rest of the buffer from offset. */
void nishgfx_pass_set_vertex_buffer(NishGfxPass *pass, uint32_t slot, NishGfxBuffer *buffer, uint64_t offset,
                                    uint64_t size);
void nishgfx_pass_draw(NishGfxPass *pass, uint32_t vertices, uint32_t instances, uint32_t first_vertex,
                       uint32_t first_instance);
/* End the pass and free it. */
void nishgfx_pass_end(NishGfxPass *pass);

/* ---- offscreen --------------------------------------------------------- */

/* A width x height RGBA8Unorm render target with readback; needs no window
 * and initialises no SDL video. Answers null for a side of 0 or past
 * nishgfx_device_max_texture_side. */
NishGfxOffscreen *nishgfx_offscreen_create(NishGfxDevice *device, uint32_t width, uint32_t height);
void nishgfx_offscreen_release(NishGfxOffscreen *offscreen);
/* The target's view, valid until the offscreen is released. */
NishGfxView *nishgfx_offscreen_view(NishGfxOffscreen *offscreen);
/* Copy the target's pixels, width * 4 bytes per row, top row first, into dst.
 * Answers 0; -1 when cap < width * height * 4 (dst untouched); -2 when the
 * map fails (an error is queued on the device). */
int32_t nishgfx_offscreen_read(NishGfxOffscreen *offscreen, void *dst, size_t cap);

#ifdef __cplusplus
}
#endif

#endif /* NISH_GFX_H */
