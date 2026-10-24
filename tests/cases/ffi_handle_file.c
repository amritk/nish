/* Driver for ffi_handle_file: writes the file every `File` opens, wraps fopen
 * and fclose to number each open and print each close, and calls each export.
 * A second close of one FILE, or a FILE still open after an export returns, is
 * printed, so the expected output pins one close per open. Under WASI
 * (tests/ffi-handle.js) there is no /tmp and no getpid, so each open reads the
 * same three bytes from memory instead. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#ifndef __wasi__
#include <unistd.h>
#endif

#define SLOTS 8
static char path[64];
static FILE *open_files[SLOTS];
static int numbers[SLOTS];
static int opened;

FILE *counted_fopen(const char *name, const char *mode) {
  (void)name;
#ifdef __wasi__
  FILE *f = fmemopen((void *)"ABC", 3, mode);
#else
  FILE *f = fopen(path, mode);
#endif
  for (int i = 0; i < SLOTS; i++) {
    if (open_files[i] == NULL) {
      open_files[i] = f;
      numbers[i] = ++opened;
      printf(" o%d", numbers[i]);
      return f;
    }
  }
  printf(" full");
  return f;
}

int32_t counted_fclose(FILE *f) {
  for (int i = 0; i < SLOTS; i++) {
    if (open_files[i] == f) {
      printf(" c%d", numbers[i]);
      open_files[i] = NULL;
      return fclose(f);
    }
  }
  printf(" closed-twice");
  return -1;
}

static void settle(const char *name, int32_t result) {
  int left = 0;
  for (int i = 0; i < SLOTS; i++) {
    if (open_files[i] != NULL) {
      left++;
      fclose(open_files[i]);
      open_files[i] = NULL;
    }
  }
  printf(" | %s %d%s\n", name, result, left > 0 ? " left-open" : "");
  opened = 0;
}

int32_t fallThrough(void);
int32_t early(int32_t k);
int32_t loop(int32_t n);
int32_t pairOf(int32_t fail);
int32_t doubled(int32_t n);
int32_t doubledBare(int32_t n);
int32_t lent(void);
int32_t counted(void);

int main(void) {
#ifndef __wasi__
  snprintf(path, sizeof path, "/tmp/nish-ffi-handle-%d", (int)getpid());
  FILE *w = fopen(path, "w");
  if (w == NULL || fputs("ABC", w) < 0 || fclose(w) != 0) {
    return 1;
  }
#endif
  settle("fallThrough", fallThrough());
  settle("early 1", early(1));
  settle("early 0", early(0));
  settle("loop 5", loop(5));
  settle("pairOf 0", pairOf(0));
  settle("pairOf 3", pairOf(3));
  settle("doubled 21", doubled(21));
  settle("doubledBare 4", doubledBare(4));
  settle("lent", lent());
  settle("counted", counted());
#ifndef __wasi__
  remove(path);
#endif
  return 0;
}
