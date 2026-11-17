/* Nish runtime: arena + output + cold paths. Layouts are ABI (runtime.ts, nish.h).
 *
 * The half of the runtime every program touches whatever it does, which is why
 * it is also the half with the tighter size budget: the arena, writing strings
 * out, the array cold paths, `process.argv`, `Math.random`, and the two
 * panics. Building, searching and formatting strings is runtime-text.c's, a
 * unit with no libc beyond the mem* routines so that the freestanding wasm
 * link takes the same code (WP50 stage 4). Files, directories, subprocesses, the environment and the clock are
 * in runtime-os.c — every one of those wraps a system call, so that surface
 * grows as the language reaches further into the operating system, and a
 * program that reaches nowhere should not pay for it or be measured with it.
 * runtime-os.c's header comment has the reasoning; tests/run.js gates the two
 * `.text*` budgets separately and docs/wp7-runtime.md records both.
 *
 * Nothing here calls into runtime-os.c or runtime-text.c, which is why a link
 * line that names runtime.c alone still builds a program that uses neither
 * surface; one that builds a string names runtime-text.c beside it.
 * The other direction does happen: `nish_readdir` allocates through
 * `nish_alloc_struct` and `nish_str_new`, so those calls no longer inline into
 * it without LTO. Measured in docs/wp7-runtime.md; the speed and size profiles
 * both use `-flto`, and the cold paths that lost the inlining are cold.
 */
#define _POSIX_C_SOURCE 200809L
#ifdef NISH_ARENA_DEBUG
/* The debug arena's `madvise`, which POSIX leaves out (its `posix_madvise`
   gives nothing back on glibc). */
#define _DEFAULT_SOURCE
#define _DARWIN_C_SOURCE
#endif
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
/* A chunk's usable bytes. Bit 0 of `cap` marks a *carved* chunk, one
   `nish_region_adopt` (runtime-region.c) made in what an older chunk of the
   same arena had left: no malloc of its own, so `nish_free_until` passes it
   by. A malloc'd chunk's cap is a multiple of 8, so the bit is free. */
#define NISH_CHUNK_CARVED 1
#define NISH_CHUNK_CAP(c) ((c)->cap & ~(uint64_t)NISH_CHUNK_CARVED)
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
   loading the message's address cost more than one more symbol does. External
   because runtime-text.c's `nish_str_concat` fails through it too; a wasm link
   has runtime-wasm.c's instead. */
NISH_COLD void nish_oom(void) { nish_die("nish: out of memory\n"); }

/* The most elements an array and the most bytes a string may hold: see
   `nish_array_grow` and `nish_str_concat`. */
#define NISH_ARRAY_MAX 2147483647u

/* The size of the next chunk while a region is entered (runtime-region.c
   swaps it in and out with the region's arena), or 0 for the thread's own
   arena, whose chunks are at least 64 KB. Defined here, not there, so that
   this file still links alone. */
NISH_TLS uint64_t nish_region_chunk;

/* The most a region's next chunk grows to: past it the chunks stop doubling,
   so a region that keeps allocating never asks malloc for one block of
   gigabytes when smaller ones would do (docs/security/runtime.md, RT-47). A
   single allocation larger than this still gets a chunk of its own size. */
#define NISH_REGION_CHUNK_MAX ((uint64_t)1 << 20)

#ifdef NISH_ARENA_DEBUG
/* ---- The debug arena (`--debug-arena`, `-DNISH_ARENA_DEBUG`;
   docs/security/runtime.md, "The debug arena")
   Every arena block is a chunk of its own, as under ASan: its pages are cut
   from one address range reserved at the first allocation and never handed
   out twice, with the header at the start of its first page and `cap` exact,
   so the inline bump never fits again and every block, and every release,
   comes through this file. A release or reset that frees a chunk retires it
   instead: its pages go `PROT_NONE` and back to the system, but stay
   reserved, so a stale reference faults at the read rather than reading what
   the next allocation wrote there. The handler below names that fault before
   the program dies of it. The bytes past the mark in the mark's own chunk
   are not retired; with exact chunks there are none, as every mark but a
   region's 0 sits at a chunk's end. A chunk C code malloc'd and linked in
   (runtime-cross.c's) lies outside the range and is freed as always.
   Memory only grows, since no address is reused: this is for tests and
   fuzzing, never a release build. */
#include <signal.h>
#include <sys/mman.h>
static char *nish_debug_base;   /* the reservation, PROT_NONE until a block is cut from it */
static uint64_t nish_debug_size;
static uint64_t nish_debug_next; /* the next unused byte's offset, taken atomically */
static uint64_t nish_debug_page;
static int nish_debug_state;     /* 0 none, 1 reserving, 2 reserved */
static struct sigaction nish_debug_old_segv, nish_debug_old_bus;

/* A fault in the part of the reservation handed out so far is a stale arena
   reference: say so, then put the default back and return, so the access
   faults once more and the program dies of the signal, as its parent expects.
   Any other fault, pages never handed out included, goes to the handler that
   was there before. It runs on an alternate stack when the thread has one
   (runtime-term.c's), so a stack overflow still reaches that handler. */
static void nish_debug_on_fault(int sig, siginfo_t *info, void *ctx) {
  (void)ctx;
  uintptr_t a = (uintptr_t)info->si_addr, base = (uintptr_t)nish_debug_base;
  struct sigaction *old = sig == SIGSEGV ? &nish_debug_old_segv : &nish_debug_old_bus;
  if (a >= base && a - base < __atomic_load_n(&nish_debug_next, __ATOMIC_RELAXED)) {
    char msg[] = "nish: --debug-arena: stale arena reference at 0x0000000000000000: "
                 "the memory was released by the scope that allocated it\n";
    char *hex = msg + sizeof "nish: --debug-arena: stale arena reference at 0x" - 1;
    for (int i = 15; i >= 0; i--, a >>= 4) hex[i] = "0123456789abcdef"[a & 15];
    nish_write_all(2, msg, sizeof msg - 1);
    void (*hook)(void) = __atomic_load_n(&nish_fatal_hook, __ATOMIC_ACQUIRE);
    if (hook) hook();
    signal(sig, SIG_DFL);
    return;
  }
  sigaction(sig, old, 0);
}

/* Reserve the range, once for every thread: as much address space as the
   system lets a process have without committing it, from 1 TiB down to 1 GiB. */
static void nish_debug_reserve(void) {
  int want = 0;
  if (!__atomic_compare_exchange_n(&nish_debug_state, &want, 1, 0, __ATOMIC_ACQ_REL, __ATOMIC_ACQUIRE)) {
    while (__atomic_load_n(&nish_debug_state, __ATOMIC_ACQUIRE) != 2) {}
    return;
  }
  long page = sysconf(_SC_PAGESIZE);
  nish_debug_page = page > 0 ? (uint64_t)page : 4096;
  for (uint64_t size = (uint64_t)1 << 40; size >= (uint64_t)1 << 30; size >>= 1) {
    void *p = mmap(0, (size_t)size, PROT_NONE, MAP_PRIVATE | MAP_ANONYMOUS | MAP_NORESERVE, -1, 0);
    if (p != MAP_FAILED) {
      nish_debug_base = p;
      nish_debug_size = size;
      break;
    }
  }
  if (!nish_debug_base) nish_die("nish: --debug-arena: cannot reserve address space for the arena\n");
  struct sigaction sa;
  memset(&sa, 0, sizeof sa);
  sa.sa_sigaction = nish_debug_on_fault;
  sa.sa_flags = SA_SIGINFO | SA_NODEFER | SA_ONSTACK;
  sigemptyset(&sa.sa_mask);
  sigaction(SIGSEGV, &sa, &nish_debug_old_segv);
  sigaction(SIGBUS, &sa, &nish_debug_old_bus);
  __atomic_store_n(&nish_debug_state, 2, __ATOMIC_RELEASE);
}

static uint64_t nish_debug_span(uint64_t cap) {
  return (sizeof(nish_chunk) + cap + nish_debug_page - 1) & ~(nish_debug_page - 1);
}

/* A chunk of `cap` bytes, header included, on pages no block had before. */
static nish_chunk *nish_debug_chunk(uint64_t cap) {
  if (__atomic_load_n(&nish_debug_state, __ATOMIC_ACQUIRE) != 2) nish_debug_reserve();
  if (cap > nish_debug_size - sizeof(nish_chunk) - nish_debug_page) nish_oom();
  uint64_t span = nish_debug_span(cap);
  uint64_t at = __atomic_fetch_add(&nish_debug_next, span, __ATOMIC_RELAXED);
  if (at > nish_debug_size - span)
    nish_die("nish: --debug-arena: the arena's address space is used up (no address is reused)\n");
  char *p = nish_debug_base + at;
  if (mprotect(p, (size_t)span, PROT_READ | PROT_WRITE) != 0) nish_oom();
  return (nish_chunk *)p;
}

/* Whether `c` is one of the debug arena's chunks, not one C code malloc'd. */
static int nish_debug_owns(const void *c) {
  uintptr_t a = (uintptr_t)c, base = (uintptr_t)nish_debug_base;
  return nish_debug_base && a >= base && a - base < nish_debug_size;
}

/* Retire a chunk: every page of it unreadable and given back, its addresses
   kept. A process at its limit of mappings (each retired run splits one) is
   refused the `mprotect`; the chunk is then filled with 0xDB instead, which
   reads as a pointer no system maps and a length no bounds check passes. */
static void nish_debug_retire(nish_chunk *c) {
  uint64_t span = nish_debug_span(NISH_CHUNK_CAP(c));
  if (mprotect(c, (size_t)span, PROT_NONE) == 0) madvise(c, (size_t)span, MADV_DONTNEED);
  else memset(c, 0xDB, (size_t)span);
}

/* runtime-region.c's adopt drops an empty chunk through this. */
void nish_debug_drop(void *c) {
  if (nish_debug_owns(c)) nish_debug_retire(c);
  else free(c);
}
#endif

/* Slow path (size 8-byte rounded): push a chunk (>= 64 KB, or a region's
   next size), bump from it. A region's chunks double from its first, up to
   NISH_REGION_CHUNK_MAX. */
void *nish_arena_grow(uint64_t size) {
#if defined NISH_ARENA_DEBUG
  /* An exact chunk, as under ASan, of pages no block had before. `off` is the
     whole chunk, so even a block the rounding left room after is alone in it. */
  uint64_t cap = (size + 7) & ~(uint64_t)7;
  if (cap < size) nish_oom();
  nish_chunk *d = nish_debug_chunk(cap);
  d->next = nish_arena.chunks;
  d->cap = cap;
  nish_arena = (struct nish_arena){ (char *)(d + 1), cap, cap, d };
  return nish_arena.buf;
#elif defined NISH_ASAN
  /* An exact chunk leaves off == cap, so the inline bump never fits again and
     every block comes through here: one malloc, one redzone, per block. */
  uint64_t cap = size;
#else
  uint64_t next = nish_region_chunk;
  uint64_t floor = next ? next : 65536;
  uint64_t cap = size > floor ? size : floor;
  if (next) nish_region_chunk = cap < NISH_REGION_CHUNK_MAX / 2 ? cap * 2 : NISH_REGION_CHUNK_MAX;
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
void nish_free_arena(void);
/* The bytes of a chunk the arena reuses from its start, after a reset or a
   release to a mark there: all but the last word. A scope may have marked that
   start, and a block that began there and filled the chunk exactly would be
   one `nish_array_grow_here` reallocates -- which would either keep the grown
   chunk for good (the release keeps the chunk its mark is in) or move it from
   under the mark, which then names no chunk and frees nothing. Eight bytes
   short, no block from the start fills it, so the grow copies instead. */
#define NISH_REUSE_CAP(cap) ((cap) > 8 ? (cap) - 8 : 0)
static void nish_free_until(nish_chunk *c, const nish_chunk *end) {
#ifdef NISH_ASAN
  /* A freed block's address comes back from malloc: forget the grown ones. */
  if (nish_grown_live) {
    nish_grown_enter();
    for (nish_chunk *d = c; d != end; d = d->next) nish_grown_drop((char *)(d + 1));
    nish_grown_leave();
  }
#endif
  /* A carved chunk lies inside an older one, which a list is never cut
     between: what frees the older chunk frees the memory under it. */
  while (c != end) {
    nish_chunk *n = c->next;
#ifdef NISH_ARENA_DEBUG
    if (!(c->cap & NISH_CHUNK_CARVED)) nish_debug_drop(c);
#else
    if (!(c->cap & NISH_CHUNK_CARVED)) free(c);
#endif
    c = n;
  }
}

void nish_reset_arena(void) {
#if defined NISH_ASAN || defined NISH_ARENA_DEBUG
  /* Free everything, so a value read after the reset is a use after free. */
  nish_free_arena();
  return;
#endif
  /* Keep the newest chunk malloc made: a carved one above it lives in a
     chunk this frees, and always lies above the chunk it was carved from,
     so the walk meets that chunk before the list ends. The walk is a
     do-while from the head already loaded, not a while from
     `nish_arena.chunks`: written that way, LLVM folds the first load into
     the loop through a phi of `&nish_arena.chunks`, which takes the arena's
     address, and with it taken LTO's GlobalsAA can no longer tell an array
     store from an arena field in any program -- bench/sieve.ts reloaded
     both in its hot loops, +60% instructions. */
  nish_chunk *keep = nish_arena.chunks;
  if (!keep) return;
  if (keep->cap & NISH_CHUNK_CARVED) {
    do keep = keep->next; while (keep->cap & NISH_CHUNK_CARVED);
  }
  nish_free_until(keep->next, 0);
  keep->next = 0;
  nish_arena = (struct nish_arena){ (char *)(keep + 1), 0, NISH_REUSE_CAP(keep->cap), keep };
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

/* ---- cErrno (WP27 S5, docs/wp27-ffi.md §10): compiled code zeroes errno through this
 * pointer before a foreign call and copies it into the per-thread slot after. */
NISH_TLS int32_t nish_errno_slot;
int *nish_errno_ptr(void) { return &errno; }

void nish_arena_release(uint64_t mark) {
  nish_chunk *c = nish_arena.chunks;
  if (!mark) { nish_reset_arena(); return; }
  for (; c; c = c->next) {
    uintptr_t base = (uintptr_t)(c + 1);
    if (mark >= base && mark <= base + NISH_CHUNK_CAP(c)) break;
  }
  if (!c) return;
  nish_free_until(nish_arena.chunks, c);
  uint64_t off = mark - (uintptr_t)(c + 1), cap = NISH_CHUNK_CAP(c);
  nish_arena = (struct nish_arena){ (char *)(c + 1), off, off ? cap : NISH_REUSE_CAP(cap), c };
#ifdef NISH_ARENA_DEBUG
  /* Never bump into what the mark gave back: the next block gets a chunk. */
  nish_arena.cap = nish_arena.off;
#endif
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
    if (mark >= cb && mark <= cb + NISH_CHUNK_CAP(c)) break;
  }
  if (!c || (c == pc && mark > q)) return p;
  /* mark <= q inside one chunk implies mark + size <= q + size <= its end, so
     the second arm is only ever reached with `c` older than `pc`. */
  if (mark + size <= (uintptr_t)(c + 1) + NISH_CHUNK_CAP(c)) {
    memmove((void *)mark, p, size);
    nish_free_until(pc, c);
    nish_arena = (struct nish_arena){ (char *)(c + 1), mark + size - (uintptr_t)(c + 1), NISH_CHUNK_CAP(c), c };
#ifdef NISH_ARENA_DEBUG
    nish_arena.cap = nish_arena.off;
#endif
    return (void *)mark;
  }
  /* Keeping a carved `pc` while the chunks under it go could free the one it
     was carved from. */
  if (pc->cap & NISH_CHUNK_CARVED) return p;
  nish_free_until(pc->next, c);
  pc->next = c;
  return p;
}

/* ---- Strings: { i64 len, bytes[len], '\0' }, immutable; 8 = the len header.
   Building, comparing, searching and formatting them is runtime-text.c's; this
   half writes them out and reads `process.argv` and `Number(s)` into them. */
typedef struct { uint64_t len; char data[]; } nish_str;

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
 * the call costs nothing on a path that runs once per doubling.
 *
 * A normal build first tries to grow the block where it is
 * (`nish_array_grow_here`), so that an array built by `push` costs its final
 * size rather than the sum of every size it passed through. */
#ifndef NISH_ASAN
/* How many chunks `nish_array_grow_here` looks through for the one an array
   fills: a program building a few large columns at once keeps each in a chunk
   of its own near the head of the list, and a longer walk would cost more than
   the copy it might save on a small array. */
#define NISH_GROW_WALK 16

/* Grow `a`'s block from `old` to `want` bytes (both 8-rounded) without moving
 * its elements to a fresh block, or answer 0 to have the caller copy them. Two
 * cases are cheap and safe:
 *
 *   - The block is the last one bumped from the current chunk, with room
 *     behind it: bump `off` past the new bytes. Nothing lies after the block,
 *     so nothing is overwritten.
 *   - The block is the whole of a malloc'd chunk, as every block over 64 KB is
 *     (`nish_arena_grow` gives it an exact chunk): `realloc` the chunk, which
 *     for a large block remaps its pages rather than copying them and returns
 *     the old block's memory, and relink it where it was in the list. The order
 *     of the list is what `nish_arena_release` and runtime-cross.c's
 *     `nish_since` read, and it is unchanged.
 *
 * Both are sound because no pointer into `data` is held across a push (the
 * comment above), and because a scope that releases its arena never pushes on
 * an array older than its mark (docs/LANGUAGE.md, "Memory model"), so the bytes
 * a grow takes past the old block are never below a mark that is still to be
 * released. A carved chunk (`NISH_CHUNK_CARVED`) lies inside an older one and
 * is never reallocated; an array whose block is anywhere else -- a literal on
 * the stack or in a constant, a shared-memory array, a block another thread's
 * or region's arena handed out, one in the middle of a chunk -- simply takes
 * the copy. */
static int nish_array_grow_here(nish_array *a, uint64_t old, uint64_t want) {
  char *data = a->data, *buf = nish_arena.buf;
  uint64_t more = want - old;
  if (buf && data >= buf && data + old == buf + nish_arena.off && more <= nish_arena.cap - nish_arena.off) {
    nish_arena.off += more;
    return 1;
  }
  /* A block of 64 KB or less never has a chunk to itself in the thread's arena
     (`nish_arena_grow`'s floor), so it skips the walk and takes the copy, as it
     also does in a region whose chunks are smaller. Walking for every small
     array cost Bounce, which grows about ten thousand, 0.6% instructions.

     The head is relinked by assigning the whole arena, never through a pointer
     to `nish_arena.chunks`: a link pointer the walk rewrites, or a phi or select
     of that field and a chunk's `next`, takes the arena's address, which costs
     every program LTO's GlobalsAA (see `nish_reset_arena`) -- Queens' setup
     reloaded the arena around each header store and filled an array with a
     `memset` it had folded, +0.35% instructions. The assignment makes the grown
     chunk the buffer, full, as the head already was: the buffer is always the
     head's (`nish_arena_grow`, a release, a reset and a region's adoption all
     leave it there), and a block that fills it has no room left after it. So a
     chunk further down is never the buffer, and its relink is the `next` alone. */
  if (old <= 65536) return 0;
  nish_chunk *prev = 0, *c = nish_arena.chunks;
  for (int i = 0; c && i < NISH_GROW_WALK; i++, prev = c, c = c->next) {
    if ((char *)(c + 1) != data) continue;
    if ((c->cap & NISH_CHUNK_CARVED) || c->cap != old) return 0;
    if (want > (uint64_t)(SIZE_MAX - sizeof(nish_chunk))) nish_oom();
    nish_chunk *n = realloc(c, sizeof *n + (size_t)want);
    if (!n) nish_oom();
    n->cap = want;
    a->data = (char *)(n + 1);
    if (prev) prev->next = n;
    else nish_arena = (struct nish_arena){ (char *)(n + 1), want, want, n };
    return 1;
  }
  return 0;
}
#endif

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
  if (a->cap && nish_array_grow_here(a, (a->cap * elem_size + 7) & ~(uint64_t)7, (cap * elem_size + 7) & ~(uint64_t)7)) {
    a->cap = cap;
    return;
  }
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
