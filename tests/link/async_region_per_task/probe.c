/* Each spawned task owns a region (runtime/runtime-async.c,
   runtime/runtime-region.c): the executor enters it whenever the task runs,
   leaves it when the task suspends and frees it when the task finishes. Two
   tasks take turns allocating, as two tasks interleaved at their awaits do:
   neither allocation lands in `main`'s arena, each survives the other task's
   turn untouched, and each finished task gives its region back. */
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "../../../runtime/nish.h"

static char big[1 << 20];

/* A string of `n` copies of `c`, in whichever arena is current. */
static nish_str *fill(char c, uint64_t n) {
  memset(big, c, n);
  return nish_str_new(big, n);
}

static int all(const nish_str *s, char c) {
  for (uint64_t i = 0; i < s->len; i++)
    if (s->data[i] != c) return 0;
  return 1;
}

int main(void) {
  struct nish_arena before = nish_arena;
  void *a = nish_async_spawn(0, 16);
  void *b = nish_async_spawn(0, 16);
  printf("live after two spawns: %d\n", nish_async_stat(2));

  void *prev = nish_async_enter(a);
  nish_str *sa = fill('a', sizeof big);
  void *arena_a = nish_arena.buf;
  int own = arena_a != before.buf;
  nish_async_leave(a, prev);

  prev = nish_async_enter(b);
  nish_str *sb = fill('b', sizeof big);
  own = own && nish_arena.buf != before.buf && nish_arena.buf != arena_a;
  nish_async_leave(b, prev);
  printf("each task allocates in an arena of its own: %s\n", own ? "yes" : "no");

  int untouched = nish_arena.buf == before.buf && nish_arena.off == before.off;
  printf("main's arena is as it was: %s\n", untouched ? "yes" : "no");

  prev = nish_async_enter(a);
  printf("a's string survives b's turn: %s\n", all(sa, 'a') ? "yes" : "no");
  nish_async_leave(a, prev);
  nish_async_done(a);
  printf("live after a finishes: %d\n", nish_async_stat(2));

  prev = nish_async_enter(b);
  printf("b's string survives a's end: %s\n", all(sb, 'b') ? "yes" : "no");
  nish_async_leave(b, prev);
  nish_async_done(b);
  printf("live after b finishes: %d\n", nish_async_stat(2));

  void *c = nish_async_spawn(0, 16);
  prev = nish_async_enter(c);
  nish_str *sc = fill('c', 64);
  nish_async_leave(c, prev);
  nish_async_done(c);
  printf("a reused node gets a fresh region: %s\n", c == a || c == b ? (sc->len == 64 ? "yes" : "no") : "no");
  return 0;
}
