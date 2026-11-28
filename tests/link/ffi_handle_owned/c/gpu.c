// WP89 S5a: a C library whose every release is counted, so the program can
// print the order its handle classes closed what they own. Each close appends
// one code to `events`: 100 + id for a device, 200 + id for a fence and
// 300 + size for a buffer.
#include <stdlib.h>

typedef struct { int id; } Device;
typedef struct { int size; } Buffer;

static int events[64];
static int count;
static int live;

static void note(int code) {
  if (count < 64) {
    events[count] = code;
  }
  count++;
}

Device *device_open(int id) {
  Device *d = malloc(sizeof *d);
  if (d != NULL) {
    d->id = id;
    live++;
  }
  return d;
}

int device_id(Device *d) { return d->id; }

void device_close(Device *d) {
  note(100 + d->id);
  live--;
  free(d);
}

int *fence_open(int id) {
  int *f = malloc(sizeof *f);
  if (f != NULL) {
    *f = id;
    live++;
  }
  return f;
}

void fence_close(int *fence) {
  note(200 + *fence);
  live--;
  free(fence);
}

Buffer *buffer_open(int size) {
  Buffer *b = malloc(sizeof *b);
  if (b != NULL) {
    b->size = size;
    live++;
  }
  return b;
}

int buffer_size(Buffer *b) { return b->size; }

void buffer_close(Buffer *b) {
  note(300 + b->size);
  live--;
  free(b);
}

int closed_count(void) { return count; }

int closed_at(int i) { return i >= 0 && i < count && i < 64 ? events[i] : -1; }

int live_count(void) { return live; }
