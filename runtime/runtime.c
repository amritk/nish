/* Nish runtime: arena + strings + cold paths. Layouts are ABI (runtime.ts, nish.h).
 *
 * The half of the runtime every program touches whatever it does, which is why
 * it is also the half with the tighter size budget: the arena, strings, number
 * formatting, the array cold paths, `process.argv`, `Math.random`, and the two
 * panics. Files, directories, subprocesses, the environment and the clock are
 * in runtime-os.c — every one of those wraps a system call, so that surface
 * grows as the language reaches further into the operating system, and a
 * program that reaches nowhere should not pay for it or be measured with it.
 * runtime-os.c's header comment has the reasoning; tests/run.js gates the two
 * `.text*` budgets separately and docs/wp7-runtime.md records both.
 *
 * Nothing here calls into runtime-os.c, which is why an old link line that
 * names runtime.c alone still builds a program that uses none of that surface.
 * The other direction does happen: `nish_readdir` allocates through
 * `nish_alloc_struct` and `nish_str_new`, so those calls no longer inline into
 * it without LTO. Measured in docs/wp7-runtime.md; the speed and size profiles
 * both use `-flto`, and the cold paths that lost the inlining are cold.
 */
#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <inttypes.h>
#include <math.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#ifdef __wasi__
/* No pids on WASI: clock nanoseconds salt the RNG seed instead. */
static int nish_wasi_salt(void) { struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts); return ts.tv_nsec; }
#define getpid nish_wasi_salt
/* wasi-libc's `_start` calls `__main_argc_argv` (clang's name for a C `main`); the IR entry is
 * `main`. Weak, so a reactor build without an entry links. */
__attribute__((weak)) int nish_c_main(int, char **) __asm__("main");
int __main_argc_argv(int argc, char **argv) { return nish_c_main(argc, argv); }
#endif

#define NISH_COLD __attribute__((noreturn, cold, noinline))

/* ---- AddressSanitizer build (`-DNISH_ASAN`, tests/differential/asan.js)
   A bump arena hides every overflow from ASan: one 64 KB malloc holds many
   blocks, so a read past one block lands in the next and nothing is poisoned.
   Under `NISH_ASAN` each arena block is a malloc of its own (`nish_asan_alloc`,
   which asan.js also points compiled code's inline bump at), so a read one past
   it hits ASan's redzone; the bytes the 8-byte rounding adds, an array's spare
   capacity and an array's block left behind by growth are poisoned by hand.
   Off, the macro is empty and the file compiles to the same object code it
   always did. What it cannot see: a `pop` leaves the popped element
   addressable below `cap` (the pop is inline IR), and a string's NUL is one
   addressable byte past its `length`. `nish_arena_used` reads differently
   under ASan, since every block is a chunk of its own. */
#ifdef NISH_ASAN
#include <sanitizer/asan_interface.h>
#define NISH_POISON(p, n) __asan_poison_memory_region((p), (n))
#else
#define NISH_POISON(p, n) ((void)0)
#endif

/* ---- Thread-local state (WP20 T0)
   The arena and the RNG seed are the only mutable process-wide objects here,
   and both are a data race the moment a second thread runs compiled code. With
   `-DNISH_THREADS` each thread gets its own, which is what `nish --threads`
   compiles against: the flag makes the compiler emit `@nish_arena` as a
   `thread_local(initialexec)` global, and a build that disagreed with this
   file would not link at all, because ELF refuses a non-TLS reference to a TLS
   definition. Off by default so the ordinary build pays nothing.

   The same definition is in runtime/nish.h (for a host that includes it) and
   runtime/runtime-wasm.c; they are one contract and move together. */
#ifdef NISH_THREADS
#define NISH_TLS _Thread_local
#else
#define NISH_TLS
#endif

/* ---- Arena: %struct.nish_arena = type { i8*, i64, i64, i8* }

   The widths are fixed rather than `size_t` for the reason runtime-wasm.c
   gives for its own copy: every compiled function inlines the bump allocator
   and reads these fields directly, so the IR's `i64` is what `off` and `cap`
   have to be on every target, not just the 64-bit ones. With `size_t` they
   were four bytes each under wasm32 and the inlined fast path bumped an
   offset that was really `cap`, then compared it against memory past the end
   of the global — a wild pointer on the wasi profile for any program that
   allocates from compiled code. The asserts below are the contract, checked
   wherever this file is compiled. */
typedef struct nish_chunk { struct nish_chunk *next; uint64_t cap; } nish_chunk;
/* runtime-cross.c walks the chunks through a copy of this definition, which
   asserts the same three facts. */
_Static_assert(sizeof(nish_chunk) == 16, "runtime-cross.c's nish_xchunk: { next, cap }, the bytes after it");
_Static_assert(offsetof(nish_chunk, next) == 0, "runtime-cross.c's nish_xchunk: next first");
_Static_assert(offsetof(nish_chunk, cap) == 8, "runtime-cross.c's nish_xchunk: cap second");
struct nish_arena { char *buf; uint64_t off; uint64_t cap; nish_chunk *chunks; };
/* One per thread under -DNISH_THREADS, one per process otherwise; the layout is
   the same either way, which is why nothing else in this file has to know. */
NISH_TLS struct nish_arena nish_arena;

_Static_assert(sizeof(struct nish_arena) == 32, "arena layout is ABI: runtime.ts, nish.h");
_Static_assert(offsetof(struct nish_arena, off) == 8, "the inlined allocator bumps field 1");
_Static_assert(offsetof(struct nish_arena, cap) == 16, "the inlined allocator reads field 2");
_Static_assert(offsetof(struct nish_arena, chunks) == 24, "arena layout is ABI");

/* ---- Panics: the first one wins.

   Every way a program fails -- a failed check, `panic`, out of memory -- calls
   `nish_panic_claim` before it prints. Two tasks of a scope, or two workers of
   a parallel map, can fail at once, and without the claim both messages would
   reach stderr interleaved and both threads would race to the exit. The first
   to claim prints its whole message and exits; any later one parks until
   that exit ends the process, so exactly one message is printed and the exit
   code is the first panic's. How each path exits is unchanged by the claim:
   `panic`, `expect` and a failed range entry (`nish_panic`) call `exit(1)`, as
   they did through `nish_exit`, so atexit handlers run and stdio is flushed;
   a failed check and out of memory call `_exit(1)`, as they always have. Only
   one thread can reach either exit, because the claim comes first. Only a
   threads build (`-DNISH_THREADS`) can have two threads panic, so only it
   pays for the claim; everywhere else it is an empty inline function. Under wasi with threads, the trap is the
   defensive answer: no host there gives a parked thread a way to wait. */
#ifdef NISH_THREADS
static int nish_panicked;
void nish_panic_claim(void) {
  if (__atomic_exchange_n(&nish_panicked, 1, __ATOMIC_ACQ_REL)) {
#if defined(__wasi__)
    __builtin_trap();
#else
    for (;;) pause();
#endif
  }
}
#else
static inline void nish_panic_claim(void) {}
#endif

/* How a panic that skips atexit ends: `_exit(1)`, after `nish_fatal_hook` when
   it is set. `setRawMode(true)` and `setTerminalRestore` (runtime-term.c) set
   the hook to the terminal's restore, and without it a failed bounds check
   would leave the shell in raw mode. Each
   panic path calls this where it called `_exit(1)`, so a call site costs no
   more than it did; `exit(1)` paths need nothing, since the restore is also an
   atexit handler. Built with `-DNISH_FUZZ_ABORT` (scripts/fuzz.sh), this and
   `nish_panic` end in `abort()` instead, so libFuzzer records a panic, a failed
   bounds or division check and an out-of-memory as a crash; the default build
   compiles neither. */
__attribute__((noreturn)) void nish_fatal_exit(void);
void (*nish_fatal_hook)(void);
void nish_fatal_exit(void) {
  void (*hook)(void) = __atomic_load_n(&nish_fatal_hook, __ATOMIC_ACQUIRE);
  if (hook) hook();
#ifdef NISH_FUZZ_ABORT
  abort();
#endif
  _exit(1);
}

/* The message goes out through `nish_write_all`, below, which finishes a
   short write and retries one a signal interrupts (docs/security/runtime.md,
   RT-11); it is unbuffered, so the message leaves before `_exit`. It used
   `fputs`, whose libc loop finishes a short write but gives up on `EINTR`. */
static void nish_write_all(int fd, const char *p, uint64_t n);
static NISH_COLD void nish_die(const char *msg) {
  nish_panic_claim();
  nish_write_all(2, msg, strlen(msg));
  nish_fatal_exit();
}
/* A function rather than a macro around `nish_die`: seven call sites each
   loading the message's address cost more than one more symbol does. */
static NISH_COLD void nish_oom(void) { nish_die("nish: out of memory\n"); }

/* The most elements an array and the most bytes a string may hold: see
   `nish_array_grow` and `nish_str_concat`. */
#define NISH_ARRAY_MAX 2147483647u

/* Slow path (size 8-byte rounded): push a chunk (>= 64 KB), bump from it. */
void *nish_arena_grow(uint64_t size) {
#ifdef NISH_ASAN
  /* An exact chunk leaves off == cap, so the inline bump never fits again and
     every block comes through here: one malloc, one redzone, per block. */
  uint64_t cap = size;
#else
  uint64_t cap = size > 65536 ? size : 65536;
#endif
  /* A 64-bit request cannot always be asked for: wasm32's `size_t` is 32 bits,
     and malloc would silently take the low half of a chunk nobody can address. */
  if (cap > (uint64_t)(SIZE_MAX - sizeof(nish_chunk))) nish_oom();
  nish_chunk *c = malloc(sizeof *c + (size_t)cap);
  if (!c) nish_oom();
  c->next = nish_arena.chunks;
  c->cap = cap;
  nish_arena.chunks = c;
  nish_arena.buf = (char *)(c + 1);
  nish_arena.off = size;
  nish_arena.cap = cap;
  return nish_arena.buf;
}

#ifdef NISH_ASAN
/* An instrumented program's every arena block: an exact chunk, so the inline
   bump never fits again, with the bytes the rounding adds poisoned. */
void *nish_asan_alloc(uint64_t size) {
  uint64_t rounded = (size + 7) & ~(uint64_t)7;
  char *p = nish_arena_grow(rounded);
  NISH_POISON(p + size, rounded - size);
  return p;
}
#endif

/* Bump allocation, 8-byte rounded/aligned, uninitialised; the compiler inlines it. */
void *nish_alloc_struct(uint64_t size) {
#ifdef NISH_ASAN
  return nish_asan_alloc(size);
#endif
  size = (size + 7) & ~(uint64_t)7;
  if (nish_arena.off + size <= nish_arena.cap) {
    void *p = nish_arena.buf + nish_arena.off;
    nish_arena.off += size;
    return p;
  }
  return nish_arena_grow(size);
}

#ifdef NISH_ASAN
/* The capacity a normal build would give each array `nish_array_grow` grew.
   `cap` stays `len + 1`, since the push writes `data[len]` inline and spare
   capacity would be addressable, but growing one slot at a time copies the
   whole array on every push. So a block is allocated at the capacity a normal
   build would choose, its tail poisoned, and each later grow of the same array
   unpoisons one more slot in place until that capacity is used up. The block
   then moves at exactly the push where a normal build reallocates, so a
   pointer kept across that push reads poison.
   The table is keyed by the grown block and loses an entry only when that
   block dies: the grow that moves it, or `nish_free_until` freeing its chunk
   (every ASan block is a chunk of its own). It is one table for every thread,
   behind a spin lock, so an array grown on one thread and pushed on another
   still hits. A miss is therefore an array no grow has moved yet, whose `cap`
   is the one a normal build gave it, so the block never moves late. Open
   addressing, linear probes, a tombstone for a dead entry, rebuilt at half
   full. */
#define NISH_GROWN_DEAD ((char *)1)
static struct nish_grown { char *data; const void *owner; uint64_t native; } *nish_grown;
static uint64_t nish_grown_cap, nish_grown_used, nish_grown_live; /* used = live + tombstones */
static int nish_grown_lock;

static void nish_grown_enter(void) {
  while (__atomic_exchange_n(&nish_grown_lock, 1, __ATOMIC_ACQUIRE)) {}
}
static void nish_grown_leave(void) { __atomic_store_n(&nish_grown_lock, 0, __ATOMIC_RELEASE); }

static uint64_t nish_grown_hash(const char *data) {
  return ((uintptr_t)data * 0x9E3779B97F4A7C15ull >> 32) & (nish_grown_cap - 1);
}

static struct nish_grown *nish_grown_find(const char *data) {
  if (!nish_grown_cap || !data) return 0;
  for (uint64_t i = nish_grown_hash(data);; i = (i + 1) & (nish_grown_cap - 1)) {
    if (nish_grown[i].data == data) return &nish_grown[i];
    if (!nish_grown[i].data) return 0;
  }
}

static void nish_grown_drop(const char *data) {
  struct nish_grown *g = nish_grown_find(data);
  if (g) g->data = NISH_GROWN_DEAD, nish_grown_live--;
}

static void nish_grown_put(char *data, const void *owner, uint64_t native) {
  if ((nish_grown_used + 1) * 2 > nish_grown_cap) {
    struct nish_grown *old = nish_grown;
    uint64_t n = nish_grown_cap, cap = 64;
    while (cap < (nish_grown_live + 1) * 4) cap *= 2;
    nish_grown = calloc(cap, sizeof *nish_grown);
    if (!nish_grown) nish_oom();
    nish_grown_cap = cap, nish_grown_used = nish_grown_live = 0;
    for (uint64_t i = 0; i < n; i++)
      if (old[i].data > NISH_GROWN_DEAD) nish_grown_put(old[i].data, old[i].owner, old[i].native);
    free(old);
  }
  uint64_t i = nish_grown_hash(data);
  while (nish_grown[i].data > NISH_GROWN_DEAD) i = (i + 1) & (nish_grown_cap - 1);
  if (!nish_grown[i].data) nish_grown_used++;
  nish_grown[i] = (struct nish_grown){ data, owner, native };
  nish_grown_live++;
}
#endif
#ifdef NISH_ASAN
void nish_free_arena(void);
#endif
static void nish_free_until(nish_chunk *c, const nish_chunk *end) {
#ifdef NISH_ASAN
  /* A freed block's address comes back from malloc: forget the grown ones. */
  if (nish_grown_live) {
    nish_grown_enter();
    for (nish_chunk *d = c; d != end; d = d->next) nish_grown_drop((char *)(d + 1));
    nish_grown_leave();
  }
#endif
  while (c != end) { nish_chunk *n = c->next; free(c); c = n; }
}

/* O(1) recycle: keep the newest chunk, free the rest. */
void nish_reset_arena(void) {
#ifdef NISH_ASAN
  /* Free everything, so a value read after the reset is a use after free. */
  nish_free_arena();
  return;
#endif
  nish_chunk *keep = nish_arena.chunks;
  if (!keep) return;
  nish_free_until(keep->next, 0);
  keep->next = 0;
  nish_arena.off = 0;
}

void nish_free_arena(void) {
  nish_free_until(nish_arena.chunks, 0);
  memset(&nish_arena, 0, sizeof nish_arena);
}

/* ---- Scopes: mark = buf + off (0 while empty); release rewinds, freeing newer chunks. */
uint64_t nish_arena_mark(void) {
  return nish_arena.buf ? (uintptr_t)(nish_arena.buf + nish_arena.off) : 0;
}
uint64_t nish_arena_used(void) { return nish_arena.off; }

void nish_arena_release(uint64_t mark) {
  nish_chunk *c = nish_arena.chunks;
  if (!mark) { nish_reset_arena(); return; }
  for (; c; c = c->next) {
    uintptr_t base = (uintptr_t)(c + 1);
    if (mark >= base && mark <= base + c->cap) break;
  }
  if (!c) return;
  nish_free_until(nish_arena.chunks, c);
  nish_arena = (struct nish_arena){ (char *)(c + 1), mark - (uintptr_t)(c + 1), c->cap, c };
}

/* Release back to `mark` while keeping the newest allocation; returns where it
   ended up. `p` must be the last block the arena handed out, which is why only
   a *string* may be kept: it is one flat block with no interior pointers, so
   moving its bytes moves the whole value. Two outcomes, both reclaiming only
   memory bumped after `mark` and before `p`:
     - the mark's chunk has room below it: `p` moves down to `mark` and every
       newer chunk is freed;
     - it does not (the mark sat at the end of a full chunk): `p` stays where
       it is and the chunks strictly between the two are freed.
   The guards refuse instead, which only means less is reclaimed: `p` outside
   the current chunk (a literal, or a value older than the mark), a mark in no
   live chunk (a stale one, or 0 for an arena that was empty), or a mark newer
   than `p`. */
void *nish_arena_keep(uint64_t mark, void *p) {
  uintptr_t base = (uintptr_t)nish_arena.buf, q = (uintptr_t)p, top = base + nish_arena.off;
  if (q < base || q >= top || mark == q) return p;
  size_t size = top - q;
  nish_chunk *pc = nish_arena.chunks, *c = pc; /* pc holds `p`: it is the current chunk */
  for (; c; c = c->next) {
    uintptr_t cb = (uintptr_t)(c + 1);
    if (mark >= cb && mark <= cb + c->cap) break;
  }
  if (!c || (c == pc && mark > q)) return p;
  /* mark <= q inside one chunk implies mark + size <= q + size <= its end, so
     the second arm is only ever reached with `c` older than `pc`. */
  if (mark + size <= (uintptr_t)(c + 1) + c->cap) {
    memmove((void *)mark, p, size);
    nish_free_until(pc, c);
    nish_arena = (struct nish_arena){ (char *)(c + 1), mark + size - (uintptr_t)(c + 1), c->cap, c };
    return (void *)mark;
  }
  nish_free_until(pc->next, c);
  pc->next = c;
  return p;
}

/* ---- Strings: { i64 len, bytes[len], '\0' }, immutable; 8 = the len header */
typedef struct { uint64_t len; char data[]; } nish_str;

nish_str *nish_str_new(const char *bytes, uint64_t len) {
  nish_str *s = nish_alloc_struct(8 + len + 1);
  s->len = len;
  if (len) memcpy(s->data, bytes, len);
  s->data[len] = 0;
  return s;
}

/* A string never passes 2^31 - 1 bytes, for the reason an array never passes
   that many elements (`NISH_ARRAY_MAX`, below): under --number-mode i32 a
   longer one's `length` reads back negative and bounds-check elimination
   trusts it (docs/security/runtime.md, RT-2). `a + b` past it fails as an
   allocation does. */
nish_str *nish_str_concat(const nish_str *a, const nish_str *b) {
  uint64_t len = a->len + b->len;
  if (len > NISH_ARRAY_MAX) nish_oom();
  nish_str *s = nish_alloc_struct(8 + len + 1);
  s->len = len;
  memcpy(s->data, a->data, a->len);
  memcpy(s->data + a->len, b->data, b->len);
  s->data[len] = 0;
  return s;
}

_Bool nish_str_eq(const nish_str *a, const nish_str *b) {
  return a == b || (a->len == b->len && memcmp(a->data, b->data, a->len) == 0);
}

uint64_t nish_str_len(const nish_str *s) { return s->len; }

/* `s.startsWith(sub)` is at 0, `s.endsWith(sub)` at len - sub->len, which is
   negative when `sub` is the longer string. */
_Bool nish_str_at(const nish_str *s, int64_t at, const nish_str *sub) {
  return at >= 0 && (uint64_t)at + sub->len <= s->len && !memcmp(s->data + at, sub->data, sub->len);
}
/* `s.indexOf(sub)`: the first byte offset where `sub` occurs, or -1. An empty
   needle answers 0 and a needle longer than the haystack -1, both of which are
   what JavaScript says and what the inline loop this replaces did.

   This was lowered inline, one `nish_str_at` per offset, to keep `runtime.c`
   small. That cost a byte-at-a-time scan — 53.7 ms over 52 MB of haystack —
   and WP15 section 7's rule is that the budget yields to a measured win, so the
   search moved here: `memchr` finds a candidate first byte and `memcmp`
   confirms it, both the libc's vectorised routines. 2.9 ms, or 3.1 ms when the
   needle starts with a byte the haystack is full of.

   `memmem` is deliberately not used, and costs little: 2.5 ms on the same two
   measurements. It is a GNU extension glibc hides behind `_GNU_SOURCE`, and
   defining that here makes `<string.h>` pull in `<strings.h>` — which any `-I`
   directory holding a file of that name then shadows. This project generates
   exactly such a header from `examples/strings.ts`, and the interop tests
   caught runtime.c picking it up and inheriting `nish.h` through it. A C host
   would hit the same. A fifth of the time is not worth making the runtime
   sensitive to its includer's `-I` paths.

   `s.indexOf(sub, from)` is the same search from byte `from`, and
   `s.indexOf(sub)` is it from 0: one loop, not two. The compiler clamps `from`
   into [0, s.length] first, as JavaScript does, with `llvm.smin`/`smax` where
   LLVM can fold them, so the clamp costs this file nothing; an empty needle
   answers that clamped `from`. The clamp is a precondition: a caller that
   skips it never reads outside the string, but gets -1 for a non-empty needle
   (a negative `from` reads as one past the end) and `from` itself, unchanged,
   for an empty one. */
int64_t nish_str_index_of_from(const nish_str *s, const nish_str *sub, int64_t from) {
  uint64_t at = (uint64_t)from;
  if (sub->len == 0) return from;
  while (at <= s->len && sub->len <= s->len - at) {
    const char *c = memchr(s->data + at, sub->data[0], s->len - at - sub->len + 1);
    if (!c) break;
    at = (uint64_t)(c - s->data);
    if (memcmp(c + 1, sub->data + 1, sub->len - 1) == 0) return (int64_t)at;
    at++;
  }
  return -1;
}
int64_t nish_str_index_of(const nish_str *s, const nish_str *sub) { return nish_str_index_of_from(s, sub, 0); }

/* `console.log` / `console.error` / `write` / `writeError` and the message of
   `panic`: fd 1 or 2, with or without the trailing newline.

   A pipe or a socket can take part of a long string and answer the count it
   took: a signal that lands mid-write ends the call early, and a full pipe
   does the same. So the bytes are written until all of them are out, or until
   a write fails (docs/security/runtime.md, RT-11). A failure still ends the
   output, `EAGAIN` on a non-blocking stdout included, since spinning on it
   would burn a core. `EINTR` is retried, the newline's included: the only
   handlers this runtime installs that return (runtime-host.c's and
   runtime-term.c's SIGTSTP) have `SA_RESTART`, but a C host may install one
   without it. `panic`'s message, `expect`'s, and the
   arithmetic and out-of-memory panics (`nish_die`) are written here. The
   index and slice panics and the file and entropy failures use `dprintf`, and
   runtime-parallel.c's out of memory one `write`: neither retries `EINTR`. */
static void nish_write_all(int fd, const char *p, uint64_t n) {
  uint64_t done = 0;
  ssize_t k;
  while (done < n) {
    k = write(fd, p + done, n - done);
    if (k > 0) done += k;
    else if (k == 0 || errno != EINTR) break;
  }
}
void nish_write(const nish_str *s, int32_t fd, _Bool newline) {
  nish_write_all(fd, s->data, s->len);
  if (newline) nish_write_all(fd, "\n", 1);
}
/* console.log(s) */
void nish_print(const nish_str *s) { nish_write(s, 1, 1); }
/* `panic(message)`, `r.expect(message)` and a failed range entry: the message
   and a newline on stderr, then `exit(1)`, the first panic only. */
__attribute__((noreturn)) void nish_panic(const nish_str *s) {
  nish_panic_claim();
  nish_write(s, 2, 1);
#ifdef NISH_FUZZ_ABORT
  abort();
#endif
  exit(1);
}

/* Decimal digits of `u`, with a '-' in front when `neg`. 20 digits is the
   widest a uint64_t can be, plus the sign. */
static nish_str *str_from_digits(uint64_t u, int neg) {
  char tmp[21], *p = tmp + 21;
  do { *--p = '0' + u % 10; u /= 10; } while (u);
  if (neg) *--p = '-';
  return nish_str_new(p, tmp + 21 - p);
}

nish_str *nish_str_from_i64(int64_t v) {
  return str_from_digits(v < 0 ? -(uint64_t)v : (uint64_t)v, v < 0);
}
nish_str *nish_str_from_i32(int32_t v) { return nish_str_from_i64(v); }
/* The one unsigned formatter (WP15): u8/u16/u32 are zero-extended by the
   caller, so 0xFFFFFFFF prints as 4294967295 rather than -1. */
nish_str *nish_str_from_u64(uint64_t v) { return str_from_digits(v, 0); }


/* ---- Shortest round-trip digits (Zmij)

   Adapted from Zmij (https://github.com/vitaut/zmij), zmij.c. Copyright (c)
   2025 - present, Victor Zverovich. Used under the Boost Software License,
   Version 1.0 (upstream offers MIT or BSL-1.0); see runtime/LICENSE-zmij. The
   code from here to the end of `nish_shortest_digits` follows upstream's
   `umul192_hi128`, `umul128_add_hi64`, `compute_dec_exp`, `compute_exp_shift`
   and the scalar `to_decimal_double`, which is why it keeps their constants;
   the table is regenerated by scripts/gen-pow10-table.py rather than copied.
   Only the digit computation is taken: no SIMD, and none of upstream's own
   formatting, since the layout below is ECMAScript's rather than printf's.

   `String(x)` in JavaScript prints the *fewest* digits that read back as the
   same double, and the language promises that spelling. Reaching it by asking
   snprintf for k digits and strtod whether they round-trip is both slow and,
   less obviously, *wrong*: printf can only hand back the correctly-rounded
   k-digit string, and for some values the shortest string that round-trips at
   that length is a different one (7.120236347223045e-307 is the pinned case).

   Zmij (a Schubfach descendant) gets there with one 64x128-bit multiply: it
   scales the value by a power of ten chosen so the integer part is the shorter
   of the two candidate lengths, decides from the fractional part whether that
   candidate already lies inside the rounding interval, and otherwise reads one
   more digit off the fraction. Ryu, which this replaced, needed three
   multiplies and a loop of divisions. Read upstream before touching the
   arithmetic: `315653 >> 20`, `217707 >> 16` and the `+6` bias are exact over
   the exponents a double can have and verified there, not in general. */
/* Generated by scripts/gen-pow10-table.py; do not hand-edit. 10^-293 to 10^323. */
#define NISH_POW10_MIN (-293)
static const uint64_t NISH_POW10_SIG[617][2] = {
  { 0xcc5fc196fefd7d0cu, 0x1e53ed49a96272c8u },
  { 0xff77b1fcbebcdc4fu, 0x25e8e89c13bb0f7au },
  { 0x9faacf3df73609b1u, 0x77b191618c54e9acu },
  { 0xc795830d75038c1du, 0xd59df5b9ef6a2417u },
  { 0xf97ae3d0d2446f25u, 0x4b0573286b44ad1du },
  { 0x9becce62836ac577u, 0x4ee367f9430aec32u },
  { 0xc2e801fb244576d5u, 0x229c41f793cda73fu },
  { 0xf3a20279ed56d48au, 0x6b43527578c1110fu },
  { 0x9845418c345644d6u, 0x830a13896b78aaa9u },
  { 0xbe5691ef416bd60cu, 0x23cc986bc656d553u },
  { 0xedec366b11c6cb8fu, 0x2cbfbe86b7ec8aa8u },
  { 0x94b3a202eb1c3f39u, 0x7bf7d71432f3d6a9u },
  { 0xb9e08a83a5e34f07u, 0xdaf5ccd93fb0cc53u },
  { 0xe858ad248f5c22c9u, 0xd1b3400f8f9cff68u },
  { 0x91376c36d99995beu, 0x23100809b9c21fa1u },
  { 0xb58547448ffffb2du, 0xabd40a0c2832a78au },
  { 0xe2e69915b3fff9f9u, 0x16c90c8f323f516cu },
  { 0x8dd01fad907ffc3bu, 0xae3da7d97f6792e3u },
  { 0xb1442798f49ffb4au, 0x99cd11cfdf41779cu },
  { 0xdd95317f31c7fa1du, 0x40405643d711d583u },
  { 0x8a7d3eef7f1cfc52u, 0x482835ea666b2572u },
  { 0xad1c8eab5ee43b66u, 0xda3243650005eecfu },
  { 0xd863b256369d4a40u, 0x90bed43e40076a82u },
  { 0x873e4f75e2224e68u, 0x5a7744a6e804a291u },
  { 0xa90de3535aaae202u, 0x711515d0a205cb36u },
  { 0xd3515c2831559a83u, 0x0d5a5b44ca873e03u },
  { 0x8412d9991ed58091u, 0xe858790afe9486c2u },
  { 0xa5178fff668ae0b6u, 0x626e974dbe39a872u },
  { 0xce5d73ff402d98e3u, 0xfb0a3d212dc8128fu },
  { 0x80fa687f881c7f8eu, 0x7ce66634bc9d0b99u },
  { 0xa139029f6a239f72u, 0x1c1fffc1ebc44e80u },
  { 0xc987434744ac874eu, 0xa327ffb266b56220u },
  { 0xfbe9141915d7a922u, 0x4bf1ff9f0062baa8u },
  { 0x9d71ac8fada6c9b5u, 0x6f773fc3603db4a9u },
  { 0xc4ce17b399107c22u, 0xcb550fb4384d21d3u },
  { 0xf6019da07f549b2bu, 0x7e2a53a146606a48u },
  { 0x99c102844f94e0fbu, 0x2eda7444cbfc426du },
  { 0xc0314325637a1939u, 0xfa911155fefb5308u },
  { 0xf03d93eebc589f88u, 0x793555ab7eba27cau },
  { 0x96267c7535b763b5u, 0x4bc1558b2f3458deu },
  { 0xbbb01b9283253ca2u, 0x9eb1aaedfb016f16u },
  { 0xea9c227723ee8bcbu, 0x465e15a979c1cadcu },
  { 0x92a1958a7675175fu, 0x0bfacd89ec191ec9u },
  { 0xb749faed14125d36u, 0xcef980ec671f667bu },
  { 0xe51c79a85916f484u, 0x82b7e12780e7401au },
  { 0x8f31cc0937ae58d2u, 0xd1b2ecb8b0908810u },
  { 0xb2fe3f0b8599ef07u, 0x861fa7e6dcb4aa15u },
  { 0xdfbdcece67006ac9u, 0x67a791e093e1d49au },
  { 0x8bd6a141006042bdu, 0xe0c8bb2c5c6d24e0u },
  { 0xaecc49914078536du, 0x58fae9f773886e18u },
  { 0xda7f5bf590966848u, 0xaf39a475506a899eu },
  { 0x888f99797a5e012du, 0x6d8406c952429603u },
  { 0xaab37fd7d8f58178u, 0xc8e5087ba6d33b83u },
  { 0xd5605fcdcf32e1d6u, 0xfb1e4a9a90880a64u },
  { 0x855c3be0a17fcd26u, 0x5cf2eea09a55067fu },
  { 0xa6b34ad8c9dfc06fu, 0xf42faa48c0ea481eu },
  { 0xd0601d8efc57b08bu, 0xf13b94daf124da26u },
  { 0x823c12795db6ce57u, 0x76c53d08d6b70858u },
  { 0xa2cb1717b52481edu, 0x54768c4b0c64ca6eu },
  { 0xcb7ddcdda26da268u, 0xa9942f5dcf7dfd09u },
  { 0xfe5d54150b090b02u, 0xd3f93b35435d7c4cu },
  { 0x9efa548d26e5a6e1u, 0xc47bc5014a1a6dafu },
  { 0xc6b8e9b0709f109au, 0x359ab6419ca1091bu },
  { 0xf867241c8cc6d4c0u, 0xc30163d203c94b62u },
  { 0x9b407691d7fc44f8u, 0x79e0de63425dcf1du },
  { 0xc21094364dfb5636u, 0x985915fc12f542e4u },
  { 0xf294b943e17a2bc4u, 0x3e6f5b7b17b2939du },
  { 0x979cf3ca6cec5b5au, 0xa705992ceecf9c42u },
  { 0xbd8430bd08277231u, 0x50c6ff782a838353u },
  { 0xece53cec4a314ebdu, 0xa4f8bf5635246428u },
  { 0x940f4613ae5ed136u, 0x871b7795e136be99u },
  { 0xb913179899f68584u, 0x28e2557b59846e3fu },
  { 0xe757dd7ec07426e5u, 0x331aeada2fe589cfu },
  { 0x9096ea6f3848984fu, 0x3ff0d2c85def7621u },
  { 0xb4bca50b065abe63u, 0x0fed077a756b53a9u },
  { 0xe1ebce4dc7f16dfbu, 0xd3e8495912c62894u },
  { 0x8d3360f09cf6e4bdu, 0x64712dd7abbbd95cu },
  { 0xb080392cc4349decu, 0xbd8d794d96aacfb3u },
  { 0xdca04777f541c567u, 0xecf0d7a0fc5583a0u },
  { 0x89e42caaf9491b60u, 0xf41686c49db57244u },
  { 0xac5d37d5b79b6239u, 0x311c2875c522ced5u },
  { 0xd77485cb25823ac7u, 0x7d633293366b828bu },
  { 0x86a8d39ef77164bcu, 0xae5dff9c02033197u },
  { 0xa8530886b54dbdebu, 0xd9f57f830283fdfcu },
  { 0xd267caa862a12d66u, 0xd072df63c324fd7bu },
  { 0x8380dea93da4bc60u, 0x4247cb9e59f71e6du },
  { 0xa46116538d0deb78u, 0x52d9be85f074e608u },
  { 0xcd795be870516656u, 0x67902e276c921f8bu },
  { 0x806bd9714632dff6u, 0x00ba1cd8a3db53b6u },
  { 0xa086cfcd97bf97f3u, 0x80e8a40eccd228a4u },
  { 0xc8a883c0fdaf7df0u, 0x6122cd128006b2cdu },
  { 0xfad2a4b13d1b5d6cu, 0x796b805720085f81u },
  { 0x9cc3a6eec6311a63u, 0xcbe3303674053bb0u },
  { 0xc3f490aa77bd60fcu, 0xbedbfc4411068a9cu },
  { 0xf4f1b4d515acb93bu, 0xee92fb5515482d44u },
  { 0x991711052d8bf3c5u, 0x751bdd152d4d1c4au },
  { 0xbf5cd54678eef0b6u, 0xd262d45a78a0635du },
  { 0xef340a98172aace4u, 0x86fb897116c87c34u },
  { 0x9580869f0e7aac0eu, 0xd45d35e6ae3d4da0u },
  { 0xbae0a846d2195712u, 0x8974836059cca109u },
  { 0xe998d258869facd7u, 0x2bd1a438703fc94bu },
  { 0x91ff83775423cc06u, 0x7b6306a34627ddcfu },
  { 0xb67f6455292cbf08u, 0x1a3bc84c17b1d542u },
  { 0xe41f3d6a7377eecau, 0x20caba5f1d9e4a93u },
  { 0x8e938662882af53eu, 0x547eb47b7282ee9cu },
  { 0xb23867fb2a35b28du, 0xe99e619a4f23aa43u },
  { 0xdec681f9f4c31f31u, 0x6405fa00e2ec94d4u },
  { 0x8b3c113c38f9f37eu, 0xde83bc408dd3dd04u },
  { 0xae0b158b4738705eu, 0x9624ab50b148d445u },
  { 0xd98ddaee19068c76u, 0x3badd624dd9b0957u },
  { 0x87f8a8d4cfa417c9u, 0xe54ca5d70a80e5d6u },
  { 0xa9f6d30a038d1dbcu, 0x5e9fcf4ccd211f4cu },
  { 0xd47487cc8470652bu, 0x7647c3200069671fu },
  { 0x84c8d4dfd2c63f3bu, 0x29ecd9f40041e073u },
  { 0xa5fb0a17c777cf09u, 0xf468107100525890u },
  { 0xcf79cc9db955c2ccu, 0x7182148d4066eeb4u },
  { 0x81ac1fe293d599bfu, 0xc6f14cd848405530u },
  { 0xa21727db38cb002fu, 0xb8ada00e5a506a7cu },
  { 0xca9cf1d206fdc03bu, 0xa6d90811f0e4851cu },
  { 0xfd442e4688bd304au, 0x908f4a166d1da663u },
  { 0x9e4a9cec15763e2eu, 0x9a598e4e043287feu },
  { 0xc5dd44271ad3cdbau, 0x40eff1e1853f29fdu },
  { 0xf7549530e188c128u, 0xd12bee59e68ef47cu },
  { 0x9a94dd3e8cf578b9u, 0x82bb74f8301958ceu },
  { 0xc13a148e3032d6e7u, 0xe36a52363c1faf01u },
  { 0xf18899b1bc3f8ca1u, 0xdc44e6c3cb279ac1u },
  { 0x96f5600f15a7b7e5u, 0x29ab103a5ef8c0b9u },
  { 0xbcb2b812db11a5deu, 0x7415d448f6b6f0e7u },
  { 0xebdf661791d60f56u, 0x111b495b3464ad21u },
  { 0x936b9fcebb25c995u, 0xcab10dd900beec34u },
  { 0xb84687c269ef3bfbu, 0x3d5d514f40eea742u },
  { 0xe65829b3046b0afau, 0x0cb4a5a3112a5112u },
  { 0x8ff71a0fe2c2e6dcu, 0x47f0e785eaba72abu },
  { 0xb3f4e093db73a093u, 0x59ed216765690f56u },
  { 0xe0f218b8d25088b8u, 0x306869c13ec3532cu },
  { 0x8c974f7383725573u, 0x1e414218c73a13fbu },
  { 0xafbd2350644eeacfu, 0xe5d1929ef90898fau },
  { 0xdbac6c247d62a583u, 0xdf45f746b74abf39u },
  { 0x894bc396ce5da772u, 0x6b8bba8c328eb783u },
  { 0xab9eb47c81f5114fu, 0x066ea92f3f326564u },
  { 0xd686619ba27255a2u, 0xc80a537b0efefebdu },
  { 0x8613fd0145877585u, 0xbd06742ce95f5f36u },
  { 0xa798fc4196e952e7u, 0x2c48113823b73704u },
  { 0xd17f3b51fca3a7a0u, 0xf75a15862ca504c5u },
  { 0x82ef85133de648c4u, 0x9a984d73dbe722fbu },
  { 0xa3ab66580d5fdaf5u, 0xc13e60d0d2e0ebbau },
  { 0xcc963fee10b7d1b3u, 0x318df905079926a8u },
  { 0xffbbcfe994e5c61fu, 0xfdf17746497f7052u },
  { 0x9fd561f1fd0f9bd3u, 0xfeb6ea8bedefa633u },
  { 0xc7caba6e7c5382c8u, 0xfe64a52ee96b8fc0u },
  { 0xf9bd690a1b68637bu, 0x3dfdce7aa3c673b0u },
  { 0x9c1661a651213e2du, 0x06bea10ca65c084eu },
  { 0xc31bfa0fe5698db8u, 0x486e494fcff30a62u },
  { 0xf3e2f893dec3f126u, 0x5a89dba3c3efccfau },
  { 0x986ddb5c6b3a76b7u, 0xf89629465a75e01cu },
  { 0xbe89523386091465u, 0xf6bbb397f1135823u },
  { 0xee2ba6c0678b597fu, 0x746aa07ded582e2cu },
  { 0x94db483840b717efu, 0xa8c2a44eb4571cdcu },
  { 0xba121a4650e4ddebu, 0x92f34d62616ce413u },
  { 0xe896a0d7e51e1566u, 0x77b020baf9c81d17u },
  { 0x915e2486ef32cd60u, 0x0ace1474dc1d122eu },
  { 0xb5b5ada8aaff80b8u, 0x0d819992132456bau },
  { 0xe3231912d5bf60e6u, 0x10e1fff697ed6c69u },
  { 0x8df5efabc5979c8fu, 0xca8d3ffa1ef463c1u },
  { 0xb1736b96b6fd83b3u, 0xbd308ff8a6b17cb2u },
  { 0xddd0467c64bce4a0u, 0xac7cb3f6d05ddbdeu },
  { 0x8aa22c0dbef60ee4u, 0x6bcdf07a423aa96bu },
  { 0xad4ab7112eb3929du, 0x86c16c98d2c953c6u },
  { 0xd89d64d57a607744u, 0xe871c7bf077ba8b7u },
  { 0x87625f056c7c4a8bu, 0x11471cd764ad4972u },
  { 0xa93af6c6c79b5d2du, 0xd598e40d3dd89bcfu },
  { 0xd389b47879823479u, 0x4aff1d108d4ec2c3u },
  { 0x843610cb4bf160cbu, 0xcedf722a585139bau },
  { 0xa54394fe1eedb8feu, 0xc2974eb4ee658828u },
  { 0xce947a3da6a9273eu, 0x733d226229feea32u },
  { 0x811ccc668829b887u, 0x0806357d5a3f525fu },
  { 0xa163ff802a3426a8u, 0xca07c2dcb0cf26f7u },
  { 0xc9bcff6034c13052u, 0xfc89b393dd02f0b5u },
  { 0xfc2c3f3841f17c67u, 0xbbac2078d443ace2u },
  { 0x9d9ba7832936edc0u, 0xd54b944b84aa4c0du },
  { 0xc5029163f384a931u, 0x0a9e795e65d4df11u },
  { 0xf64335bcf065d37du, 0x4d4617b5ff4a16d5u },
  { 0x99ea0196163fa42eu, 0x504bced1bf8e4e45u },
  { 0xc06481fb9bcf8d39u, 0xe45ec2862f71e1d6u },
  { 0xf07da27a82c37088u, 0x5d767327bb4e5a4cu },
  { 0x964e858c91ba2655u, 0x3a6a07f8d510f86fu },
  { 0xbbe226efb628afeau, 0x890489f70a55368bu },
  { 0xeadab0aba3b2dbe5u, 0x2b45ac74ccea842eu },
  { 0x92c8ae6b464fc96fu, 0x3b0b8bc90012929du },
  { 0xb77ada0617e3bbcbu, 0x09ce6ebb40173744u },
  { 0xe55990879ddcaabdu, 0xcc420a6a101d0515u },
  { 0x8f57fa54c2a9eab6u, 0x9fa946824a12232du },
  { 0xb32df8e9f3546564u, 0x47939822dc96abf9u },
  { 0xdff9772470297ebdu, 0x59787e2b93bc56f7u },
  { 0x8bfbea76c619ef36u, 0x57eb4edb3c55b65au },
  { 0xaefae51477a06b03u, 0xede622920b6b23f1u },
  { 0xdab99e59958885c4u, 0xe95fab368e45ecedu },
  { 0x88b402f7fd75539bu, 0x11dbcb0218ebb414u },
  { 0xaae103b5fcd2a881u, 0xd652bdc29f26a119u },
  { 0xd59944a37c0752a2u, 0x4be76d3346f0495fu },
  { 0x857fcae62d8493a5u, 0x6f70a4400c562ddbu },
  { 0xa6dfbd9fb8e5b88eu, 0xcb4ccd500f6bb952u },
  { 0xd097ad07a71f26b2u, 0x7e2000a41346a7a7u },
  { 0x825ecc24c873782fu, 0x8ed400668c0c28c8u },
  { 0xa2f67f2dfa90563bu, 0x728900802f0f32fau },
  { 0xcbb41ef979346bcau, 0x4f2b40a03ad2ffb9u },
  { 0xfea126b7d78186bcu, 0xe2f610c84987bfa8u },
  { 0x9f24b832e6b0f436u, 0x0dd9ca7d2df4d7c9u },
  { 0xc6ede63fa05d3143u, 0x91503d1c79720dbbu },
  { 0xf8a95fcf88747d94u, 0x75a44c6397ce912au },
  { 0x9b69dbe1b548ce7cu, 0xc986afbe3ee11abau },
  { 0xc24452da229b021bu, 0xfbe85badce996168u },
  { 0xf2d56790ab41c2a2u, 0xfae27299423fb9c3u },
  { 0x97c560ba6b0919a5u, 0xdccd879fc967d41au },
  { 0xbdb6b8e905cb600fu, 0x5400e987bbc1c920u },
  { 0xed246723473e3813u, 0x290123e9aab23b68u },
  { 0x9436c0760c86e30bu, 0xf9a0b6720aaf6521u },
  { 0xb94470938fa89bceu, 0xf808e40e8d5b3e69u },
  { 0xe7958cb87392c2c2u, 0xb60b1d1230b20e04u },
  { 0x90bd77f3483bb9b9u, 0xb1c6f22b5e6f48c2u },
  { 0xb4ecd5f01a4aa828u, 0x1e38aeb6360b1af3u },
  { 0xe2280b6c20dd5232u, 0x25c6da63c38de1b0u },
  { 0x8d590723948a535fu, 0x579c487e5a38ad0eu },
  { 0xb0af48ec79ace837u, 0x2d835a9df0c6d851u },
  { 0xdcdb1b2798182244u, 0xf8e431456cf88e65u },
  { 0x8a08f0f8bf0f156bu, 0x1b8e9ecb641b58ffu },
  { 0xac8b2d36eed2dac5u, 0xe272467e3d222f3fu },
  { 0xd7adf884aa879177u, 0x5b0ed81dcc6abb0fu },
  { 0x86ccbb52ea94baeau, 0x98e947129fc2b4e9u },
  { 0xa87fea27a539e9a5u, 0x3f2398d747b36224u },
  { 0xd29fe4b18e88640eu, 0x8eec7f0d19a03aadu },
  { 0x83a3eeeef9153e89u, 0x1953cf68300424acu },
  { 0xa48ceaaab75a8e2bu, 0x5fa8c3423c052dd7u },
  { 0xcdb02555653131b6u, 0x3792f412cb06794du },
  { 0x808e17555f3ebf11u, 0xe2bbd88bbee40bd0u },
  { 0xa0b19d2ab70e6ed6u, 0x5b6aceaeae9d0ec4u },
  { 0xc8de047564d20a8bu, 0xf245825a5a445275u },
  { 0xfb158592be068d2eu, 0xeed6e2f0f0d56712u },
  { 0x9ced737bb6c4183du, 0x55464dd69685606bu },
  { 0xc428d05aa4751e4cu, 0xaa97e14c3c26b886u },
  { 0xf53304714d9265dfu, 0xd53dd99f4b3066a8u },
  { 0x993fe2c6d07b7fabu, 0xe546a8038efe4029u },
  { 0xbf8fdb78849a5f96u, 0xde98520472bdd033u },
  { 0xef73d256a5c0f77cu, 0x963e66858f6d4440u },
  { 0x95a8637627989aadu, 0xdde7001379a44aa8u },
  { 0xbb127c53b17ec159u, 0x5560c018580d5d52u },
  { 0xe9d71b689dde71afu, 0xaab8f01e6e10b4a6u },
  { 0x9226712162ab070du, 0xcab3961304ca70e8u },
  { 0xb6b00d69bb55c8d1u, 0x3d607b97c5fd0d22u },
  { 0xe45c10c42a2b3b05u, 0x8cb89a7db77c506au },
  { 0x8eb98a7a9a5b04e3u, 0x77f3608e92adb242u },
  { 0xb267ed1940f1c61cu, 0x55f038b237591ed3u },
  { 0xdf01e85f912e37a3u, 0x6b6c46dec52f6688u },
  { 0x8b61313bbabce2c6u, 0x2323ac4b3b3da015u },
  { 0xae397d8aa96c1b77u, 0xabec975e0a0d081au },
  { 0xd9c7dced53c72255u, 0x96e7bd358c904a21u },
  { 0x881cea14545c7575u, 0x7e50d64177da2e54u },
  { 0xaa242499697392d2u, 0xdde50bd1d5d0b9e9u },
  { 0xd4ad2dbfc3d07787u, 0x955e4ec64b44e864u },
  { 0x84ec3c97da624ab4u, 0xbd5af13bef0b113eu },
  { 0xa6274bbdd0fadd61u, 0xecb1ad8aeacdd58eu },
  { 0xcfb11ead453994bau, 0x67de18eda5814af2u },
  { 0x81ceb32c4b43fcf4u, 0x80eacf948770ced7u },
  { 0xa2425ff75e14fc31u, 0xa1258379a94d028du },
  { 0xcad2f7f5359a3b3eu, 0x096ee45813a04330u },
  { 0xfd87b5f28300ca0du, 0x8bca9d6e188853fcu },
  { 0x9e74d1b791e07e48u, 0x775ea264cf55347du },
  { 0xc612062576589ddau, 0x95364afe032a819du },
  { 0xf79687aed3eec551u, 0x3a83ddbd83f52204u },
  { 0x9abe14cd44753b52u, 0xc4926a9672793542u },
  { 0xc16d9a0095928a27u, 0x75b7053c0f178293u },
  { 0xf1c90080baf72cb1u, 0x5324c68b12dd6338u },
  { 0x971da05074da7beeu, 0xd3f6fc16ebca5e03u },
  { 0xbce5086492111aeau, 0x88f4bb1ca6bcf584u },
  { 0xec1e4a7db69561a5u, 0x2b31e9e3d06c32e5u },
  { 0x9392ee8e921d5d07u, 0x3aff322e62439fcfu },
  { 0xb877aa3236a4b449u, 0x09befeb9fad487c2u },
  { 0xe69594bec44de15bu, 0x4c2ebe687989a9b3u },
  { 0x901d7cf73ab0acd9u, 0x0f9d37014bf60a10u },
  { 0xb424dc35095cd80fu, 0x538484c19ef38c94u },
  { 0xe12e13424bb40e13u, 0x2865a5f206b06fb9u },
  { 0x8cbccc096f5088cbu, 0xf93f87b7442e45d3u },
  { 0xafebff0bcb24aafeu, 0xf78f69a51539d748u },
  { 0xdbe6fecebdedd5beu, 0xb573440e5a884d1bu },
  { 0x89705f4136b4a597u, 0x31680a88f8953030u },
  { 0xabcc77118461cefcu, 0xfdc20d2b36ba7c3du },
  { 0xd6bf94d5e57a42bcu, 0x3d32907604691b4cu },
  { 0x8637bd05af6c69b5u, 0xa63f9a49c2c1b10fu },
  { 0xa7c5ac471b478423u, 0x0fcf80dc33721d53u },
  { 0xd1b71758e219652bu, 0xd3c36113404ea4a8u },
  { 0x83126e978d4fdf3bu, 0x645a1cac083126e9u },
  { 0xa3d70a3d70a3d70au, 0x3d70a3d70a3d70a3u },
  { 0xccccccccccccccccu, 0xccccccccccccccccu },
  { 0x8000000000000000u, 0x0000000000000000u },
  { 0xa000000000000000u, 0x0000000000000000u },
  { 0xc800000000000000u, 0x0000000000000000u },
  { 0xfa00000000000000u, 0x0000000000000000u },
  { 0x9c40000000000000u, 0x0000000000000000u },
  { 0xc350000000000000u, 0x0000000000000000u },
  { 0xf424000000000000u, 0x0000000000000000u },
  { 0x9896800000000000u, 0x0000000000000000u },
  { 0xbebc200000000000u, 0x0000000000000000u },
  { 0xee6b280000000000u, 0x0000000000000000u },
  { 0x9502f90000000000u, 0x0000000000000000u },
  { 0xba43b74000000000u, 0x0000000000000000u },
  { 0xe8d4a51000000000u, 0x0000000000000000u },
  { 0x9184e72a00000000u, 0x0000000000000000u },
  { 0xb5e620f480000000u, 0x0000000000000000u },
  { 0xe35fa931a0000000u, 0x0000000000000000u },
  { 0x8e1bc9bf04000000u, 0x0000000000000000u },
  { 0xb1a2bc2ec5000000u, 0x0000000000000000u },
  { 0xde0b6b3a76400000u, 0x0000000000000000u },
  { 0x8ac7230489e80000u, 0x0000000000000000u },
  { 0xad78ebc5ac620000u, 0x0000000000000000u },
  { 0xd8d726b7177a8000u, 0x0000000000000000u },
  { 0x878678326eac9000u, 0x0000000000000000u },
  { 0xa968163f0a57b400u, 0x0000000000000000u },
  { 0xd3c21bcecceda100u, 0x0000000000000000u },
  { 0x84595161401484a0u, 0x0000000000000000u },
  { 0xa56fa5b99019a5c8u, 0x0000000000000000u },
  { 0xcecb8f27f4200f3au, 0x0000000000000000u },
  { 0x813f3978f8940984u, 0x4000000000000000u },
  { 0xa18f07d736b90be5u, 0x5000000000000000u },
  { 0xc9f2c9cd04674edeu, 0xa400000000000000u },
  { 0xfc6f7c4045812296u, 0x4d00000000000000u },
  { 0x9dc5ada82b70b59du, 0xf020000000000000u },
  { 0xc5371912364ce305u, 0x6c28000000000000u },
  { 0xf684df56c3e01bc6u, 0xc732000000000000u },
  { 0x9a130b963a6c115cu, 0x3c7f400000000000u },
  { 0xc097ce7bc90715b3u, 0x4b9f100000000000u },
  { 0xf0bdc21abb48db20u, 0x1e86d40000000000u },
  { 0x96769950b50d88f4u, 0x1314448000000000u },
  { 0xbc143fa4e250eb31u, 0x17d955a000000000u },
  { 0xeb194f8e1ae525fdu, 0x5dcfab0800000000u },
  { 0x92efd1b8d0cf37beu, 0x5aa1cae500000000u },
  { 0xb7abc627050305adu, 0xf14a3d9e40000000u },
  { 0xe596b7b0c643c719u, 0x6d9ccd05d0000000u },
  { 0x8f7e32ce7bea5c6fu, 0xe4820023a2000000u },
  { 0xb35dbf821ae4f38bu, 0xdda2802c8a800000u },
  { 0xe0352f62a19e306eu, 0xd50b2037ad200000u },
  { 0x8c213d9da502de45u, 0x4526f422cc340000u },
  { 0xaf298d050e4395d6u, 0x9670b12b7f410000u },
  { 0xdaf3f04651d47b4cu, 0x3c0cdd765f114000u },
  { 0x88d8762bf324cd0fu, 0xa5880a69fb6ac800u },
  { 0xab0e93b6efee0053u, 0x8eea0d047a457a00u },
  { 0xd5d238a4abe98068u, 0x72a4904598d6d880u },
  { 0x85a36366eb71f041u, 0x47a6da2b7f864750u },
  { 0xa70c3c40a64e6c51u, 0x999090b65f67d924u },
  { 0xd0cf4b50cfe20765u, 0xfff4b4e3f741cf6du },
  { 0x82818f1281ed449fu, 0xbff8f10e7a8921a4u },
  { 0xa321f2d7226895c7u, 0xaff72d52192b6a0du },
  { 0xcbea6f8ceb02bb39u, 0x9bf4f8a69f764490u },
  { 0xfee50b7025c36a08u, 0x02f236d04753d5b4u },
  { 0x9f4f2726179a2245u, 0x01d762422c946590u },
  { 0xc722f0ef9d80aad6u, 0x424d3ad2b7b97ef5u },
  { 0xf8ebad2b84e0d58bu, 0xd2e0898765a7deb2u },
  { 0x9b934c3b330c8577u, 0x63cc55f49f88eb2fu },
  { 0xc2781f49ffcfa6d5u, 0x3cbf6b71c76b25fbu },
  { 0xf316271c7fc3908au, 0x8bef464e3945ef7au },
  { 0x97edd871cfda3a56u, 0x97758bf0e3cbb5acu },
  { 0xbde94e8e43d0c8ecu, 0x3d52eeed1cbea317u },
  { 0xed63a231d4c4fb27u, 0x4ca7aaa863ee4bddu },
  { 0x945e455f24fb1cf8u, 0x8fe8caa93e74ef6au },
  { 0xb975d6b6ee39e436u, 0xb3e2fd538e122b44u },
  { 0xe7d34c64a9c85d44u, 0x60dbbca87196b616u },
  { 0x90e40fbeea1d3a4au, 0xbc8955e946fe31cdu },
  { 0xb51d13aea4a488ddu, 0x6babab6398bdbe41u },
  { 0xe264589a4dcdab14u, 0xc696963c7eed2dd1u },
  { 0x8d7eb76070a08aecu, 0xfc1e1de5cf543ca2u },
  { 0xb0de65388cc8ada8u, 0x3b25a55f43294bcbu },
  { 0xdd15fe86affad912u, 0x49ef0eb713f39ebeu },
  { 0x8a2dbf142dfcc7abu, 0x6e3569326c784337u },
  { 0xacb92ed9397bf996u, 0x49c2c37f07965404u },
  { 0xd7e77a8f87daf7fbu, 0xdc33745ec97be906u },
  { 0x86f0ac99b4e8dafdu, 0x69a028bb3ded71a3u },
  { 0xa8acd7c0222311bcu, 0xc40832ea0d68ce0cu },
  { 0xd2d80db02aabd62bu, 0xf50a3fa490c30190u },
  { 0x83c7088e1aab65dbu, 0x792667c6da79e0fau },
  { 0xa4b8cab1a1563f52u, 0x577001b891185938u },
  { 0xcde6fd5e09abcf26u, 0xed4c0226b55e6f86u },
  { 0x80b05e5ac60b6178u, 0x544f8158315b05b4u },
  { 0xa0dc75f1778e39d6u, 0x696361ae3db1c721u },
  { 0xc913936dd571c84cu, 0x03bc3a19cd1e38e9u },
  { 0xfb5878494ace3a5fu, 0x04ab48a04065c723u },
  { 0x9d174b2dcec0e47bu, 0x62eb0d64283f9c76u },
  { 0xc45d1df942711d9au, 0x3ba5d0bd324f8394u },
  { 0xf5746577930d6500u, 0xca8f44ec7ee36479u },
  { 0x9968bf6abbe85f20u, 0x7e998b13cf4e1ecbu },
  { 0xbfc2ef456ae276e8u, 0x9e3fedd8c321a67eu },
  { 0xefb3ab16c59b14a2u, 0xc5cfe94ef3ea101eu },
  { 0x95d04aee3b80ece5u, 0xbba1f1d158724a12u },
  { 0xbb445da9ca61281fu, 0x2a8a6e45ae8edc97u },
  { 0xea1575143cf97226u, 0xf52d09d71a3293bdu },
  { 0x924d692ca61be758u, 0x593c2626705f9c56u },
  { 0xb6e0c377cfa2e12eu, 0x6f8b2fb00c77836cu },
  { 0xe498f455c38b997au, 0x0b6dfb9c0f956447u },
  { 0x8edf98b59a373fecu, 0x4724bd4189bd5eacu },
  { 0xb2977ee300c50fe7u, 0x58edec91ec2cb657u },
  { 0xdf3d5e9bc0f653e1u, 0x2f2967b66737e3edu },
  { 0x8b865b215899f46cu, 0xbd79e0d20082ee74u },
  { 0xae67f1e9aec07187u, 0xecd8590680a3aa11u },
  { 0xda01ee641a708de9u, 0xe80e6f4820cc9495u },
  { 0x884134fe908658b2u, 0x3109058d147fdcddu },
  { 0xaa51823e34a7eedeu, 0xbd4b46f0599fd415u },
  { 0xd4e5e2cdc1d1ea96u, 0x6c9e18ac7007c91au },
  { 0x850fadc09923329eu, 0x03e2cf6bc604ddb0u },
  { 0xa6539930bf6bff45u, 0x84db8346b786151cu },
  { 0xcfe87f7cef46ff16u, 0xe612641865679a63u },
  { 0x81f14fae158c5f6eu, 0x4fcb7e8f3f60c07eu },
  { 0xa26da3999aef7749u, 0xe3be5e330f38f09du },
  { 0xcb090c8001ab551cu, 0x5cadf5bfd3072cc5u },
  { 0xfdcb4fa002162a63u, 0x73d9732fc7c8f7f6u },
  { 0x9e9f11c4014dda7eu, 0x2867e7fddcdd9afau },
  { 0xc646d63501a1511du, 0xb281e1fd541501b8u },
  { 0xf7d88bc24209a565u, 0x1f225a7ca91a4226u },
  { 0x9ae757596946075fu, 0x3375788de9b06958u },
  { 0xc1a12d2fc3978937u, 0x0052d6b1641c83aeu },
  { 0xf209787bb47d6b84u, 0xc0678c5dbd23a49au },
  { 0x9745eb4d50ce6332u, 0xf840b7ba963646e0u },
  { 0xbd176620a501fbffu, 0xb650e5a93bc3d898u },
  { 0xec5d3fa8ce427affu, 0xa3e51f138ab4cebeu },
  { 0x93ba47c980e98cdfu, 0xc66f336c36b10137u },
  { 0xb8a8d9bbe123f017u, 0xb80b0047445d4184u },
  { 0xe6d3102ad96cec1du, 0xa60dc059157491e5u },
  { 0x9043ea1ac7e41392u, 0x87c89837ad68db2fu },
  { 0xb454e4a179dd1877u, 0x29babe4598c311fbu },
  { 0xe16a1dc9d8545e94u, 0xf4296dd6fef3d67au },
  { 0x8ce2529e2734bb1du, 0x1899e4a65f58660cu },
  { 0xb01ae745b101e9e4u, 0x5ec05dcff72e7f8fu },
  { 0xdc21a1171d42645du, 0x76707543f4fa1f73u },
  { 0x899504ae72497ebau, 0x6a06494a791c53a8u },
  { 0xabfa45da0edbde69u, 0x0487db9d17636892u },
  { 0xd6f8d7509292d603u, 0x45a9d2845d3c42b6u },
  { 0x865b86925b9bc5c2u, 0x0b8a2392ba45a9b2u },
  { 0xa7f26836f282b732u, 0x8e6cac7768d7141eu },
  { 0xd1ef0244af2364ffu, 0x3207d795430cd926u },
  { 0x8335616aed761f1fu, 0x7f44e6bd49e807b8u },
  { 0xa402b9c5a8d3a6e7u, 0x5f16206c9c6209a6u },
  { 0xcd036837130890a1u, 0x36dba887c37a8c0fu },
  { 0x802221226be55a64u, 0xc2494954da2c9789u },
  { 0xa02aa96b06deb0fdu, 0xf2db9baa10b7bd6cu },
  { 0xc83553c5c8965d3du, 0x6f92829494e5acc7u },
  { 0xfa42a8b73abbf48cu, 0xcb772339ba1f17f9u },
  { 0x9c69a97284b578d7u, 0xff2a760414536efbu },
  { 0xc38413cf25e2d70du, 0xfef5138519684abau },
  { 0xf46518c2ef5b8cd1u, 0x7eb258665fc25d69u },
  { 0x98bf2f79d5993802u, 0xef2f773ffbd97a61u },
  { 0xbeeefb584aff8603u, 0xaafb550ffacfd8fau },
  { 0xeeaaba2e5dbf6784u, 0x95ba2a53f983cf38u },
  { 0x952ab45cfa97a0b2u, 0xdd945a747bf26183u },
  { 0xba756174393d88dfu, 0x94f971119aeef9e4u },
  { 0xe912b9d1478ceb17u, 0x7a37cd5601aab85du },
  { 0x91abb422ccb812eeu, 0xac62e055c10ab33au },
  { 0xb616a12b7fe617aau, 0x577b986b314d6009u },
  { 0xe39c49765fdf9d94u, 0xed5a7e85fda0b80bu },
  { 0x8e41ade9fbebc27du, 0x14588f13be847307u },
  { 0xb1d219647ae6b31cu, 0x596eb2d8ae258fc8u },
  { 0xde469fbd99a05fe3u, 0x6fca5f8ed9aef3bbu },
  { 0x8aec23d680043beeu, 0x25de7bb9480d5854u },
  { 0xada72ccc20054ae9u, 0xaf561aa79a10ae6au },
  { 0xd910f7ff28069da4u, 0x1b2ba1518094da04u },
  { 0x87aa9aff79042286u, 0x90fb44d2f05d0842u },
  { 0xa99541bf57452b28u, 0x353a1607ac744a53u },
  { 0xd3fa922f2d1675f2u, 0x42889b8997915ce8u },
  { 0x847c9b5d7c2e09b7u, 0x69956135febada11u },
  { 0xa59bc234db398c25u, 0x43fab9837e699095u },
  { 0xcf02b2c21207ef2eu, 0x94f967e45e03f4bbu },
  { 0x8161afb94b44f57du, 0x1d1be0eebac278f5u },
  { 0xa1ba1ba79e1632dcu, 0x6462d92a69731732u },
  { 0xca28a291859bbf93u, 0x7d7b8f7503cfdcfeu },
  { 0xfcb2cb35e702af78u, 0x5cda735244c3d43eu },
  { 0x9defbf01b061adabu, 0x3a0888136afa64a7u },
  { 0xc56baec21c7a1916u, 0x088aaa1845b8fdd0u },
  { 0xf6c69a72a3989f5bu, 0x8aad549e57273d45u },
  { 0x9a3c2087a63f6399u, 0x36ac54e2f678864bu },
  { 0xc0cb28a98fcf3c7fu, 0x84576a1bb416a7ddu },
  { 0xf0fdf2d3f3c30b9fu, 0x656d44a2a11c51d5u },
  { 0x969eb7c47859e743u, 0x9f644ae5a4b1b325u },
  { 0xbc4665b596706114u, 0x873d5d9f0dde1feeu },
  { 0xeb57ff22fc0c7959u, 0xa90cb506d155a7eau },
  { 0x9316ff75dd87cbd8u, 0x09a7f12442d588f2u },
  { 0xb7dcbf5354e9beceu, 0x0c11ed6d538aeb2fu },
  { 0xe5d3ef282a242e81u, 0x8f1668c8a86da5fau },
  { 0x8fa475791a569d10u, 0xf96e017d694487bcu },
  { 0xb38d92d760ec4455u, 0x37c981dcc395a9acu },
  { 0xe070f78d3927556au, 0x85bbe253f47b1417u },
  { 0x8c469ab843b89562u, 0x93956d7478ccec8eu },
  { 0xaf58416654a6babbu, 0x387ac8d1970027b2u },
  { 0xdb2e51bfe9d0696au, 0x06997b05fcc0319eu },
  { 0x88fcf317f22241e2u, 0x441fece3bdf81f03u },
  { 0xab3c2fddeeaad25au, 0xd527e81cad7626c3u },
  { 0xd60b3bd56a5586f1u, 0x8a71e223d8d3b074u },
  { 0x85c7056562757456u, 0xf6872d5667844e49u },
  { 0xa738c6bebb12d16cu, 0xb428f8ac016561dbu },
  { 0xd106f86e69d785c7u, 0xe13336d701beba52u },
  { 0x82a45b450226b39cu, 0xecc0024661173473u },
  { 0xa34d721642b06084u, 0x27f002d7f95d0190u },
  { 0xcc20ce9bd35c78a5u, 0x31ec038df7b441f4u },
  { 0xff290242c83396ceu, 0x7e67047175a15271u },
  { 0x9f79a169bd203e41u, 0x0f0062c6e984d386u },
  { 0xc75809c42c684dd1u, 0x52c07b78a3e60868u },
  { 0xf92e0c3537826145u, 0xa7709a56ccdf8a82u },
  { 0x9bbcc7a142b17ccbu, 0x88a66076400bb691u },
  { 0xc2abf989935ddbfeu, 0x6acff893d00ea435u },
  { 0xf356f7ebf83552feu, 0x0583f6b8c4124d43u },
  { 0x98165af37b2153deu, 0xc3727a337a8b704au },
  { 0xbe1bf1b059e9a8d6u, 0x744f18c0592e4c5cu },
  { 0xeda2ee1c7064130cu, 0x1162def06f79df73u },
  { 0x9485d4d1c63e8be7u, 0x8addcb5645ac2ba8u },
  { 0xb9a74a0637ce2ee1u, 0x6d953e2bd7173692u },
  { 0xe8111c87c5c1ba99u, 0xc8fa8db6ccdd0437u },
  { 0x910ab1d4db9914a0u, 0x1d9c9892400a22a2u },
  { 0xb54d5e4a127f59c8u, 0x2503beb6d00cab4bu },
  { 0xe2a0b5dc971f303au, 0x2e44ae64840fd61du },
  { 0x8da471a9de737e24u, 0x5ceaecfed289e5d2u },
  { 0xb10d8e1456105dadu, 0x7425a83e872c5f47u },
  { 0xdd50f1996b947518u, 0xd12f124e28f77719u },
  { 0x8a5296ffe33cc92fu, 0x82bd6b70d99aaa6fu },
  { 0xace73cbfdc0bfb7bu, 0x636cc64d1001550bu },
  { 0xd8210befd30efa5au, 0x3c47f7e05401aa4eu },
  { 0x8714a775e3e95c78u, 0x65acfaec34810a71u },
  { 0xa8d9d1535ce3b396u, 0x7f1839a741a14d0du },
  { 0xd31045a8341ca07cu, 0x1ede48111209a050u },
  { 0x83ea2b892091e44du, 0x934aed0aab460432u },
  { 0xa4e4b66b68b65d60u, 0xf81da84d5617853fu },
  { 0xce1de40642e3f4b9u, 0x36251260ab9d668eu },
  { 0x80d2ae83e9ce78f3u, 0xc1d72b7c6b426019u },
  { 0xa1075a24e4421730u, 0xb24cf65b8612f81fu },
  { 0xc94930ae1d529cfcu, 0xdee033f26797b627u },
  { 0xfb9b7cd9a4a7443cu, 0x169840ef017da3b1u },
  { 0x9d412e0806e88aa5u, 0x8e1f289560ee864eu },
  { 0xc491798a08a2ad4eu, 0xf1a6f2bab92a27e2u },
  { 0xf5b5d7ec8acb58a2u, 0xae10af696774b1dbu },
  { 0x9991a6f3d6bf1765u, 0xacca6da1e0a8ef29u },
  { 0xbff610b0cc6edd3fu, 0x17fd090a58d32af3u },
  { 0xeff394dcff8a948eu, 0xddfc4b4cef07f5b0u },
  { 0x95f83d0a1fb69cd9u, 0x4abdaf101564f98eu },
  { 0xbb764c4ca7a4440fu, 0x9d6d1ad41abe37f1u },
  { 0xea53df5fd18d5513u, 0x84c86189216dc5edu },
  { 0x92746b9be2f8552cu, 0x32fd3cf5b4e49bb4u },
  { 0xb7118682dbb66a77u, 0x3fbc8c33221dc2a1u },
  { 0xe4d5e82392a40515u, 0x0fabaf3feaa5334au },
  { 0x8f05b1163ba6832du, 0x29cb4d87f2a7400eu },
  { 0xb2c71d5bca9023f8u, 0x743e20e9ef511012u },
  { 0xdf78e4b2bd342cf6u, 0x914da9246b255416u },
  { 0x8bab8eefb6409c1au, 0x1ad089b6c2f7548eu },
  { 0xae9672aba3d0c320u, 0xa184ac2473b529b1u },
  { 0xda3c0f568cc4f3e8u, 0xc9e5d72d90a2741eu },
  { 0x8865899617fb1871u, 0x7e2fa67c7a658892u },
  { 0xaa7eebfb9df9de8du, 0xddbb901b98feeab7u },
  { 0xd51ea6fa85785631u, 0x552a74227f3ea565u },
  { 0x8533285c936b35deu, 0xd53a88958f87275fu },
  { 0xa67ff273b8460356u, 0x8a892abaf368f137u },
  { 0xd01fef10a657842cu, 0x2d2b7569b0432d85u },
  { 0x8213f56a67f6b29bu, 0x9c3b29620e29fc73u },
  { 0xa298f2c501f45f42u, 0x8349f3ba91b47b8fu },
  { 0xcb3f2f7642717713u, 0x241c70a936219a73u },
  { 0xfe0efb53d30dd4d7u, 0xed238cd383aa0110u },
  { 0x9ec95d1463e8a506u, 0xf4363804324a40aau },
  { 0xc67bb4597ce2ce48u, 0xb143c6053edcd0d5u },
  { 0xf81aa16fdc1b81dau, 0xdd94b7868e94050au },
  { 0x9b10a4e5e9913128u, 0xca7cf2b4191c8326u },
  { 0xc1d4ce1f63f57d72u, 0xfd1c2f611f63a3f0u },
  { 0xf24a01a73cf2dccfu, 0xbc633b39673c8cecu },
  { 0x976e41088617ca01u, 0xd5be0503e085d813u },
  { 0xbd49d14aa79dbc82u, 0x4b2d8644d8a74e18u },
  { 0xec9c459d51852ba2u, 0xddf8e7d60ed1219eu },
  { 0x93e1ab8252f33b45u, 0xcabb90e5c942b503u },
  { 0xb8da1662e7b00a17u, 0x3d6a751f3b936243u },
  { 0xe7109bfba19c0c9du, 0x0cc512670a783ad4u },
  { 0x906a617d450187e2u, 0x27fb2b80668b24c5u },
  { 0xb484f9dc9641e9dau, 0xb1f9f660802dedf6u },
  { 0xe1a63853bbd26451u, 0x5e7873f8a0396973u },
  { 0x8d07e33455637eb2u, 0xdb0b487b6423e1e8u },
  { 0xb049dc016abc5e5fu, 0x91ce1a9a3d2cda62u },
  { 0xdc5c5301c56b75f7u, 0x7641a140cc7810fbu },
  { 0x89b9b3e11b6329bau, 0xa9e904c87fcb0a9du },
  { 0xac2820d9623bf429u, 0x546345fa9fbdcd44u },
  { 0xd732290fbacaf133u, 0xa97c177947ad4095u },
  { 0x867f59a9d4bed6c0u, 0x49ed8eabcccc485du },
  { 0xa81f301449ee8c70u, 0x5c68f256bfff5a74u },
  { 0xd226fc195c6a2f8cu, 0x73832eec6fff3111u },
  { 0x83585d8fd9c25db7u, 0xc831fd53c5ff7eabu },
  { 0xa42e74f3d032f525u, 0xba3e7ca8b77f5e55u },
  { 0xcd3a1230c43fb26fu, 0x28ce1bd2e55f35ebu },
  { 0x80444b5e7aa7cf85u, 0x7980d163cf5b81b3u },
  { 0xa0555e361951c366u, 0xd7e105bcc332621fu },
  { 0xc86ab5c39fa63440u, 0x8dd9472bf3fefaa7u },
  { 0xfa856334878fc150u, 0xb14f98f6f0feb951u },
  { 0x9c935e00d4b9d8d2u, 0x6ed1bf9a569f33d3u },
  { 0xc3b8358109e84f07u, 0x0a862f80ec4700c8u },
  { 0xf4a642e14c6262c8u, 0xcd27bb612758c0fau },
  { 0x98e7e9cccfbd7dbdu, 0x8038d51cb897789cu },
  { 0xbf21e44003acdd2cu, 0xe0470a63e6bd56c3u },
  { 0xeeea5d5004981478u, 0x1858ccfce06cac74u },
  { 0x95527a5202df0ccbu, 0x0f37801e0c43ebc8u },
  { 0xbaa718e68396cffdu, 0xd30560258f54e6bau },
  { 0xe950df20247c83fdu, 0x47c6b82ef32a2069u },
  { 0x91d28b7416cdd27eu, 0x4cdc331d57fa5441u },
  { 0xb6472e511c81471du, 0xe0133fe4adf8e952u },
  { 0xe3d8f9e563a198e5u, 0x58180fddd97723a6u },
  { 0x8e679c2f5e44ff8fu, 0x570f09eaa7ea7648u },
  { 0xb201833b35d63f73u, 0x2cd2cc6551e513dau },
  { 0xde81e40a034bcf4fu, 0xf8077f7ea65e58d1u },
  { 0x8b112e86420f6191u, 0xfb04afaf27faf782u },
  { 0xadd57a27d29339f6u, 0x79c5db9af1f9b563u },
  { 0xd94ad8b1c7380874u, 0x18375281ae7822bcu },
  { 0x87cec76f1c830548u, 0x8f2293910d0b15b5u },
  { 0xa9c2794ae3a3c69au, 0xb2eb3875504ddb22u },
  { 0xd433179d9c8cb841u, 0x5fa60692a46151ebu },
  { 0x849feec281d7f328u, 0xdbc7c41ba6bcd333u },
  { 0xa5c7ea73224deff3u, 0x12b9b522906c0800u },
  { 0xcf39e50feae16befu, 0xd768226b34870a00u },
  { 0x81842f29f2cce375u, 0xe6a1158300d46640u },
  { 0xa1e53af46f801c53u, 0x60495ae3c1097fd0u },
  { 0xca5e89b18b602368u, 0x385bb19cb14bdfc4u },
  { 0xfcf62c1dee382c42u, 0x46729e03dd9ed7b5u },
};

/* The high 128 bits of the 192-bit product of `x_hi:x_lo` and `y`, dropping
   the low word's carry exactly as upstream does: the table rounds down, and
   the error that leaves is what the `+6` below absorbs. */
static void nish_umul192_hi128(uint64_t x_hi, uint64_t x_lo, uint64_t y,
                               uint64_t *hi, uint64_t *lo) {
  __uint128_t p = (__uint128_t)x_hi * y;
  uint64_t l = (uint64_t)p + (uint64_t)(((__uint128_t)x_lo * y) >> 64);
  *hi = (uint64_t)(p >> 64) + (l < (uint64_t)p);
  *lo = l;
}

/* (x * y + c) >> 64: one decimal digit off a 64-bit fraction, biased by `c`. */
static uint64_t nish_umul128_add_hi64(uint64_t x, uint64_t y, uint64_t c) {
  return (uint64_t)(((__uint128_t)x * y + c) >> 64);
}

/* The shortest digits of a finite, positive double, given as its bits, as an
   integer `sig` with no trailing zeros and `*exp10` set so the value is
   `sig * 10^*exp10`. `sig` has 1 to 17 digits. */
static uint64_t nish_shortest_digits(uint64_t bits, int *exp10) {
  uint64_t bin_sig = bits & ((1ull << 52) - 1);
  int raw_exp = (int)(bits >> 52);
  /* A power of two has a lower neighbour half as far away as its upper one,
     so its rounding interval is lopsided ("irregular"). 2^-1022 is the one
     power that is not: the largest subnormal sits a full ulp below it. V8 and
     Ryu both treat it as regular, and so does this; upstream does not, which
     would need one more table row and prints the same digits. */
  int regular = bin_sig != 0 || raw_exp <= 1;
  if (raw_exp == 0) raw_exp = 1; /* a subnormal has 2^-1022's spacing */
  else bin_sig |= 1ull << 52;
  int bin_exp = raw_exp - 1075;

  /* floor(log10(2^bin_exp)), or of 3/4 of it when irregular, and the shift
     that puts every exponent's decimal point at the same bit. Scaling by
     10^(-dec_exp-1) rather than 10^-dec_exp lands on the shorter candidate
     directly, so the extra digit comes off the fraction, not out of a div10. */
  int dec_exp = (bin_exp * 315653 - (regular ? 0 : 131072)) >> 20;
  int shift = bin_exp + ((-(dec_exp + 1) * 217707) >> 16) + 1 + 6;
  const uint64_t *pow10 = NISH_POW10_SIG[-dec_exp - 1 - NISH_POW10_MIN];
  uint64_t hi, lo;
  nish_umul192_hi128(pow10[0], pow10[1], bin_sig << shift, &hi, &lo);
  uint64_t integral = hi >> 6;
  uint64_t fractional = (hi << 58) | (lo >> 6);

  /* Half the distance to each neighbour, in the fraction's units. An even
     significand's interval is closed, which is the round-half-to-even tie
     rule for reading the digits back. */
  uint64_t half_ulp = pow10[0] >> (7 - shift);
  int round_up, round_down;
  uint64_t digit;
  if (regular) {
    half_ulp += 1 - (bin_sig & 1);
    round_up = fractional + half_ulp < fractional;
    round_down = half_ulp > fractional;
    /* The nearest next digit, ties to even: 0.25 is the one fraction whose
       tenfold is an exact .5 that rounds the wrong way. */
    digit = nish_umul128_add_hi64(fractional, 10, (1ull << 63) + 6);
    if (fractional == 1ull << 62) digit = 2;
  } else {
    round_up = half_ulp > ~0ull - fractional;
    round_down = (half_ulp >> 1) > fractional;
    /* The lower neighbour is closer, so the nearest digit may fall below the
       interval: take the smallest one inside it instead. */
    digit = nish_umul128_add_hi64(fractional, 10, (1ull << 63) - 1);
    uint64_t least = nish_umul128_add_hi64(fractional - (half_ulp >> 1), 10, ~0ull);
    if (digit < least) digit = least;
  }

  /* When either end of the interval reaches past the shorter candidate, that
     candidate (rounded toward the end that holds it) is the answer; otherwise
     it takes one more digit. */
  uint64_t sig = (integral + round_up) * 10 + (round_up | round_down ? 0 : digit);
  int e = dec_exp;
  /* At most 16 trailing zeros: `sig` is below 2^53 * 10 + 10 < 10^17. */
  if (sig % 10 == 0) {
    sig /= 10; e += 1;
    if (sig % 100000000 == 0) { sig /= 100000000; e += 8; }
    if (sig % 10000 == 0) { sig /= 10000; e += 4; }
    if (sig % 100 == 0) { sig /= 100; e += 2; }
    if (sig % 10 == 0) { sig /= 10; e += 1; }
  }
  *exp10 = e;
  return sig;
}

/* "00" to "99", so the digits go out two to a lookup and two to a store. */
static const char NISH_DIGITS2[200] =
  "0001020304050607080910111213141516171819"
  "2021222324252627282930313233343536373839"
  "4041424344454647484950515253545556575859"
  "6061626364656667686970717273747576777879"
  "8081828384858687888990919293949596979899";

static const uint64_t NISH_POW10_U64[18] = {
  1ull, 10ull, 100ull, 1000ull, 10000ull, 100000ull, 1000000ull, 10000000ull,
  100000000ull, 1000000000ull, 10000000000ull, 100000000000ull,
  1000000000000ull, 10000000000000ull, 100000000000000ull,
  1000000000000000ull, 10000000000000000ull, 100000000000000000ull,
};

/* The decimal digits of `v` into the bytes just before `end`, as many as it
   has, written backward a pair at a time. The caller knows the count. */
static void nish_put_digits(char *end, uint64_t v) {
  while (v >= 100) {
    uint64_t q = v / 100;
    end -= 2;
    memcpy(end, NISH_DIGITS2 + 2 * (v - q * 100), 2);
    v = q;
  }
  if (v >= 10) memcpy(end - 2, NISH_DIGITS2 + 2 * v, 2);
  else end[-1] = (char)('0' + v);
}

/* runtime/nish.h states the same size for the callers that include it. */
#define NISH_F64_MAX 32

/* JS Number#toString: shortest round-trip digits, e-form outside (-6, 21].
   Writes no NUL and returns the length. The longest output is 25 bytes,
   -0.0000012345678901234567: a sign, "0.", five zeros and seventeen digits.
   Every other layout is shorter: 22 for a 21-digit integer and its sign, 24
   for -1.2345678901234567e-308, 9 for -Infinity. No layout writes scratch
   past its own final length. */
int nish_f64_format(double v, char out[NISH_F64_MAX]) {
  uint64_t bits;
  char *o = out;
  memcpy(&bits, &v, 8);
  if ((bits << 1) >> 53 == 0x7ff) {
    if (bits << 12) { memcpy(o, "NaN", 3); return 3; }
    if (bits >> 63) *o++ = '-';
    memcpy(o, "Infinity", 8);
    return (int)(o - out) + 8;
  }
  if ((bits << 1) == 0) { *o = '0'; return 1; } /* -0 prints as 0 */
  if (bits >> 63) *o++ = '-';

  int e;
  uint64_t sig = nish_shortest_digits(bits & ~(1ull << 63), &e);
  /* The digit count: 1233 / 4096 is log10(2) from below, which can only be
     one short, and the table settles it. */
  int k = ((64 - __builtin_clzll(sig)) * 1233) >> 12;
  k += sig >= NISH_POW10_U64[k];
  int n = k + e; /* value = 0.<digits> * 10^n */

  if (n > 21 || n <= -6) {
    /* d.ddde+x: the digits one byte right, then the first moved left past
       where the point goes. */
    nish_put_digits(o + 1 + k, sig);
    o[0] = o[1];
    if (k > 1) { o[1] = '.'; o += k + 1; }
    else o += 1;
    int x = n - 1;
    *o++ = 'e';
    *o++ = x < 0 ? '-' : '+';
    if (x < 0) x = -x;
    if (x >= 100) { *o++ = (char)('0' + x / 100); x %= 100; memcpy(o, NISH_DIGITS2 + 2 * x, 2); o += 2; }
    else if (x >= 10) { memcpy(o, NISH_DIGITS2 + 2 * x, 2); o += 2; }
    else *o++ = (char)('0' + x);
  } else if (n <= 0) {
    o[0] = '0'; o[1] = '.';
    memset(o + 2, '0', (size_t)-n);
    o += 2 - n;
    nish_put_digits(o + k, sig);
    o += k;
  } else if (n >= k) {
    nish_put_digits(o + k, sig);
    memset(o + k, '0', (size_t)(n - k));
    o += n;
  } else {
    /* The integer part shifts left one byte to open the point's slot. */
    nish_put_digits(o + 1 + k, sig);
    memmove(o, o + 1, (size_t)n);
    o[n] = '.';
    o += k + 1;
  }
  return (int)(o - out);
}

nish_str *nish_str_from_f64(double v) {
  char out[NISH_F64_MAX];
  return nish_str_new(out, (uint64_t)nish_f64_format(v, out));
}

/* ---- Math.random: xorshift64*, seeded lazily from time and pid. The shifts
   and the multiplier are Marsaglia's and Vigna's published constants, which
   are public domain.
   Thread-local under -DNISH_THREADS (WP20 T0 §3.2): a shared seed word is a
   race, and a per-thread one also makes each worker's stream its own rather
   than an interleaving of everyone's. Two threads that start in the same
   second still salt from the same time and pid, so a program that needs
   distinct streams per thread seeds them itself. */
static NISH_TLS uint64_t nish_rng;

double nish_random(void) {
  uint64_t x = nish_rng ? nish_rng : ((uint64_t)time(0) << 32) ^ getpid() ^ 0x9E3779B97F4A7C15ull;
  x ^= x >> 12; x ^= x << 25; x ^= x >> 27;
  nish_rng = x;
  return (double)((x * 0x2545F4914F6CDD1Dull) >> 11) * (1.0 / 9007199254740992.0);
}

/* ---- Arrays: %struct.nish_array = type { i64, i64, i8* }, cold paths */
typedef struct nish_array { uint64_t len; uint64_t cap; char *data; } nish_array;

/* Host entry (WP8): `len` uninitialised elements, len == cap. A `len` past
   `NISH_ARRAY_MAX` fails as an allocation does, which also keeps
   `len * elem_size` from wrapping into a short block behind a long header
   (docs/security/runtime.md, RT-7). */
nish_array *nish_alloc_array(uint64_t elem_size, uint64_t len) {
  if (len > NISH_ARRAY_MAX) nish_oom();
  nish_array *a = nish_alloc_struct(sizeof *a);
  *a = (nish_array){ len, len, nish_alloc_struct(len * elem_size) };
  return a;
}

/* process.argv: malloc, not the arena, so no arena scope can free it. Built once by @main.
   Deliberately *not* NISH_TLS (WP20 T0 §3.2): `nish_argv_init` writes it once
   before the program's `main` body runs and nothing writes it afterwards, so
   every thread may read the one copy. That holds only while no thread is
   spawned before initialisation, which the entry wrapper guarantees by calling
   this first. */
nish_array *nish_argv;

/* The key of every `Map` and `Set` string hash (docs/security/json.md, JSON-13):
   SipHash-1-3's 128 bits, zero until the constructor each module that hashes
   a string registers fills it from `getentropy` before `main`. Data, not code,
   so it costs this file's `.text` budget nothing, and not NISH_TLS, for the
   reason `nish_argv` is not: it is written once before any thread exists, and
   a table one thread fills is probed by another under the same key. */
uint64_t nish_hash_key[2];

void nish_argv_init(int32_t argc, char **argv) {
  nish_array *a = malloc(sizeof *a + argc * sizeof(nish_str *));
  if (!a) nish_oom();
  nish_str **d = (nish_str **)(a + 1);
  *a = (nish_array){ argc, argc, (char *)d };
  nish_argv = a;
  while (argc-- > 0) {
    size_t len = strlen(*argv);
    nish_str *s = malloc(8 + len + 1);
    if (!s) nish_oom();
    s->len = len;
    strcpy(s->data, *argv++);
    *d++ = s;
  }
}

/* ---- String to number: mode 0 parseFloat, 1 Number, 2 parseInt (contract: nish.h). ASCII
 * whitespace only; strtod parses once the inf/nan spellings JS rejects are ruled out, and its `0x`
 * hex stays accepted (documented). */
#define NISH_SPACES " \t\n\v\f\r"

double nish_parse_number(const nish_str *s, int32_t mode) {
  const char *p, *q, *stop;
  char *end;
  double v;
  if (mode == 2) return strtoll(s->data, 0, 10);
  p = s->data + strspn(s->data, NISH_SPACES);
  q = p + (*p == '+' || *p == '-');
  stop = s->data + s->len;
  if (!((*q >= '0' && *q <= '9') || *q == '.' || strncmp(q, "Infinity", 8) == 0)) return mode && p == stop ? 0 : NAN;
  v = strtod(p, &end);
  if (end == p) return NAN; /* "." alone */
  return mode && end + strspn(end, NISH_SPACES) != stop ? NAN : v;
}

/* push() when len == cap: double the capacity (4 from empty). `elem_size` is
 * `sizeof` one element, which for a record element type (WP15 section 2a) is
 * the whole struct, so this relocates the elements themselves rather than a
 * block of pointers to them. Compiled code may therefore hold no pointer into
 * `data` across a push, and the checker refuses the programs that would.
 *
 * A push never takes an array past 2^31 - 1 elements (docs/security/codegen.md,
 * K1-6). Under --number-mode i32 `length` is an `i32`, and one element more
 * read back as a negative or a short length everywhere, a hash or a tag
 * compare included. This file cannot tell which mode compiled its caller, so
 * the limit holds in both, and the push past it fails as an allocation does,
 * through `nish_oom`. `new Array(n)` checks its own `n` in the IR.
 *
 * `noinline`: under LTO the grown body was inlined into every push site, and
 * the extra compare moved register allocation in the hot loops around them
 * (+0.2% to +2% instructions over bench/instructions.json's map rows). Out of
 * line, every one of those rows runs fewer instructions than it did before, and
 * the call costs nothing on a path that runs once per doubling. */
__attribute__((noinline)) void nish_array_grow(nish_array *a, uint64_t elem_size) {
#ifdef NISH_ASAN
  /* One more slot, not double (see `nish_grown`): in place while a normal build
     would still have room, moved where it would reallocate. */
  uint64_t native = a->cap, cap = a->len + 1;
  nish_grown_enter();
  struct nish_grown *g = nish_grown_find(a->data);
  if (g && g->owner == a) native = g->native;
  else g = 0;
  if (g && cap <= native) {
    nish_grown_leave();
    __asan_unpoison_memory_region(a->data + a->len * elem_size, elem_size);
    a->cap = cap;
    return;
  }
  uint64_t room = native ? native * 2 : 4;
  if (room > NISH_ARRAY_MAX) room = NISH_ARRAY_MAX;
#else
  uint64_t cap = a->cap ? a->cap * 2 : 4;
#endif
  if (cap > NISH_ARRAY_MAX) {
    if (a->len >= NISH_ARRAY_MAX) nish_oom();
    cap = NISH_ARRAY_MAX;
  }
#ifdef NISH_ASAN
  if (room < cap) room = cap;
  char *data = nish_alloc_struct(room * elem_size);
  NISH_POISON(data + cap * elem_size, (room - cap) * elem_size);
#else
  char *data = nish_alloc_struct(cap * elem_size);
#endif
  if (a->len) memcpy(data, a->data, a->len * elem_size);
#ifdef NISH_ASAN
  /* The old block is dead: a pointer kept across the push now reads poison.
     Only a heap block, as a literal's may be on the stack or a constant. */
  const char *kind = a->cap ? __asan_locate_address(a->data, 0, 0, 0, 0) : 0;
  if (kind && !strcmp(kind, "heap")) NISH_POISON(a->data, (g ? native : a->cap) * elem_size);
  if (g) nish_grown_drop(a->data);
  nish_grown_put(data, a, room);
  nish_grown_leave();
#endif
  a->data = data;
  a->cap = cap;
}

/* `secureZero(bytes)` (#385): every byte of the array set to zero, in stores
 * no optimisation may remove. A `memset` here would be a dead store wherever
 * the buffer's life ends straight after the call -- a key in a frame that
 * returns, a block that is freed -- and links use `-flto`, which inlines this
 * body into that caller and lets dead-store elimination see it. Each store goes
 * through a `volatile` pointer, so each is behaviour the C standard keeps
 * whatever the optimiser can see, and `noinline` keeps the call itself in the
 * binary for a reader of the disassembly. A byte at a time, because a secret
 * is a key or a scalar of tens of bytes, not a buffer worth a vector loop. */
__attribute__((noinline)) void nish_wipe(nish_array *bytes) {
  volatile char *p = bytes->data;
  for (uint64_t i = 0; i < bytes->len; i++) p[i] = 0;
}

void nish_panic_index(uint64_t idx, uint64_t len) {
  nish_panic_claim();
  dprintf(2, "index out of range: %" PRIu64 " >= %" PRIu64 "\n", idx, len);
  nish_fatal_exit();
}

/* `s.slice(start, end)` (WP15 section 4) with a range the string does not
   contain. The two ends are printed as the half-open interval that was asked
   for, because the failure is as often a reversed pair as an end past the
   string, and `nish_panic_index`'s "i >= len" says nothing useful about the
   first of those. They are signed here although the check compares them
   unsigned: that comparison is a trick for folding `>= 0` into one `icmp`, and
   a reader who wrote `s.slice(i - 1)` wants to be told `-1` rather than
   18446744073709551615. The length cannot be negative either way. */
void nish_panic_slice(int64_t start, int64_t end, int64_t len) {
  nish_panic_claim();
  dprintf(2, "slice out of range: [%" PRId64 ", %" PRId64 ") of length %" PRId64 "\n", start, end, len);
  nish_fatal_exit();
}

/* ---- Checked arithmetic (Rust semantics): the failed-check paths. One table
   for both panics, because each message is "attempt to <what>" and the two
   functions then share everything but the index. `nish_panic_overflow`'s `op`
   is the operator whose `llvm.s*.with.overflow` flagged: 0 add, 1 subtract,
   2 multiply, 3 negate, the order `src/emit-ops.ts` numbers them in. */
static const char *const nish_arith_panics[6] = {
  "attempt to add with overflow\n",      "attempt to subtract with overflow\n",
  "attempt to multiply with overflow\n", "attempt to negate with overflow\n",
  "attempt to divide with overflow\n",   "attempt to divide by zero\n"};
void nish_panic_overflow(uint32_t op) { nish_die(nish_arith_panics[op]); }
void nish_panic_div(_Bool by_zero) { nish_panic_overflow(4 + by_zero); }
