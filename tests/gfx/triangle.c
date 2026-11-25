/*
 * tests/gfx/triangle.c: the shim draws a triangle offscreen and reads it back.
 *
 * Built and run by tests/gfx.js. The draw needs no window, so it runs
 * headless on lavapipe. Exit status: 0 drawn and checked; 77 no adapter (the
 * section prints SKIP); anything else a failure, with the reason on stderr.
 * After the draw it checks the shim's bounds: a readback buffer one byte
 * short, an error message past 255 bytes and a drain into 8, 20 validation
 * errors into the 16-entry error ring, a 17th vertex attribute and bind group
 * entry, offscreen sizes of 0 and past the device's limit, 70 key presses
 * into the 64-entry event ring of a window on SDL's offscreen video driver,
 * and a resize to a negative width.
 */
#include "nish-gfx.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <SDL3/SDL.h>

#define W 64
#define H 64

static const char *wgsl =
    "struct Out { @builtin(position) pos: vec4f, @location(0) color: vec3f };\n"
    "@vertex fn vs(@location(0) p: vec2f, @location(1) c: vec3f) -> Out {\n"
    "  var o: Out; o.pos = vec4f(p, 0.0, 1.0); o.color = c; return o;\n"
    "}\n"
    "@fragment fn fs(i: Out) -> @location(0) vec4f { return vec4f(i.color, 1.0); }\n";

/* x, y, r, g, b: one red triangle covering the centre, not the corners. */
static const float vertices[] = {
    -0.5f, -0.5f, 1.0f, 0.0f, 0.0f,
     0.5f, -0.5f, 1.0f, 0.0f, 0.0f,
     0.0f,  0.5f, 1.0f, 0.0f, 0.0f,
};

static int fail(const char *what) {
  fprintf(stderr, "triangle: %s\n", what);
  return 1;
}

static int drain(NishGfxDevice *dev) {
  char msg[NISHGFX_ERROR_MESSAGE_MAX + 1];
  int n = 0, kind;
  while ((kind = nishgfx_error_next(dev, msg, sizeof msg)) != NISHGFX_ERROR_NONE) {
    fprintf(stderr, "triangle: device error %d: %s\n", kind, msg);
    n++;
  }
  return n;
}

int main(void) {
  NishGfxInstance *inst = nishgfx_instance_create();
  if (inst == NULL) return fail("no instance");
  NishGfxAdapter *adapter = nishgfx_adapter_request(inst, NULL, 0);
  if (adapter == NULL) {
    char msg[NISHGFX_ERROR_MESSAGE_MAX + 1] = "";
    nishgfx_instance_error_next(inst, msg, sizeof msg);
    printf("no adapter: %s\n", msg);
    nishgfx_instance_release(inst);
    return 77;
  }
  NishGfxDevice *dev = nishgfx_device_request(inst, adapter);
  if (dev == NULL) return fail("no device");

  NishGfxBufferDesc bd = {sizeof vertices, 0x20 /* Vertex */ | 0x8 /* CopyDst */, 0};
  NishGfxBuffer *vb = nishgfx_buffer_create(dev, &bd, "triangle");
  if (vb == NULL) return fail("no vertex buffer");
  nishgfx_queue_write(dev, vb, 0, vertices, sizeof vertices);

  NishGfxShader *shader = nishgfx_shader_create(dev, wgsl);
  if (shader == NULL) return fail("no shader");
  NishGfxPipelineDesc *pd = nishgfx_pipeline_desc_new(shader, "vs", "fs", 0x16 /* RGBA8Unorm */, 5 * sizeof(float));
  if (pd == NULL) return fail("no pipeline builder");
  nishgfx_pipeline_desc_attribute(pd, 0x1D /* Float32x2 */, 0, 0);
  nishgfx_pipeline_desc_attribute(pd, 0x1E /* Float32x3 */, 2 * sizeof(float), 1);
  NishGfxPipeline *pipeline = nishgfx_pipeline_create(dev, pd);
  if (pipeline == NULL) return fail("no pipeline");

  NishGfxOffscreen *off = nishgfx_offscreen_create(dev, W, H);
  if (off == NULL) return fail("no offscreen target");
  NishGfxEncoder *enc = nishgfx_encoder_create(dev);
  NishGfxPass *pass = nishgfx_pass_begin(enc, nishgfx_offscreen_view(off), 0, 0.0, 0.0, 1.0, 1.0);
  nishgfx_pass_set_pipeline(pass, pipeline);
  nishgfx_pass_set_vertex_buffer(pass, 0, vb, 0, 0);
  nishgfx_pass_draw(pass, 3, 1, 0, 0);
  nishgfx_pass_end(pass);
  nishgfx_encoder_submit(dev, enc);

  static unsigned char pixels[W * H * 4];
  memset(pixels, 0xa5, sizeof pixels);
  if (nishgfx_offscreen_read(off, pixels, sizeof pixels - 1) != -1) return fail("a short buffer was not refused");
  for (size_t i = 0; i < sizeof pixels; i++)
    if (pixels[i] != 0xa5) return fail("a short buffer was not refused");
  if (nishgfx_offscreen_read(off, pixels, sizeof pixels) != 0) return fail("readback failed");
  if (drain(dev) != 0) return fail("the draw queued errors");

  const unsigned char *centre = &pixels[(H / 2 * W + W / 2) * 4];
  const unsigned char *corner = &pixels[0];
  if (!(centre[0] == 255 && centre[1] == 0 && centre[2] == 0 && centre[3] == 255)) {
    fprintf(stderr, "triangle: centre is %u,%u,%u,%u, not red\n", centre[0], centre[1], centre[2], centre[3]);
    return 1;
  }
  if (!(corner[0] == 0 && corner[1] == 0 && corner[2] == 255 && corner[3] == 255)) {
    fprintf(stderr, "triangle: corner is %u,%u,%u,%u, not the blue clear\n", corner[0], corner[1], corner[2],
            corner[3]);
    return 1;
  }
  printf("triangle: centre red, corner blue\n");

  /* A shader naming an undefined 400-byte identifier: wgpu-native's message
   * quotes it, so the ring keeps exactly NISHGFX_ERROR_MESSAGE_MAX bytes, and
   * a drain into 8 bytes writes 7 and a NUL and nothing past them. */
  {
    char wgsl[600];
    int n = snprintf(wgsl, sizeof wgsl, "@vertex fn vs() -> @builtin(position) vec4f { return ");
    for (int i = 0; i < 400; i++) wgsl[n++] = 'q';
    snprintf(wgsl + n, sizeof wgsl - n, "; }\n");
    nishgfx_shader_release(nishgfx_shader_create(dev, wgsl));
    nishgfx_shader_release(nishgfx_shader_create(dev, wgsl));
    char kept_msg[NISHGFX_ERROR_MESSAGE_MAX + 2];
    memset(kept_msg, 'x', sizeof kept_msg);
    if (nishgfx_error_next(dev, kept_msg, sizeof kept_msg) != NISHGFX_ERROR_VALIDATION ||
        strlen(kept_msg) != NISHGFX_ERROR_MESSAGE_MAX)
      return fail("a long shader error was not kept at 255 bytes");
    char small[16];
    memset(small, 'x', sizeof small);
    if (nishgfx_error_next(dev, small, 8) != NISHGFX_ERROR_VALIDATION || strlen(small) != 7 || small[8] != 'x')
      return fail("a drain into 8 bytes wrote other than 7 and a NUL");
    if (drain(dev) != 0) return fail("the shader errors queued more than two reports");
    printf("triangle: a long error keeps 255 bytes, a drain into 8 keeps 7\n");
  }

  /* Each builder holds 16 entries and refuses the 17th. Building them is a
   * validation error (no such locations or group), drained here uncounted. */
  {
    NishGfxPipelineDesc *full = nishgfx_pipeline_desc_new(shader, "vs", "fs", 0x16 /* RGBA8Unorm */, 0);
    if (full == NULL) return fail("no pipeline builder");
    int taken = 0;
    for (uint32_t i = 0; i < 17; i++)
      if (nishgfx_pipeline_desc_attribute(full, 0x1D /* Float32x2 */, 0, i) == 0) taken++;
    nishgfx_pipeline_release(nishgfx_pipeline_create(dev, full));
    NishGfxBindGroupDesc *group = nishgfx_bind_group_desc_new(pipeline, 0);
    if (group == NULL) return fail("no bind group builder");
    int bound = 0;
    for (uint32_t i = 0; i < 17; i++)
      if (nishgfx_bind_group_desc_buffer(group, i, vb, 0, 4) == 0) bound++;
    nishgfx_bind_group_release(nishgfx_bind_group_create(dev, group));
    char skip[NISHGFX_ERROR_MESSAGE_MAX + 1];
    while (nishgfx_error_next(dev, skip, sizeof skip) != NISHGFX_ERROR_NONE) {
    }
    if (taken != 16 || bound != 16) {
      fprintf(stderr, "triangle: builders took %d attributes and %d bindings, not 16 and 16\n", taken, bound);
      return 1;
    }
    printf("triangle: builders took 16 attributes and 16 bindings\n");
  }

  /* One binding of size 0, the rest of the buffer: wgpu-native aborted the
   * process on it ("invalid size") before the shim mapped it to
   * WGPU_WHOLE_SIZE. The group is still invalid (the pipeline has no group
   * 0), a validation report drained here. */
  {
    NishGfxBindGroupDesc *group = nishgfx_bind_group_desc_new(pipeline, 0);
    if (group == NULL) return fail("no bind group builder");
    if (nishgfx_bind_group_desc_buffer(group, 0, vb, 0, 0) != 0) return fail("a size-0 binding was refused");
    nishgfx_bind_group_release(nishgfx_bind_group_create(dev, group));
    char skip[NISHGFX_ERROR_MESSAGE_MAX + 1];
    while (nishgfx_error_next(dev, skip, sizeof skip) != NISHGFX_ERROR_NONE) {
    }
    printf("triangle: a size-0 binding reached the device and the process lived\n");
  }

  /* The shim refuses 0 and anything past the device's own limit (Metal's
   * default is 8192, lavapipe's 16384) before wgpu-native sees it, and hands
   * the limit itself to the device, which makes the target. */
  {
    uint32_t max = nishgfx_device_max_texture_side(dev);
    if (max < 8192 || max > 16384) return fail("the device's max texture side is outside 8192..16384");
    if (nishgfx_offscreen_create(dev, max + 1, 1) != NULL || nishgfx_offscreen_create(dev, 1, max + 1) != NULL ||
        nishgfx_offscreen_create(dev, 0, 1) != NULL || nishgfx_offscreen_create(dev, 1, 0) != NULL)
      return fail("an offscreen size of 0 or past the device's limit was not refused");
    NishGfxOffscreen *edge = nishgfx_offscreen_create(dev, max, 1);
    if (edge == NULL) return fail("an offscreen target as wide as the device's limit was refused");
    nishgfx_offscreen_release(edge);
    if (drain(dev) != 0) return fail("an offscreen target as wide as the device's limit was a device error");
    printf("triangle: offscreen refuses 0 and the device's limit plus 1, makes the limit itself\n");
  }

  /* MapRead may only pair with CopyDst: each of these is a validation error. */
  NishGfxBufferDesc bad = {16, 0x1 /* MapRead */ | 0x20 /* Vertex */, 0};
  for (int i = 0; i < 20; i++) nishgfx_buffer_release(nishgfx_buffer_create(dev, &bad, NULL));
  char msg[NISHGFX_ERROR_MESSAGE_MAX + 1];
  int kept = 0;
  while (nishgfx_error_next(dev, msg, sizeof msg) == NISHGFX_ERROR_VALIDATION) kept++;
  unsigned dropped = nishgfx_errors_dropped(dev);
  if (kept != NISHGFX_ERROR_RING || dropped != 4) {
    fprintf(stderr, "triangle: error ring kept %d and dropped %u, not 16 and 4\n", kept, dropped);
    return 1;
  }
  printf("triangle: error ring kept 16, dropped 4\n");

  /* SDL's offscreen video driver: a window with no display. 70 key presses
   * reach a 64-entry ring, which keeps the first 64 and counts 6 dropped. */
  SDL_SetHint(SDL_HINT_VIDEO_DRIVER, "offscreen");
  NishGfxWindow *win = nishgfx_window_create("triangle", 64, 64);
  if (win == NULL) return fail("no offscreen window");
  nishgfx_events_poll(win);
  NishGfxEvent ev;
  while (nishgfx_event_next(win, &ev) != NISHGFX_EVENT_NONE) {
  }
  unsigned before = nishgfx_events_dropped(win);
  for (int i = 0; i < 70; i++) {
    SDL_Event key;
    SDL_zero(key);
    key.type = SDL_EVENT_KEY_DOWN;
    key.key.key = (SDL_Keycode)('a' + i % 26);
    if (!SDL_PushEvent(&key)) return fail("SDL refused a pushed key");
  }
  nishgfx_events_poll(win);
  int keys = 0, ordered = 1;
  while (nishgfx_event_next(win, &ev) == NISHGFX_EVENT_KEY_DOWN) {
    if (ev.key != (uint32_t)('a' + keys % 26)) ordered = 0;
    keys++;
  }
  unsigned lost = nishgfx_events_dropped(win) - before;
  if (keys != NISHGFX_EVENT_RING || lost != 6 || !ordered) {
    fprintf(stderr, "triangle: event ring kept %d (ordered %d) and dropped %u, not 64 and 6\n", keys, ordered, lost);
    return 1;
  }
  printf("triangle: event ring kept 64 in order, dropped 6\n");

  /* A pixel size SDL reports below zero reaches the program as 0. */
  {
    SDL_Event size;
    SDL_zero(size);
    size.type = SDL_EVENT_WINDOW_PIXEL_SIZE_CHANGED;
    size.window.data1 = -5;
    size.window.data2 = 7;
    if (!SDL_PushEvent(&size)) return fail("SDL refused a pushed resize");
    nishgfx_events_poll(win);
    uint32_t kind = NISHGFX_EVENT_NONE, w = 1, h = 0;
    while ((kind = nishgfx_event_next(win, &ev)) != NISHGFX_EVENT_NONE)
      if (kind == NISHGFX_EVENT_RESIZED) {
        w = ev.width;
        h = ev.height;
      }
    if (w != 0 || h != 7) {
      fprintf(stderr, "triangle: a resize to -5 x 7 reached the ring as %u x %u, not 0 x 7\n", w, h);
      return 1;
    }
    printf("triangle: a resize to -5 x 7 reads 0 x 7\n");
  }
  nishgfx_window_release(win);

  nishgfx_offscreen_release(off);
  nishgfx_pipeline_release(pipeline);
  nishgfx_shader_release(shader);
  nishgfx_buffer_release(vb);
  nishgfx_device_release(dev);
  nishgfx_adapter_release(adapter);
  nishgfx_instance_release(inst);
  return 0;
}
