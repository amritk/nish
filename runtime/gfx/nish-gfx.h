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
 *
 * Every declaration below carries a doc comment, which `nish c-import` copies
 * onto the binding it writes in std/gpu/sys.ts, and which the library
 * reference shows.
 */
#ifndef NISH_GFX_H
#define NISH_GFX_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** A WebGPU instance: the root every surface, adapter and device is made from. */
typedef struct NishGfxInstance NishGfxInstance;
/** An SDL3 window, with the ring its input and window events queue in. */
typedef struct NishGfxWindow NishGfxWindow;
/** A WebGPU surface that presents frames into a window. */
typedef struct NishGfxSurface NishGfxSurface;
/** A WebGPU adapter: one GPU, or a software rasteriser, that devices are requested from. */
typedef struct NishGfxAdapter NishGfxAdapter;
/** A WebGPU device and its queue, with the ring its errors queue in. */
typedef struct NishGfxDevice NishGfxDevice;
/** A WebGPU buffer on a device. */
typedef struct NishGfxBuffer NishGfxBuffer;
/** A WebGPU shader module compiled from WGSL. */
typedef struct NishGfxShader NishGfxShader;
/** A render pipeline builder, freed by nishgfx_pipeline_create(). */
typedef struct NishGfxPipelineDesc NishGfxPipelineDesc;
/** A render pipeline: a shader's two stages, its vertex layout and one color target. */
typedef struct NishGfxPipeline NishGfxPipeline;
/** A bind group builder, freed by nishgfx_bind_group_create(). */
typedef struct NishGfxBindGroupDesc NishGfxBindGroupDesc;
/** A bind group: the buffers a pipeline's group of bindings reads. */
typedef struct NishGfxBindGroup NishGfxBindGroup;
/** A command encoder, freed when it is submitted. */
typedef struct NishGfxEncoder NishGfxEncoder;
/** A render pass on one color view, freed when it ends. */
typedef struct NishGfxPass NishGfxPass;
/** A texture view a render pass draws into: a surface's frame or an offscreen target. */
typedef struct NishGfxView NishGfxView;
/** A render target with no window, whose pixels can be read back. */
typedef struct NishGfxOffscreen NishGfxOffscreen;

/* Error kinds nishgfx_error_next() answers. */
/** No error was queued. */
#define NISHGFX_ERROR_NONE 0
/** A WebGPU validation error. */
#define NISHGFX_ERROR_VALIDATION 1
/** A WebGPU out-of-memory error. */
#define NISHGFX_ERROR_OUT_OF_MEMORY 2
/** A WebGPU internal error, or a failure of the shim's own. */
#define NISHGFX_ERROR_INTERNAL 3
/** The device was lost. */
#define NISHGFX_ERROR_DEVICE_LOST 4

/** The error ring's size, per instance and per device. */
#define NISHGFX_ERROR_RING 16
/** The longest message an entry keeps, without its NUL. */
#define NISHGFX_ERROR_MESSAGE_MAX 255

/* Event kinds nishgfx_event_next() answers. */
/** No event was queued. */
#define NISHGFX_EVENT_NONE 0
/** The window was asked to close. */
#define NISHGFX_EVENT_QUIT 1
/** A key went down. */
#define NISHGFX_EVENT_KEY_DOWN 2
/** A key came up. */
#define NISHGFX_EVENT_KEY_UP 3
/** The pointer moved. */
#define NISHGFX_EVENT_MOUSE_MOVE 4
/** A mouse button went down. */
#define NISHGFX_EVENT_MOUSE_DOWN 5
/** A mouse button came up. */
#define NISHGFX_EVENT_MOUSE_UP 6
/** The wheel turned. */
#define NISHGFX_EVENT_WHEEL 7
/** The window's pixel size changed. */
#define NISHGFX_EVENT_RESIZED 8

/** The event ring's size, per window. */
#define NISHGFX_EVENT_RING 64

/** One input or window event. Fields a kind does not use are zero. */
typedef struct NishGfxEvent {
  uint32_t kind;      /* NISHGFX_EVENT_* */
  uint32_t key;       /* SDL keycode, for KEY_DOWN and KEY_UP */
  uint32_t button;    /* 1 left, 2 middle, 3 right, for MOUSE_DOWN and MOUSE_UP */
  uint32_t modifiers; /* SDL_Keymod bits, for keys */
  float x, y;         /* pointer position in window pixels */
  float dx, dy;       /* motion or wheel delta */
  uint32_t width, height; /* new size in pixels, for RESIZED */
} NishGfxEvent;

/** A buffer to create. `usage` is WGPUBufferUsage bits. */
typedef struct NishGfxBufferDesc {
  uint64_t size;
  uint32_t usage;
  uint32_t mapped_at_creation;
} NishGfxBufferDesc;

/* ---- instance, window, surface ---------------------------------------- */

/**
 * A WebGPU instance.
 *
 * @returns the instance, or null if wgpu-native refuses one
 */
NishGfxInstance *nishgfx_instance_create(void);
/**
 * Release an instance. Release it last: every surface, adapter and device
 * made from it keeps it, and a device's readback drives events through it.
 *
 * @param instance the instance to release
 */
void nishgfx_instance_release(NishGfxInstance *instance);
/**
 * Drain one queued instance error (an adapter or device refusal) into msg,
 * NUL-terminated and cut to cap - 1 bytes.
 *
 * @param instance the instance whose ring is drained
 * @param msg the buffer the message is copied into
 * @param cap the bytes msg holds
 * @returns the error's kind, a NISHGFX_ERROR_* value, or 0 when the ring is empty
 */
int32_t nishgfx_instance_error_next(NishGfxInstance *instance, void *msg, size_t cap);

/**
 * An SDL3 window of width x height pixels.
 *
 * @param title the window's title, NUL-terminated UTF-8
 * @param width the width in pixels
 * @param height the height in pixels
 * @returns the window, or null for a 0 side or one past INT32_MAX, when SDL
 *   has no video driver, when memory or SDL's window properties run out, and
 *   when SDL refuses the window; SDL_GetError() says why for the SDL failures
 */
NishGfxWindow *nishgfx_window_create(const char *title, uint32_t width, uint32_t height);
/**
 * Release a window. Release a surface made on the window first: it reads the
 * window's size.
 *
 * @param window the window to release
 */
void nishgfx_window_release(NishGfxWindow *window);
/**
 * Move every pending SDL event into the window's ring. Events past the ring's
 * size are dropped and counted.
 *
 * @param window the window whose ring is filled
 * @returns how many events were queued
 */
uint32_t nishgfx_events_poll(NishGfxWindow *window);
/**
 * Take the oldest queued event.
 *
 * @param window the window whose ring is drained
 * @param out where the event is written
 * @returns the event's kind, a NISHGFX_EVENT_* value, or 0 when the ring is empty
 */
uint32_t nishgfx_event_next(NishGfxWindow *window, NishGfxEvent *out);
/**
 * How many events found the window's ring full and were dropped.
 *
 * @param window the window to ask
 * @returns the count since the window was made, or 0 for a null window
 */
uint32_t nishgfx_events_dropped(NishGfxWindow *window);

/**
 * A surface on the window, through Metal, Wayland or X11 as SDL's current
 * video driver says.
 *
 * @param instance the instance the surface is made from
 * @param window the window it presents into
 * @returns the surface, or null (and an instance error is queued) on any
 *   other video driver or failure
 */
NishGfxSurface *nishgfx_surface_create(NishGfxInstance *instance, NishGfxWindow *window);
/**
 * Release a surface.
 *
 * @param surface the surface to release
 */
void nishgfx_surface_release(NishGfxSurface *surface);
/**
 * Configure a surface for width x height. vsync != 0 is Fifo; otherwise
 * Mailbox, then Immediate, then Fifo, whichever the surface offers first.
 *
 * @param surface the surface to configure
 * @param adapter the adapter the device came from
 * @param device the device that draws into the surface
 * @param width the width in pixels
 * @param height the height in pixels
 * @param vsync nonzero to wait for the display
 * @returns 0, or -1 (and a device error is queued) for a 0 side or a surface
 *   with no format
 */
int32_t nishgfx_surface_configure(NishGfxSurface *surface, NishGfxAdapter *adapter, NishGfxDevice *device,
                                  uint32_t width, uint32_t height, uint32_t vsync);
/**
 * The texture format nishgfx_surface_configure() picked.
 *
 * @param surface the surface to ask
 * @returns a WGPUTextureFormat, or 0 for a null surface
 */
uint32_t nishgfx_surface_format(NishGfxSurface *surface);
/**
 * The next frame's view, which lives until nishgfx_surface_present().
 *
 * @param surface the configured surface
 * @returns the view, or null to skip this frame: an outdated, lost or
 *   timed-out surface is reconfigured at the window's pixel size, or left
 *   until a frame where that size is above 0; any other failure queues a
 *   device error
 */
NishGfxView *nishgfx_surface_acquire(NishGfxSurface *surface);
/**
 * Present the frame nishgfx_surface_acquire() answered.
 *
 * @param surface the surface to present
 */
void nishgfx_surface_present(NishGfxSurface *surface);

/* ---- adapter, device, errors ------------------------------------------- */

/**
 * Request an adapter.
 *
 * @param instance the instance to request it from
 * @param surface a surface the adapter must be able to present to, or null
 * @param power a WGPUPowerPreference
 * @returns the adapter, or null (and an instance error is queued) on failure
 */
NishGfxAdapter *nishgfx_adapter_request(NishGfxInstance *instance, NishGfxSurface *surface, uint32_t power);
/**
 * Release an adapter.
 *
 * @param adapter the adapter to release
 */
void nishgfx_adapter_release(NishGfxAdapter *adapter);
/**
 * Request a device with default limits. Its device-lost and uncaptured-error
 * reports go to its ring.
 *
 * @param instance the instance the adapter came from
 * @param adapter the adapter to request it from
 * @returns the device, or null (and an instance error is queued) on failure
 */
NishGfxDevice *nishgfx_device_request(NishGfxInstance *instance, NishGfxAdapter *adapter);
/**
 * Release a device. Release every buffer, shader, pipeline, bind group,
 * offscreen target and surface made from the device first: one used after
 * this can report an error into the freed device.
 *
 * @param device the device to release
 */
void nishgfx_device_release(NishGfxDevice *device);
/**
 * Drain one queued device error into msg, NUL-terminated and cut to cap - 1
 * bytes.
 *
 * @param device the device whose ring is drained
 * @param msg the buffer the message is copied into
 * @param cap the bytes msg holds
 * @returns the error's kind, a NISHGFX_ERROR_* value, or 0 when the ring is empty
 */
int32_t nishgfx_error_next(NishGfxDevice *device, void *msg, size_t cap);
/**
 * How many reports found the device's ring full.
 *
 * @param device the device to ask
 * @returns the count since the device was made
 */
uint32_t nishgfx_errors_dropped(NishGfxDevice *device);

/* ---- resources --------------------------------------------------------- */

/**
 * Create a buffer.
 *
 * @param device the device it lives on
 * @param desc its size, usage and whether it starts mapped
 * @param label a debug label, or null
 * @returns the buffer, or null when wgpu-native answers none
 */
NishGfxBuffer *nishgfx_buffer_create(NishGfxDevice *device, const NishGfxBufferDesc *desc, const char *label);
/**
 * Release a buffer.
 *
 * @param buffer the buffer to release
 */
void nishgfx_buffer_release(NishGfxBuffer *buffer);
/**
 * Copy len bytes of data into buffer at offset, on the device's queue.
 *
 * @param device the device whose queue writes
 * @param buffer the buffer written
 * @param offset the byte offset into buffer
 * @param data the bytes to copy
 * @param len how many bytes of data to copy
 */
void nishgfx_queue_write(NishGfxDevice *device, NishGfxBuffer *buffer, uint64_t offset,
                         const void *data, size_t len);
/**
 * A shader module from WGSL. A compile error is queued on the device; the
 * module answered is then invalid but safe to pass on.
 *
 * @param device the device it lives on
 * @param wgsl the shader's source, NUL-terminated
 * @returns the module, or null when wgpu-native answers none
 */
NishGfxShader *nishgfx_shader_create(NishGfxDevice *device, const char *wgsl);
/**
 * Release a shader module.
 *
 * @param shader the module to release
 */
void nishgfx_shader_release(NishGfxShader *shader);

/**
 * A render pipeline builder: one vertex buffer of `stride` bytes (0 for no
 * vertex buffer), one color target of `color_format`, triangle list.
 *
 * @param shader the module both stages come from
 * @param vs_entry the vertex stage's entry point, NUL-terminated
 * @param fs_entry the fragment stage's entry point, NUL-terminated
 * @param color_format the color target's WGPUTextureFormat
 * @param stride the vertex buffer's stride in bytes, or 0 for none
 * @returns the builder, or null when memory runs out
 */
NishGfxPipelineDesc *nishgfx_pipeline_desc_new(NishGfxShader *shader, const char *vs_entry, const char *fs_entry,
                                               uint32_t color_format, uint64_t stride);
/**
 * Add a vertex attribute to a pipeline builder.
 *
 * @param desc the builder
 * @param format the attribute's WGPUVertexFormat
 * @param offset its byte offset in a vertex
 * @param location its shader location
 * @returns 0, or -1 once the builder holds 16
 */
int32_t nishgfx_pipeline_desc_attribute(NishGfxPipelineDesc *desc, uint32_t format, uint64_t offset,
                                        uint32_t location);
/**
 * Build the pipeline and free the builder, either way.
 *
 * @param device the device it lives on
 * @param desc the builder, freed by this call
 * @returns the pipeline, or null when it cannot be built
 */
NishGfxPipeline *nishgfx_pipeline_create(NishGfxDevice *device, NishGfxPipelineDesc *desc);
/**
 * Release a pipeline.
 *
 * @param pipeline the pipeline to release
 */
void nishgfx_pipeline_release(NishGfxPipeline *pipeline);

/**
 * A bind group builder for group `index` of the pipeline's layout.
 *
 * @param pipeline the pipeline whose layout the group follows
 * @param index the group's index in that layout
 * @returns the builder, or null when memory runs out
 */
NishGfxBindGroupDesc *nishgfx_bind_group_desc_new(NishGfxPipeline *pipeline, uint32_t index);
/**
 * Bind size bytes of buffer at offset to `binding`; size 0 binds the rest of
 * the buffer from offset.
 *
 * @param desc the builder
 * @param binding the binding number
 * @param buffer the buffer bound
 * @param offset the byte offset into buffer
 * @param size the bytes bound, or 0 for the rest of the buffer
 * @returns 0, or -1 once the builder holds 16
 */
int32_t nishgfx_bind_group_desc_buffer(NishGfxBindGroupDesc *desc, uint32_t binding, NishGfxBuffer *buffer,
                                       uint64_t offset, uint64_t size);
/**
 * Build the bind group and free the builder, either way.
 *
 * @param device the device it lives on
 * @param desc the builder, freed by this call
 * @returns the bind group, or null when it cannot be built
 */
NishGfxBindGroup *nishgfx_bind_group_create(NishGfxDevice *device, NishGfxBindGroupDesc *desc);
/**
 * Release a bind group.
 *
 * @param group the bind group to release
 */
void nishgfx_bind_group_release(NishGfxBindGroup *group);

/* ---- encoding ---------------------------------------------------------- */

/**
 * A command encoder on the device.
 *
 * @param device the device whose commands it records
 * @returns the encoder, or null when wgpu-native or memory answers none
 */
NishGfxEncoder *nishgfx_encoder_create(NishGfxDevice *device);
/**
 * Finish the encoder, submit it on the device's queue, and free it.
 *
 * @param device the device whose queue runs it
 * @param encoder the encoder, freed by this call
 */
void nishgfx_encoder_submit(NishGfxDevice *device, NishGfxEncoder *encoder);

/**
 * A render pass on one color view. load != 0 keeps the view's contents;
 * otherwise it is cleared to (r, g, b, a).
 *
 * @param encoder the encoder that records it
 * @param view the color view it draws into
 * @param load nonzero to keep the view's contents
 * @param r the clear color's red, 0 to 1
 * @param g the clear color's green, 0 to 1
 * @param b the clear color's blue, 0 to 1
 * @param a the clear color's alpha, 0 to 1
 * @returns the pass, or null for a null encoder or view or when it cannot begin
 */
NishGfxPass *nishgfx_pass_begin(NishGfxEncoder *encoder, NishGfxView *view, uint32_t load,
                                double r, double g, double b, double a);
/**
 * Set the pass's pipeline.
 *
 * @param pass the pass
 * @param pipeline the pipeline the next draws use
 */
void nishgfx_pass_set_pipeline(NishGfxPass *pass, NishGfxPipeline *pipeline);
/**
 * Set a bind group of the pass.
 *
 * @param pass the pass
 * @param index the group's index in the pipeline's layout
 * @param group the bind group, or null
 */
void nishgfx_pass_set_bind_group(NishGfxPass *pass, uint32_t index, NishGfxBindGroup *group);
/**
 * Set a vertex buffer of the pass. size 0 binds the rest of the buffer from
 * offset.
 *
 * @param pass the pass
 * @param slot the vertex buffer slot
 * @param buffer the buffer, or null
 * @param offset the byte offset into buffer
 * @param size the bytes bound, or 0 for the rest of the buffer
 */
void nishgfx_pass_set_vertex_buffer(NishGfxPass *pass, uint32_t slot, NishGfxBuffer *buffer, uint64_t offset,
                                    uint64_t size);
/**
 * Draw vertices with the pass's pipeline.
 *
 * @param pass the pass
 * @param vertices how many vertices to draw
 * @param instances how many instances to draw
 * @param first_vertex the first vertex's index
 * @param first_instance the first instance's index
 */
void nishgfx_pass_draw(NishGfxPass *pass, uint32_t vertices, uint32_t instances, uint32_t first_vertex,
                       uint32_t first_instance);
/**
 * End the pass and free it.
 *
 * @param pass the pass, freed by this call
 */
void nishgfx_pass_end(NishGfxPass *pass);

/* ---- offscreen --------------------------------------------------------- */

/**
 * A width x height RGBA8Unorm render target with readback; needs no window
 * and initialises no SDL video.
 *
 * @param device the device it lives on
 * @param width the width in pixels, 1 to 16384
 * @param height the height in pixels, 1 to 16384
 * @returns the target, or null for a side outside 1 to 16384 or when the
 *   device answers none
 */
NishGfxOffscreen *nishgfx_offscreen_create(NishGfxDevice *device, uint32_t width, uint32_t height);
/**
 * Release an offscreen target.
 *
 * @param offscreen the target to release
 */
void nishgfx_offscreen_release(NishGfxOffscreen *offscreen);
/**
 * The target's view, valid until the offscreen is released.
 *
 * @param offscreen the target
 * @returns the view, or null for a null target
 */
NishGfxView *nishgfx_offscreen_view(NishGfxOffscreen *offscreen);
/**
 * Copy the target's pixels, width * 4 bytes per row, top row first, into dst.
 *
 * @param offscreen the target to read
 * @param dst the buffer the pixels are copied into
 * @param cap the bytes dst holds
 * @returns 0; -1 when cap < width * height * 4 (dst untouched); -2 when the
 *   map fails (an error is queued on the device)
 */
int32_t nishgfx_offscreen_read(NishGfxOffscreen *offscreen, void *dst, size_t cap);

#ifdef __cplusplus
}
#endif

#endif /* NISH_GFX_H */
