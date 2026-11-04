// A counting LD_PRELOAD shim for `memcpy` and `memmove`: every call a
// program makes through the PLT is counted by its caller's return address
// and its size, and the table is written to stderr at exit. README.md,
// "Attribution", uses it for the size distributions callgrind does not give.
//
//   cc -O2 -fno-builtin -shared -fPIC -o build/copycount.so bench/runtime-copies/copycount.c -ldl
//   node bench/runtime-copies/server.mjs --copycount build/copycount.so <h1 build> <scenario>
//
// server.mjs sets LD_PRELOAD, reads the table and names each caller with
// addr2line (the build needs `-g`).
//
// Each line is `caller <hex offset in the main executable, 0 outside it> calls <n> bytes
// <total> sizes <bucket>:<n> ...`, buckets being the powers of two a size is
// at most (1, 2, 4, ... 4096, and `big` past it). Calls the executable's own
// code inlines, and copies of a constant length LLVM turns into stores, never
// reach the shim: it sees what reaches libc.
//
// Two limits. The table is not locked, so the counts are right only for a
// single-threaded program (bench/http1-server.ts without BENCH_CORES is one).
// And a caller is a return address: a function that ends in a tail call to
// `memcpy` has no frame left, so its copies count against its own caller.
// `-fno-builtin` keeps the compiler from turning `bytes` below back into a
// call to `memcpy`, which would reach this shim again.

#define _GNU_SOURCE
#include <dlfcn.h>
#include <link.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#define SLOTS 4096
#define BUCKETS 14

struct site {
  uintptr_t caller;
  unsigned kind; // 0 memcpy, 1 memmove
  unsigned long calls;
  unsigned long bytes;
  unsigned long sizes[BUCKETS];
};

static struct site sites[SLOTS];
static void *(*real_memcpy)(void *, const void *, size_t);
static void *(*real_memmove)(void *, const void *, size_t);
static uintptr_t exe_base;
static uintptr_t exe_end;

/** The bucket `n` falls in: the least k with n <= 2^k, `big` past 4096. */
static unsigned bucket(size_t n) {
  unsigned k = 0;
  while (k < BUCKETS - 1 && ((size_t)1 << k) < n) {
    k++;
  }
  return n > 4096 ? BUCKETS - 1 : k;
}

static void count(uintptr_t caller, unsigned kind, size_t n) {
  size_t h = (caller * 0x9e3779b97f4a7c15u + kind) % SLOTS;
  for (size_t i = 0; i < SLOTS; i++) {
    struct site *s = &sites[(h + i) % SLOTS];
    if (s->calls == 0) {
      s->caller = caller;
      s->kind = kind;
    }
    if (s->caller == caller && s->kind == kind) {
      s->calls++;
      s->bytes += n;
      s->sizes[bucket(n)]++;
      return;
    }
  }
}

/** A byte loop for the calls dlsym makes before the real functions are known. */
static void *bytes(void *d, const void *s, size_t n) {
  // Volatile as well as -fno-builtin: no loop here may become a `memcpy` call.
  volatile unsigned char *dp = d;
  const volatile unsigned char *sp = s;
  if (dp < sp) {
    for (size_t i = 0; i < n; i++) {
      dp[i] = sp[i];
    }
  } else {
    for (size_t i = n; i > 0; i--) {
      dp[i - 1] = sp[i - 1];
    }
  }
  return d;
}

/** The caller as an offset into the executable, or 0 for a caller outside it (libc, the loader). */
static uintptr_t site_of(void *ret) {
  uintptr_t a = (uintptr_t)ret;
  return a >= exe_base && a < exe_end ? a - exe_base : 0;
}

void *memcpy(void *d, const void *s, size_t n) {
  count(site_of(__builtin_return_address(0)), 0, n);
  return real_memcpy != NULL ? real_memcpy(d, s, n) : bytes(d, s, n);
}

void *memmove(void *d, const void *s, size_t n) {
  count(site_of(__builtin_return_address(0)), 1, n);
  return real_memmove != NULL ? real_memmove(d, s, n) : bytes(d, s, n);
}

/** The first object dl_iterate_phdr reports is the executable: its load address and end. */
static int first_object(struct dl_phdr_info *info, size_t size, void *data) {
  (void)size;
  (void)data;
  uintptr_t end = 0;
  for (size_t i = 0; i < info->dlpi_phnum; i++) {
    const ElfW(Phdr) *ph = &info->dlpi_phdr[i];
    if (ph->p_type == PT_LOAD && ph->p_vaddr + ph->p_memsz > end) {
      end = ph->p_vaddr + ph->p_memsz;
    }
  }
  exe_base = info->dlpi_addr;
  exe_end = info->dlpi_addr + end;
  return 1;
}

__attribute__((constructor)) static void start(void) {
  real_memcpy = (void *(*)(void *, const void *, size_t))dlsym(RTLD_NEXT, "memcpy");
  real_memmove = (void *(*)(void *, const void *, size_t))dlsym(RTLD_NEXT, "memmove");
  dl_iterate_phdr(first_object, NULL);
}

__attribute__((destructor)) static void finish(void) {
  static const char *names[BUCKETS] = {"1",   "2",   "4",    "8",    "16",   "32",   "64",
                                       "128", "256", "512", "1024", "2048", "4096", "big"};
  for (size_t i = 0; i < SLOTS; i++) {
    struct site *s = &sites[i];
    if (s->calls == 0) {
      continue;
    }
    fprintf(stderr, "copycount %s caller %lx calls %lu bytes %lu sizes", s->kind == 0 ? "memcpy" : "memmove",
            (unsigned long)s->caller, s->calls, s->bytes);
    for (unsigned k = 0; k < BUCKETS; k++) {
      if (s->sizes[k] != 0) {
        fprintf(stderr, " %s:%lu", names[k], s->sizes[k]);
      }
    }
    fputc('\n', stderr);
  }
}
