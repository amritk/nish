/* Driver for ffi_struct_read: `sample` is the C struct the Nish side copies
   with `readStruct`, laid out as its `declare class Sample`, and
   `overwriteSample` rewrites every field after the copies are made. `main`
   only calls `run`, which prints. */
#include <stdint.h>

int32_t run(void);

struct Sample {
  uint8_t tag;
  int64_t count;
  const char *name;
  double ratio;
};

static struct Sample sample = {7, 1234567890123, "first", 0.5};

void *samplePtr(void) {
  return &sample;
}

void overwriteSample(void) {
  sample.tag = 9;
  sample.count = -1;
  sample.name = "second";
  sample.ratio = 2.5;
}

int main(void) {
  return run();
}
