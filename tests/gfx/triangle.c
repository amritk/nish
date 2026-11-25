/*
 * tests/gfx/triangle.c: the shim draws a triangle offscreen and reads it back.
 *
 * Built and run by tests/gfx.js. It needs no window and no SDL video, so it
 * runs headless on lavapipe. Exit status: 0 drawn and checked; 77 no adapter
 * (the section prints SKIP); anything else a failure, with the reason on
 * stderr. A second pass provokes 20 validation errors and checks that the
 * device's ring kept 16 and counted 4 dropped.
 */
#include "nish-gfx.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

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
  if (nishgfx_offscreen_read(off, pixels, sizeof pixels - 1) != -1) return fail("a short buffer was not refused");
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

  nishgfx_offscreen_release(off);
  nishgfx_pipeline_release(pipeline);
  nishgfx_shader_release(shader);
  nishgfx_buffer_release(vb);
  nishgfx_device_release(dev);
  nishgfx_adapter_release(adapter);
  nishgfx_instance_release(inst);
  return 0;
}
