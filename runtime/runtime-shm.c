/* The C half of `nish/sync/shm` and `nish/sync/ring` (std/sync/): memory that
 * several processes map at once, the atomics a program runs on it, and the
 * futex that lets one of them sleep until another rings.
 *
 * A region is a named POSIX shared-memory object, `/dev/shm/<name>` on Linux
 * and `shm_open("/<name>")` on Darwin, mapped MAP_SHARED. A program cannot hold
 * the mapping's address, so this file keeps every region in a table and hands
 * the program an `int32_t` handle into it, as runtime/sqlite/nish-sqlite.c
 * does: the slot's index in the low 16 bits and its generation in the 15 above
 * them, so a handle is never 0 or negative. `nishshm_close` unmaps the region
 * and moves the slot's generation on, so a handle used after it names nothing
 * and panics rather than reaching an unmapped page. A slot whose generation
 * reaches 32,767 is retired, so no handle ever names a slot twice.
 *
 * The table is thread-local under --threads (`NISH_TLS`, nish.h): a region
 * belongs to the thread that mapped it, and a handle passed to another thread
 * names nothing there and panics. That is what lets a `close` on one thread
 * never unmap a page another thread is reading, and why the table needs no
 * lock. A thread that wants the region opens it again by name.
 *
 * Only a pointer to the table is thread-local. The table itself is one
 * anonymous page, mapped by the thread's first create or open. Under
 * --threads the runtime's TLS is initial-exec, and a Node addon is loaded
 * with dlopen, where glibc has only a small surplus of static TLS to give it
 * (about 1.6 KiB). A 1.5 KiB table there made `--emit-napi-async` addons fail
 * to load with "cannot allocate memory in static TLS block". A thread that
 * exits keeps its page mapped; one page per thread that ever mapped a region
 * is the whole cost.
 *
 * **Every access is checked.** An offset is an `int32_t` byte offset into the
 * region (a region is at most 1 GiB), widened before any sum; a 32-bit
 * slot must sit at a multiple of 4 and a 64-bit one at a multiple of 8, wholly
 * inside the region, and a byte copy must fit both the region and the
 * program's buffer. A failed check panics with the offset and
 * the region's size (`shm_fail`), so an out-of-range slot or a misaligned
 * atomic is a checked error, never a store through a bad address. So is an
 * ordering an operation cannot take, such as a load with `release`.
 *
 * **Orderings are C11's numbers** (`__ATOMIC_RELAXED` 0 to `__ATOMIC_SEQ_CST`
 * 5, `consume` refused), and each access is one `__atomic_*` builtin on the
 * slot's address. The runtime is LTO bitcode on the speed and size profiles
 * (scripts/build.sh), so an access inlines into the program and a constant
 * ordering folds to one LLVM `load atomic`, `store atomic`, `atomicrmw` or
 * `cmpxchg`. A compare-exchange takes one ordering and derives its failure
 * ordering from it as C++ does: `acq_rel` fails `acquire`, `release` fails
 * `relaxed`.
 *
 * **Waiting** is Linux's futex on a 32-bit slot, the shared (not
 * FUTEX_PRIVATE) form, so a wake in one process reaches a waiter in another.
 * Darwin has no public cross-process equivalent before macOS 14.4, and wasi
 * has no shared memory at all: there `nishshm_wait_i32` and `nishshm_wake`
 * answer -95, as `setIdlePriority` does on Darwin, and on wasi creating or
 * opening a region answers -95 too.
 *
 * Results are 0 or a count on success and a negated errno on failure. Nothing
 * here allocates: the table is a fixed array, and a mapping is the kernel's. */

#define _GNU_SOURCE /* `syscall`, for the futex */
#include <errno.h>
#include <stdint.h>
#include <string.h>

#include "nish.h"

#ifndef __wasi__
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>
#endif
#ifdef __linux__
#include <linux/futex.h>
#include <sys/syscall.h>
#include <time.h>
#endif
#if defined(__APPLE__) && !defined(O_NOFOLLOW)
#define O_NOFOLLOW 0x0100
#endif
#if defined(__APPLE__) && !defined(O_CLOEXEC)
#define O_CLOEXEC 0x1000000
#endif

#define NISHSHM_SLOTS 64
#define NISHSHM_INDEX 0xffff
#define NISHSHM_GEN_MAX 0x7fff
/* The largest region: 1 GiB, so every offset is a Nish `i32` (a method's
   argument takes no width from context, and `region.loadI32(8, ...)` should
   not need a `toI64`), and a page-rounded size on Darwin still fits one. */
#define NISHSHM_MAX_BYTES ((uint64_t)1 << 30)
/* The longest name. Darwin's shm_open takes 31 bytes with its leading '/'. */
#define NISHSHM_NAME_MAX 30

typedef struct nishshm_region {
  uint8_t *base;  /* the mapping, NULL while the slot is free */
  uint64_t size;  /* its length in bytes */
  int32_t gen;    /* the high bits of the slot's handle: 0 never used, 32767 retired */
} nishshm_region;

/* NULL until this thread first maps a region. Slot 0 is never used, so no
   handle is 0. */
static NISH_TLS nishshm_region *nishshm_table;

/* -- panics ---------------------------------------------------------------- */

/* The text of a panic, built in place on the failing call's stack:
   `nish_panic` takes a `nish_str` and does not return. */
typedef struct shm_msg {
  uint64_t len;
  char data[192];
} shm_msg;

static void shm_put(shm_msg *msg, const char *s) {
  while (*s && msg->len < sizeof msg->data - 1) msg->data[msg->len++] = *s++;
}

static void shm_put_i64(shm_msg *msg, int64_t v) {
  char tmp[21], *p = tmp + sizeof tmp;
  uint64_t u = v < 0 ? (uint64_t)0 - (uint64_t)v : (uint64_t)v;
  *--p = 0;
  do {
    *--p = (char)('0' + u % 10);
    u /= 10;
  } while (u);
  if (v < 0) *--p = '-';
  shm_put(msg, p);
}

/* "nish/sync/shm: <what> <n><rest>", and exit 1. */
__attribute__((noreturn, cold)) static void shm_fail(const char *what, int64_t n, const char *rest,
                                                     int64_t m, const char *tail) {
  shm_msg msg;
  msg.len = 0;
  shm_put(&msg, "nish/sync/shm: ");
  shm_put(&msg, what);
  shm_put_i64(&msg, n);
  shm_put(&msg, rest);
  if (tail) {
    shm_put_i64(&msg, m);
    shm_put(&msg, tail);
  }
  msg.data[msg.len] = 0;
  nish_panic((const nish_str *)&msg);
}

/* -- the table ------------------------------------------------------------- */

static inline nishshm_region *region_of(int32_t h) {
  int32_t i = h & NISHSHM_INDEX;
  if (h <= 0 || i == 0 || i >= NISHSHM_SLOTS || nishshm_table == NULL) return NULL;
  nishshm_region *r = &nishshm_table[i];
  if (r->base == NULL || r->gen != (h >> 16)) return NULL;
  return r;
}

static inline nishshm_region *region_checked(int32_t h) {
  nishshm_region *r = region_of(h);
  if (__builtin_expect(r == NULL, 0))
    shm_fail("handle ", h, " names no open region: it was closed, or mapped on another thread", 0,
             NULL);
  return r;
}

/* The address of the `width`-byte slot at `at`, checked for alignment and
   bounds. `at + width` cannot overflow: `at` is below the size, which is at
   most 2^34. */
static inline uint8_t *slot_at(int32_t h, int64_t at, int64_t width) {
  nishshm_region *r = region_checked(h);
  if (__builtin_expect(at < 0 || (uint64_t)at >= r->size || (uint64_t)(at + width) > r->size, 0))
    shm_fail("slot offset ", at, " is outside the region of ", (int64_t)r->size, " bytes");
  if (__builtin_expect((at & (width - 1)) != 0, 0))
    shm_fail("slot offset ", at, " is not a multiple of ", width, ", the slot's width");
  return r->base + at;
}

/* -- orderings ------------------------------------------------------------- */

enum { SHM_LOAD, SHM_STORE, SHM_RMW };

/* Panics unless this kind of access takes `order`. */
static inline void order_check(int32_t order, int kind) {
  int ok;
  switch (order) {
  case __ATOMIC_RELAXED:
  case __ATOMIC_SEQ_CST: ok = 1; break;
  case __ATOMIC_ACQUIRE: ok = kind != SHM_STORE; break;
  case __ATOMIC_RELEASE: ok = kind != SHM_LOAD; break;
  case __ATOMIC_ACQ_REL: ok = kind == SHM_RMW; break;
  default: ok = 0; break;
  }
  if (__builtin_expect(!ok, 0))
    shm_fail("ordering ", order,
             kind == SHM_LOAD    ? " cannot order a load: use RELAXED, ACQUIRE or SEQ_CST"
             : kind == SHM_STORE ? " cannot order a store: use RELAXED, RELEASE or SEQ_CST"
                                 : " is not an ordering: use RELAXED, ACQUIRE, RELEASE, ACQ_REL "
                                   "or SEQ_CST",
             0, NULL);
}

/* -- 32- and 64-bit slots ---------------------------------------------------- */

/* The builtins want a constant ordering, so each access switches on it; the
   switch folds to one access when the program's ordering is a constant and
   the call inlines. A compare-exchange that fails orders as C++ derives it. */
#define SHM_SLOT_OPS(BITS, T, U)                                                                   \
  T nishshm_load_i##BITS(int32_t h, int32_t at, int32_t order) {                                   \
    T *p = (T *)slot_at(h, at, BITS / 8);                                                          \
    order_check(order, SHM_LOAD);                                                                  \
    switch (order) {                                                                               \
    case __ATOMIC_RELAXED: return __atomic_load_n(p, __ATOMIC_RELAXED);                            \
    case __ATOMIC_ACQUIRE: return __atomic_load_n(p, __ATOMIC_ACQUIRE);                            \
    default: return __atomic_load_n(p, __ATOMIC_SEQ_CST);                                          \
    }                                                                                              \
  }                                                                                                \
  void nishshm_store_i##BITS(int32_t h, int32_t at, T v, int32_t order) {                          \
    T *p = (T *)slot_at(h, at, BITS / 8);                                                          \
    order_check(order, SHM_STORE);                                                                 \
    switch (order) {                                                                               \
    case __ATOMIC_RELAXED: __atomic_store_n(p, v, __ATOMIC_RELAXED); break;                        \
    case __ATOMIC_RELEASE: __atomic_store_n(p, v, __ATOMIC_RELEASE); break;                        \
    default: __atomic_store_n(p, v, __ATOMIC_SEQ_CST); break;                                      \
    }                                                                                              \
  }                                                                                                \
  /* The value before the add, which wraps: it is done unsigned. */                                \
  T nishshm_add_i##BITS(int32_t h, int32_t at, T delta, int32_t order) {                           \
    U *p = (U *)slot_at(h, at, BITS / 8);                                                          \
    order_check(order, SHM_RMW);                                                                   \
    switch (order) {                                                                               \
    case __ATOMIC_RELAXED: return (T)__atomic_fetch_add(p, (U)delta, __ATOMIC_RELAXED);            \
    case __ATOMIC_ACQUIRE: return (T)__atomic_fetch_add(p, (U)delta, __ATOMIC_ACQUIRE);            \
    case __ATOMIC_RELEASE: return (T)__atomic_fetch_add(p, (U)delta, __ATOMIC_RELEASE);            \
    case __ATOMIC_ACQ_REL: return (T)__atomic_fetch_add(p, (U)delta, __ATOMIC_ACQ_REL);            \
    default: return (T)__atomic_fetch_add(p, (U)delta, __ATOMIC_SEQ_CST);                          \
    }                                                                                              \
  }                                                                                                \
  /* The value before the exchange. */                                                             \
  T nishshm_exchange_i##BITS(int32_t h, int32_t at, T v, int32_t order) {                          \
    T *p = (T *)slot_at(h, at, BITS / 8);                                                          \
    order_check(order, SHM_RMW);                                                                   \
    switch (order) {                                                                               \
    case __ATOMIC_RELAXED: return __atomic_exchange_n(p, v, __ATOMIC_RELAXED);                     \
    case __ATOMIC_ACQUIRE: return __atomic_exchange_n(p, v, __ATOMIC_ACQUIRE);                     \
    case __ATOMIC_RELEASE: return __atomic_exchange_n(p, v, __ATOMIC_RELEASE);                     \
    case __ATOMIC_ACQ_REL: return __atomic_exchange_n(p, v, __ATOMIC_ACQ_REL);                     \
    default: return __atomic_exchange_n(p, v, __ATOMIC_SEQ_CST);                                   \
    }                                                                                              \
  }                                                                                                \
  /* The value the slot held: the exchange happened when it equals `expected`. */                  \
  T nishshm_cas_i##BITS(int32_t h, int32_t at, T expected, T desired, int32_t order) {             \
    T *p = (T *)slot_at(h, at, BITS / 8);                                                          \
    T seen = expected;                                                                             \
    order_check(order, SHM_RMW);                                                                   \
    switch (order) {                                                                               \
    case __ATOMIC_RELAXED:                                                                         \
      __atomic_compare_exchange_n(p, &seen, desired, 0, __ATOMIC_RELAXED, __ATOMIC_RELAXED);       \
      break;                                                                                       \
    case __ATOMIC_ACQUIRE:                                                                         \
      __atomic_compare_exchange_n(p, &seen, desired, 0, __ATOMIC_ACQUIRE, __ATOMIC_ACQUIRE);       \
      break;                                                                                       \
    case __ATOMIC_RELEASE:                                                                         \
      __atomic_compare_exchange_n(p, &seen, desired, 0, __ATOMIC_RELEASE, __ATOMIC_RELAXED);       \
      break;                                                                                       \
    case __ATOMIC_ACQ_REL:                                                                         \
      __atomic_compare_exchange_n(p, &seen, desired, 0, __ATOMIC_ACQ_REL, __ATOMIC_ACQUIRE);       \
      break;                                                                                       \
    default:                                                                                       \
      __atomic_compare_exchange_n(p, &seen, desired, 0, __ATOMIC_SEQ_CST, __ATOMIC_SEQ_CST);       \
      break;                                                                                       \
    }                                                                                              \
    return seen;                                                                                   \
  }

SHM_SLOT_OPS(32, int32_t, uint32_t)
SHM_SLOT_OPS(64, int64_t, uint64_t)

/* A fence of `order`, which a read-modify-write would take. */
void nishshm_fence(int32_t order) {
  order_check(order, SHM_RMW);
  switch (order) {
  case __ATOMIC_RELAXED: break;
  case __ATOMIC_ACQUIRE: __atomic_thread_fence(__ATOMIC_ACQUIRE); break;
  case __ATOMIC_RELEASE: __atomic_thread_fence(__ATOMIC_RELEASE); break;
  case __ATOMIC_ACQ_REL: __atomic_thread_fence(__ATOMIC_ACQ_REL); break;
  default: __atomic_thread_fence(__ATOMIC_SEQ_CST); break;
  }
}

/* -- bytes ----------------------------------------------------------------- */

/* The window `[at, at + len)` of the region, checked against it, and
   `[off, off + len)` of a program buffer of `n` bytes, checked against that. */
static inline uint8_t *window(int32_t h, int64_t at, uint64_t n, uint64_t off, uint64_t len) {
  nishshm_region *r = region_checked(h);
  if (__builtin_expect(at < 0 || (uint64_t)at > r->size || len > r->size - (uint64_t)at, 0))
    shm_fail("byte window at ", at, " is outside the region of ", (int64_t)r->size, " bytes");
  if (__builtin_expect(off > n || len > n - off, 0))
    shm_fail("buffer window at ", (int64_t)off, " is outside the buffer of ", (int64_t)n, " bytes");
  return r->base + at;
}

/* Copies `len` bytes of the region at `at` into `dst[off..]`. The bytes are
   copied once, so a writer in another process can tear them but never make
   the copy read past what was checked. */
void nishshm_read(int32_t h, int32_t at, uint8_t *dst, uint64_t n, uint64_t off, uint64_t len) {
  uint8_t *src = window(h, at, n, off, len);
  memcpy(dst + off, src, len);
}

/* Copies `src[off, off + len)` into the region at `at`. */
void nishshm_write(int32_t h, int32_t at, const uint8_t *src, uint64_t n, uint64_t off,
                   uint64_t len) {
  uint8_t *dst = window(h, at, n, off, len);
  memcpy(dst, src + off, len);
}

/* -- regions ----------------------------------------------------------------- */

int32_t nishshm_size(int32_t h) { return (int32_t)region_checked(h)->size; }

#ifdef __wasi__

int32_t nishshm_create(const char *name, int32_t bytes) {
  (void)name;
  (void)bytes;
  return -95;
}
int32_t nishshm_open(const char *name) {
  (void)name;
  return -95;
}
int32_t nishshm_unlink(const char *name) {
  (void)name;
  return -95;
}
int32_t nishshm_close(int32_t h) {
  (void)h;
  return -9;
}

#else

/* 1 if `name` is 1..30 bytes of [A-Za-z0-9._-] not starting with '.'. */
static int name_ok(const char *name) {
  size_t i = 0;
  if (name[0] == '.') return 0;
  for (; name[i]; i++) {
    char c = name[i];
    int ok = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') ||
             c == '.' || c == '_' || c == '-';
    if (!ok || i >= NISHSHM_NAME_MAX) return 0;
  }
  return i > 0;
}

/* The path the object is opened by: `/dev/shm/<name>` on Linux, which is
   what glibc's shm_open opens and needs no librt, and `/<name>` on Darwin. */
static void path_of(char *out, const char *name) {
#ifdef __linux__
  memcpy(out, "/dev/shm/", 9);
  strcpy(out + 9, name);
#else
  out[0] = '/';
  strcpy(out + 1, name);
#endif
}

static int shm_open_path(const char *path, int flags, mode_t mode) {
#ifdef __linux__
  return open(path, flags, mode);
#else
  return shm_open(path, flags, mode);
#endif
}

/* A free slot of the table, or 0 when all are in use or retired, or when
   this thread's table could not be mapped. */
static int32_t slot_take(void) {
  if (nishshm_table == NULL) {
    void *t = mmap(NULL, sizeof(nishshm_region) * NISHSHM_SLOTS, PROT_READ | PROT_WRITE,
                   MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    if (t == MAP_FAILED) return 0;
    nishshm_table = (nishshm_region *)t; /* the kernel gives it zeroed */
  }
  for (int32_t i = 1; i < NISHSHM_SLOTS; i++) {
    nishshm_region *r = &nishshm_table[i];
    if (r->base != NULL) continue;
    if (r->gen == 0) {
      r->gen = 1; /* generations start at 1, so no handle is a bare index */
      return i;
    }
    if (r->gen < NISHSHM_GEN_MAX) return i;
  }
  return 0;
}

/* Maps `fd` (`size` bytes) into a slot and answers its handle. Closes `fd`
   either way: the mapping keeps the object alive. */
static int32_t adopt(int fd, uint64_t size) {
  int32_t i = slot_take();
  if (i == 0) {
    close(fd);
    return -24;
  }
  void *p = mmap(NULL, (size_t)size, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
  int e = errno;
  close(fd);
  if (p == MAP_FAILED) return -e;
  nishshm_table[i].base = (uint8_t *)p;
  nishshm_table[i].size = size;
  return (nishshm_table[i].gen << 16) | i;
}

/* Creates the region `name` of `bytes` zero bytes, mode 0600, and maps it.
   -17 when it exists already, -22 for a bad name or size. O_EXCL and
   O_NOFOLLOW mean a name another user planted in the world-writable
   directory is refused, never adopted. */
int32_t nishshm_create(const char *name, int32_t bytes) {
  char path[64];
  if (!name_ok(name) || bytes <= 0 || (uint64_t)bytes > NISHSHM_MAX_BYTES) return -22;
  path_of(path, name);
  int fd = shm_open_path(path, O_RDWR | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
  if (fd < 0) return -errno;
  if (ftruncate(fd, (off_t)bytes) != 0) {
    int e = errno;
    close(fd);
#ifdef __linux__
    unlink(path);
#else
    shm_unlink(path);
#endif
    return -e;
  }
  return adopt(fd, (uint64_t)bytes);
}

/* Opens and maps the region `name` some process created. Its size is the
   object's (on Darwin, rounded up to a page). -13 unless this user owns it and
   no one else may read or write it, so a region another user made is never
   trusted; -2 when there is none. */
int32_t nishshm_open(const char *name) {
  char path[64];
  struct stat st;
  if (!name_ok(name)) return -22;
  path_of(path, name);
  int fd = shm_open_path(path, O_RDWR | O_NOFOLLOW | O_CLOEXEC, 0);
  if (fd < 0) return -errno;
  if (fstat(fd, &st) != 0) {
    int e = errno;
    close(fd);
    return -e;
  }
  if (st.st_uid != geteuid() || (st.st_mode & 077) != 0) {
    close(fd);
    return -13;
  }
#ifdef __linux__
  /* A second link is a name someone else made for one of our regions: in a
     world-writable /dev/shm without fs.protected_hardlinks, another user can
     link ours under the name we are about to open. */
  if (!S_ISREG(st.st_mode) || st.st_nlink != 1) {
    close(fd);
    return -13;
  }
#endif
  if (st.st_size <= 0 || (uint64_t)st.st_size > NISHSHM_MAX_BYTES) {
    close(fd);
    return -22;
  }
  return adopt(fd, (uint64_t)st.st_size);
}

/* Removes the name; every mapping of it stays valid until it is closed. */
int32_t nishshm_unlink(const char *name) {
  char path[64];
  if (!name_ok(name)) return -22;
  path_of(path, name);
#ifdef __linux__
  if (unlink(path) != 0) return -errno;
#else
  if (shm_unlink(path) != 0) return -errno;
#endif
  return 0;
}

/* Unmaps the region. -9 for a handle that names nothing, so a second close
   is an error rather than a panic. */
int32_t nishshm_close(int32_t h) {
  nishshm_region *r = region_of(h);
  if (r == NULL) return -9;
  munmap(r->base, (size_t)r->size);
  r->base = NULL;
  r->size = 0;
  r->gen = r->gen + 1; /* NISHSHM_GEN_MAX retires the slot (`slot_take`) */
  return 0;
}

#endif

/* -- waiting ----------------------------------------------------------------- */

/* Sleeps while the 32-bit slot at `at` holds `expected`, at most `timeout_ms`
   (negative: no limit). 0 when woken, or for no reason the caller can see
   (a signal, a spurious wake): the caller loads the slot again. -11 when the
   slot did not hold `expected`, -110 when the time ran out, -95 where there is
   no cross-process futex. The slot is checked as a load's would be. */
int32_t nishshm_wait_i32(int32_t h, int32_t at, int32_t expected, int32_t timeout_ms) {
  int32_t *p = (int32_t *)slot_at(h, at, 4);
#ifdef __linux__
  struct timespec ts, *tp = NULL;
  if (timeout_ms >= 0) {
    ts.tv_sec = (time_t)(timeout_ms / 1000);
    ts.tv_nsec = (long)(timeout_ms % 1000) * 1000000L;
    tp = &ts;
  }
  if (syscall(SYS_futex, p, FUTEX_WAIT, expected, tp, NULL, 0) == 0) return 0;
  switch (errno) {
  case EAGAIN: return -11;
  case ETIMEDOUT: return -110;
  case EINTR: return 0;
  default: return -errno;
  }
#else
  (void)p;
  (void)expected;
  (void)timeout_ms;
  return -95;
#endif
}

/* Wakes at most `count` waiters on the 32-bit slot at `at`, in any process
   that maps the region: the number woken, or -95 as `nishshm_wait_i32`. */
int32_t nishshm_wake(int32_t h, int32_t at, int32_t count) {
  int32_t *p = (int32_t *)slot_at(h, at, 4);
#ifdef __linux__
  long n = syscall(SYS_futex, p, FUTEX_WAKE, count < 0 ? 0 : count, NULL, NULL, 0);
  return n < 0 ? -errno : (int32_t)n;
#else
  (void)p;
  (void)count;
  return -95;
#endif
}
