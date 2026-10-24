/* Driver for ffi_handle_exits: writes the file every `File` opens, wraps fopen
 * and fclose to number each open and print each close, and calls each export.
 * A second close of one FILE, or a FILE still open after an export returns, is
 * printed, so the expected output pins one close per open. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#define SLOTS 8
static char path[64];
static FILE *open_files[SLOTS];
static int numbers[SLOTS];
static int opened;

FILE *counted_fopen(const char *name, const char *mode) {
  (void)name;
  FILE *f = fopen(path, mode);
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

int32_t nested(int32_t k);
int32_t whileBody(int32_t n);
int32_t built(void);
int32_t specialised(void);
int32_t passed(int32_t n);

int main(void) {
  snprintf(path, sizeof path, "/tmp/nish-ffi-handle-%d", (int)getpid());
  FILE *w = fopen(path, "w");
  if (w == NULL || fputs("ABC", w) < 0 || fclose(w) != 0) {
    return 1;
  }
  settle("nested 0", nested(0));
  settle("nested 1", nested(1));
  settle("nested 2", nested(2));
  settle("whileBody 3", whileBody(3));
  settle("built", built());
  settle("specialised", specialised());
  settle("passed 5", passed(5));
  remove(path);
  return 0;
}
