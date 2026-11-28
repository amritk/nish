/* Driver for ffi_handle_owned: hands out numbered handles (pointers into a
 * table), prints each open and each close, and calls each export. A handle
 * still open after an export returns is printed, so the expected output pins
 * one close per open and the order of the closes. */
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

#define SLOTS 8
static int numbers[SLOTS];
static int opened;

void *slot_open(void) {
  for (int i = 0; i < SLOTS; i++) {
    if (numbers[i] == 0) {
      numbers[i] = ++opened;
      printf(" o%d", numbers[i]);
      return &numbers[i];
    }
  }
  return NULL;
}

int32_t slot_close(void *p) {
  int *n = p;
  printf(" c%d", *n);
  *n = 0;
  return 0;
}

int32_t slot_read(void *p) { return *(int *)p * 10; }

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

int32_t pair(void);
int32_t stack(int32_t early);

int main(void) {
  settle("pair", pair());
  settle("stack 0", stack(0));
  settle("stack 1", stack(1));
  return 0;
}
