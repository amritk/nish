/* Driver for ffi_handle_shapes: hands out numbered handles (pointers into a
 * table), prints each open and each close, and calls each export. A close of
 * a handle not open, or a handle still open after an export returns, is
 * printed, so the expected output pins one close per open. */
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

#define SLOTS 8
static int numbers[SLOTS];
static int opened;

void *sure_open(void) {
  for (int i = 0; i < SLOTS; i++) {
    if (numbers[i] == 0) {
      numbers[i] = ++opened;
      printf(" o%d", numbers[i]);
      return &numbers[i];
    }
  }
  printf(" full");
  return &numbers[0];
}

static int release(void *p) {
  int *n = p;
  if (n < numbers || n >= numbers + SLOTS || *n == 0) {
    printf(" closed-twice");
    return -1;
  }
  int was = *n;
  *n = 0;
  return was;
}

int32_t sure_close(void *p) {
  int was = release(p);
  if (was > 0) {
    printf(" c%d", was);
  }
  return 0;
}

void quiet_close(void *p) {
  int was = release(p);
  if (was > 0) {
    printf(" v%d", was);
  }
}

void *maybe_open(int32_t fail) {
  if (fail != 0) {
    printf(" o-null");
    return NULL;
  }
  return sure_open();
}

/* Typed `CPtr` on the Nish side, so only the dispose's own test guards it. */
void *lying_open(int32_t fail) { return maybe_open(fail); }

int32_t maybe_close(void *p) {
  if (p == NULL) {
    printf(" c-null");
    return 0;
  }
  return sure_close(p);
}

int32_t peek(void *p) { return *(int *)p * 10; }

static void settle(const char *name, int32_t result) {
  int left = 0;
  for (int i = 0; i < SLOTS; i++) {
    if (numbers[i] != 0) {
      left++;
      numbers[i] = 0;
    }
  }
  printf(" | %s %d%s\n", name, result, left > 0 ? " left-open" : "");
  opened = 0;
}

int32_t sureEarly(int32_t k);
int32_t quietEarly(int32_t k);
int32_t maybeEither(int32_t fail);
int32_t lyingEither(int32_t fail);
int32_t beforeLoop(int32_t n);
int32_t bodyOrReturn(int32_t fail);

int main(void) {
  settle("sureEarly 1", sureEarly(1));
  settle("sureEarly 0", sureEarly(0));
  settle("quietEarly 1", quietEarly(1));
  settle("quietEarly 0", quietEarly(0));
  settle("maybeEither 0", maybeEither(0));
  settle("maybeEither 2", maybeEither(2));
  settle("lyingEither 0", lyingEither(0));
  settle("lyingEither 3", lyingEither(3));
  settle("beforeLoop 5", beforeLoop(5));
  settle("beforeLoop 0", beforeLoop(0));
  settle("bodyOrReturn 0", bodyOrReturn(0));
  settle("bodyOrReturn 4", bodyOrReturn(4));
  return 0;
}
