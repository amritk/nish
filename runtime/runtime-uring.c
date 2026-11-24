/* Nish runtime, the io_uring half of the network layer (WP63 S1): a set of
 * io_uring rings that holds TCP connections in the rings' registered file
 * tables instead of the process's descriptor table, so one process can hold
 * more connections than RLIMIT_NOFILE allows descriptors. The design and its
 * measurements are docs/wp63-iouring-net.md; the prototype it was measured on
 * is bench/fd-limit/uring-server.c. Nothing in `nish:net` calls this file yet
 * (S2 adds the surface), and section GC means a program pays nothing for it.
 *
 * A translation unit of its own for the reason runtime-net.c is one: it
 * carries its own measured `.text*` ceiling in tests/runtime-budgets.js, and
 * scripts/build.sh pairs it with runtime.c like the other halves.
 *
 * **Four kernel behaviours shape it** (the note's §2, each measured):
 *
 *  1. A ring's file table is capped at RLIMIT_NOFILE slots
 *     (io_uring/rsrc.c, io_sqe_files_register answers -EMFILE past it), so a
 *     set holds C connections in ceil(C / limit) rings, made as they fill.
 *  2. An accept that finds the table full has already taken the connection
 *     off the listener, and the kernel drops it (io_accept: the fixed install
 *     fails and puts the file). A multishot accept keeps accepting while the
 *     queue is non-empty, so it cannot be bounded. Accepts here are
 *     single-shot into IORING_FILE_INDEX_ALLOC, and a ring never has more in
 *     flight than it has free slots.
 *  3. Accepts on one listener are exclusive waiters, woken one per arriving
 *     connection, so an accept that is only waiting never learns of the ones
 *     already queued. Exactly one ring accepts at a time, and moving the job
 *     to another ring is a fresh submission there, which is tried at once and
 *     drains the backlog.
 *  4. A DEFER_TASKRUN ring runs at most 20 queued completions per
 *     io_uring_enter (IO_LOCAL_TW_DEFAULT_MAX), and queuing more work does
 *     not signal its eventfd while the rest wait; only the completions the
 *     enter posts do. TASKRUN_FLAG says work is left in IORING_SQ_TASKRUN.
 *     `ur_service` enters again while that flag is up, so one wait takes
 *     all of a ring's queued work rather than 20 per wakeup, and while
 *     IORING_SQ_CQ_OVERFLOW says the kernel holds completions the CQ had no
 *     room for (FEAT_NODROP keeps them rather than dropping them).
 *
 * **Every ring** is SINGLE_ISSUER | DEFER_TASKRUN | TASKRUN_FLAG |
 * SUBMIT_ALL, with COOP_TASKRUN added where a kernel refuses TASKRUN_FLAG
 * without it; a sparse file table; a provided-buffer ring that every
 * connection's multishot recv draws from; and one eventfd, which the set's
 * one epoll descriptor watches. A DEFER_TASKRUN ring's work runs only when
 * this thread enters the ring, so a set belongs to the thread that opened it
 * (the kernel refuses another thread's submissions under SINGLE_ISSUER). The
 * kernel signals the eventfd when it queues work on an empty list, but on 7.0
 * (and 6.18) that signal can be lost for good (NURING-8: a deferred signal
 * sets a bit nothing clears), and polling the ring's own descriptor is no
 * better, so no sleep on the set is longer than UR_SLEEP_MAX_MS: the timer is
 * the wake the kernel guarantees, and a wait that wakes by it services every
 * flagged ring. A caller that sleeps on `nish_uring_fd` sleeps no longer than
 * `nish_uring_sleep_ms` answers.
 *
 * **A connection is a (ring, slot) pair.** Its recv is multishot; a recv the
 * kernel ends with -ENOBUFS (every buffer lent out) is parked and re-armed on
 * the next `nish_uring_wait`, after the buffers lent by the last one are back,
 * never closed. A send copies its bytes, and a slot keeps one send in flight
 * so that a short send's remainder, which is re-queued, goes out before the
 * bytes queued behind it. A close cancels the slot's armed recv (closing a
 * fixed slot does not, and the recv would keep the socket alive) and then
 * closes the slot. Every completion carries the slot's generation, which the
 * close moves on, so a completion that arrives after the close, or after the
 * slot was reused, is recognised as stale and only gives back its buffer.
 *
 * **Nothing here exits or panics.** A call answers `>= 0` or a negative errno,
 * Linux's number, the shape runtime-net.c uses. `nish_uring_probe` answers
 * whether this kernel and this process may use the design at all: a kernel
 * without io_uring (-ENOSYS), a sandbox or `io_uring_disabled` that refuses
 * it (-EPERM), a kernel too old for the flags (-EINVAL), or one missing a
 * feature or an opcode (-EOPNOTSUPP) all answer negative, and the caller
 * keeps epoll. The calls are raw `syscall()`s against the kernel's ABI, which
 * this file declares itself, so it builds against any libc's headers and
 * needs no liburing.
 *
 * On any other platform, and on WASI, a set is unavailable: Darwin's stub
 * answers -38 (Linux's ENOSYS) from every call, and a WASI build is empty.
 */
#if defined(__wasi__) || defined(__wasm__)
/* ISO C wants at least one declaration in a translation unit. */
typedef int nish_uring_unused;
#else
#if defined(__linux__)
/* glibc declares `syscall` only with this feature macro. */
#define _GNU_SOURCE
#endif
#include <errno.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

/* What a set reports to the loop that waits on it. `data` is the set's own
 * buffer and stays valid until the next `nish_uring_wait` on the same set. */
enum {
  NISH_URING_ACCEPTED = 1, /* a new connection in (ring, slot) */
  NISH_URING_DATA = 2,     /* `res` bytes at `data` from (ring, slot) */
  NISH_URING_HUP = 3,      /* the peer closed (`res` 0) or failed (`res` < 0) */
  NISH_URING_SEND_FAILED = 4, /* a send on (ring, slot) failed with `res` */
  NISH_URING_ACCEPT_FAILED = 5, /* the listener failed with `res`; accepting stopped */
  NISH_URING_ACCEPT_PAUSED = 6  /* an accept found memory short (`res`); accepting resumes after a back-off */
};

struct nish_uring_event {
  int32_t kind;
  int32_t ring;
  int32_t slot;
  int32_t res;
  const uint8_t *data;
};

/* Sizes a set is opened with; a field of 0 takes its default. */
struct nish_uring_opts {
  int32_t slots;      /* file-table slots per ring; default RLIMIT_NOFILE's soft limit */
  int32_t rings_max;  /* rings a set may grow to; default 64 */
  int32_t sq_entries; /* default 1024 */
  int32_t cq_entries; /* default 8192, at least sq_entries */
  int32_t buf_count;  /* provided buffers per ring, a power of two; default 1024 */
  int32_t buf_size;   /* bytes per buffer; default 2048 */
};

/* Counters the tests read. `max_accepting_rings` is the most rings that ever
 * had an accept in flight at once, which behaviour 3 says must stay 1, and
 * `bound_violations` counts accepts the kernel refused for a full table, which
 * behaviour 2 says must stay 0. */
struct nish_uring_stats {
  int64_t rings;
  int64_t live;
  int64_t accepting;
  int64_t slots;
  int64_t taskrun_reentries;
  int64_t overflow_drains;
  int64_t nobufs_rearms;
  int64_t send_requeues;
  int64_t accept_errors;
  int64_t accept_pauses;
  int64_t bound_violations;
  int64_t max_accepting_rings;
  int64_t direct_waits; /* sleeps in io_uring_enter on the ring itself, not epoll_wait */
};

struct nish_uring_set;

int32_t nish_uring_probe(void);
int32_t nish_uring_premake(int32_t n, int32_t slots, int32_t *fds);
int32_t nish_uring_pooled(void);
int32_t nish_uring_open(struct nish_uring_set **out, int32_t listener, const struct nish_uring_opts *opts);
int32_t nish_uring_fd(const struct nish_uring_set *s);
int32_t nish_uring_sleep_ms(const struct nish_uring_set *s, int32_t timeout_ms);
int32_t nish_uring_wait(struct nish_uring_set *s, int32_t timeout_ms, struct nish_uring_event *ev, int32_t cap);
int32_t nish_uring_wait_direct(struct nish_uring_set *s, int32_t watch_fd, int32_t min_complete, int32_t timeout_ms);
int32_t nish_uring_poll_events(struct nish_uring_set *s, int32_t take);
int32_t nish_uring_send(struct nish_uring_set *s, int32_t ring, int32_t slot, const uint8_t *p, int32_t n);
int32_t nish_uring_close(struct nish_uring_set *s, int32_t ring, int32_t slot);
int64_t nish_uring_queued(const struct nish_uring_set *s, int32_t ring, int32_t slot);
int32_t nish_uring_full(const struct nish_uring_set *s);
int32_t nish_uring_hold(struct nish_uring_set *s, int32_t ring, int32_t slot, int32_t on);
void nish_uring_stats(const struct nish_uring_set *s, struct nish_uring_stats *st);
void nish_uring_destroy(struct nish_uring_set *s);

#if defined(__linux__)
#include <fcntl.h>
#include <poll.h>
#include <sys/epoll.h>
#include <sys/eventfd.h>
#include <sys/mman.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <sys/syscall.h>
#include <time.h>
#include <unistd.h>

/* The kernel's io_uring ABI (include/uapi/linux/io_uring.h), declared here so
 * the file needs no particular kernel headers: an older sysroot that lacks
 * DEFER_TASKRUN still builds, and the probe finds out at run time. The
 * syscall numbers are the same on every architecture but alpha and mips. */
#ifndef __NR_io_uring_setup
#define __NR_io_uring_setup 425
#endif
#ifndef __NR_io_uring_enter
#define __NR_io_uring_enter 426
#endif
#ifndef __NR_io_uring_register
#define __NR_io_uring_register 427
#endif

#define UR_SETUP_CQSIZE (1u << 3)
#define UR_SETUP_R_DISABLED (1u << 6)
#define UR_SETUP_SUBMIT_ALL (1u << 7)
#define UR_SETUP_COOP_TASKRUN (1u << 8)
#define UR_SETUP_TASKRUN_FLAG (1u << 9)
#define UR_SETUP_SINGLE_ISSUER (1u << 12)
#define UR_SETUP_DEFER_TASKRUN (1u << 13)
#define UR_FEAT_SINGLE_MMAP (1u << 0)
#define UR_FEAT_NODROP (1u << 1)
#define UR_FEAT_EXT_ARG (1u << 8)
#define UR_OFF_SQ_RING 0ull
#define UR_OFF_SQES 0x10000000ull
#define UR_SQ_CQ_OVERFLOW (1u << 1)
#define UR_SQ_TASKRUN (1u << 2)
#define UR_ENTER_GETEVENTS (1u << 0)
#define UR_ENTER_EXT_ARG (1u << 3)
#define UR_SQE_FIXED_FILE (1u << 0)
#define UR_SQE_BUFFER_SELECT (1u << 5)
#define UR_SQE_CQE_SKIP_SUCCESS (1u << 6)
#define UR_CQE_F_BUFFER (1u << 0)
#define UR_CQE_F_MORE (1u << 1)
#define UR_CQE_BUFFER_SHIFT 16
#define UR_OP_NOP 0
#define UR_OP_POLL_ADD 6
#define UR_OP_ACCEPT 13
#define UR_OP_ASYNC_CANCEL 14
#define UR_OP_CLOSE 19
#define UR_OP_SEND 26
#define UR_OP_RECV 27
#define UR_OP_SHUTDOWN 34
#define UR_RECV_MULTISHOT (1u << 1)
#define UR_CANCEL_ALL (1u << 0)
#define UR_CANCEL_FD (1u << 1)
#define UR_CANCEL_FD_FIXED (1u << 3)
#define UR_REGISTER_EVENTFD 4
#define UR_REGISTER_PROBE 8
#define UR_REGISTER_FILES2 13
#define UR_REGISTER_RESTRICTIONS 11
#define UR_REGISTER_ENABLE_RINGS 12
#define UR_REGISTER_PBUF_RING 22
#define UR_RESTRICTION_SQE_OP 1
#define UR_RESTRICTION_SQE_FLAGS_ALLOWED 2
#define UR_RSRC_REGISTER_SPARSE (1u << 0)
#define UR_FILE_INDEX_ALLOC (~0u)
#define UR_OP_SUPPORTED (1u << 0)
/* The kernel's own cap on a file table (IORING_MAX_FIXED_FILES). */
#define UR_MAX_SLOTS (1 << 20)

struct ur_sqring_offsets {
  uint32_t head, tail, ring_mask, ring_entries, flags, dropped, array, resv1;
  uint64_t user_addr;
};
struct ur_cqring_offsets {
  uint32_t head, tail, ring_mask, ring_entries, overflow, cqes, flags, resv1;
  uint64_t user_addr;
};
struct ur_params {
  uint32_t sq_entries, cq_entries, flags, sq_thread_cpu, sq_thread_idle, features, wq_fd, resv[3];
  struct ur_sqring_offsets sq_off;
  struct ur_cqring_offsets cq_off;
};
/* One submission. The kernel's struct is a nest of unions; these are the
 * names of the members this file sets, at the kernel's offsets. */
struct ur_sqe {
  uint8_t opcode;
  uint8_t flags;
  uint16_t ioprio;
  int32_t fd;
  uint64_t off;
  uint64_t addr;
  uint32_t len;
  uint32_t op_flags; /* msg_flags, accept_flags, cancel_flags */
  uint64_t user_data;
  uint16_t buf_group;
  uint16_t personality;
  uint32_t file_index;
  uint64_t addr3;
  uint64_t pad;
};
struct ur_cqe {
  uint64_t user_data;
  int32_t res;
  uint32_t flags;
};
struct ur_rsrc_register {
  uint32_t nr, flags;
  uint64_t resv2, data, tags;
};
struct ur_buf {
  uint64_t addr;
  uint32_t len;
  uint16_t bid;
  uint16_t resv; /* in entry 0, the ring's tail */
};
struct ur_buf_reg {
  uint64_t ring_addr;
  uint32_t ring_entries;
  uint16_t bgid;
  uint16_t flags;
  uint64_t resv[3];
};
struct ur_probe_op {
  uint8_t op, resv;
  uint16_t flags;
  uint32_t resv2;
};
struct ur_probe {
  uint8_t last_op, ops_len;
  uint16_t resv;
  uint32_t resv2[3];
  struct ur_probe_op ops[64];
};
/* One entry of IORING_REGISTER_RESTRICTIONS: `arg` is the union of
 * register_op, sqe_op and sqe_flags. */
struct ur_restriction {
  uint16_t opcode;
  uint8_t arg;
  uint8_t resv;
  uint32_t resv2[3];
};

_Static_assert(sizeof(struct ur_params) == 120, "io_uring_params is 120 bytes");
_Static_assert(sizeof(struct ur_sqe) == 64, "io_uring_sqe is 64 bytes");
_Static_assert(sizeof(struct ur_cqe) == 16, "io_uring_cqe is 16 bytes");
_Static_assert(sizeof(struct ur_rsrc_register) == 32, "io_uring_rsrc_register is 32 bytes");
_Static_assert(sizeof(struct ur_buf) == 16, "io_uring_buf is 16 bytes");
_Static_assert(sizeof(struct ur_buf_reg) == 40, "io_uring_buf_reg is 40 bytes");
_Static_assert(sizeof(struct ur_restriction) == 16, "io_uring_restriction is 16 bytes");

/* What a completion's user_data says. A send's is its record's address, which
 * malloc aligns to 8, with UR_SEND in the low three bits; every other op's is
 * the op, the slot's generation and the slot, and none of those ops is 3. */
enum { UR_ACCEPT = 1, UR_RECV = 2, UR_SEND = 3, UR_CLOSE = 4, UR_CANCEL = 5, UR_POLL = 6 };

/* A slot's state word: open, recv armed, recv parked on -ENOBUFS, recv held
 * by its caller (`nish_uring_hold`), hung up (its recv ended for good, so it
 * is never armed again until the slot is accepted anew), and the generation
 * in the 24 bits above. */
#define ST_OPEN 1u
#define ST_ARMED 2u
#define ST_PARKED 4u
#define ST_HELD 8u
#define ST_HUP 16u
#define ST_GEN(st) ((st) >> 8)
#define GEN_MASK 0xffffffu

#define BGID 1
#define ACCEPT_DEPTH 32
/* The back-off after an accept that found memory short: 10 ms, doubling to
 * 640 ms while accepts keep failing. Connections wait in the listener's
 * backlog meanwhile, as they do at a full set. */
#define ACCEPT_BACKOFF_MIN_MS 10
#define ACCEPT_BACKOFF_MAX_MS 640
#define EVENTS_MAX 256

/* One send's bytes, owned by the set until the kernel has taken all of them.
 * `next` queues it behind the slot's earlier sends; `prev_all`/`next_all`
 * keep every record on one list so `nish_uring_destroy` can free those the
 * kernel still held. `how` is -1 for bytes, or a shutdown's 0 to 2: that
 * record carries none and goes to the kernel as a SHUTDOWN once the sends
 * queued before it are done, so the peer reads them before the FIN. */
struct ur_send {
  struct ur_send *next, *prev_all, *next_all;
  uint32_t slot, gen;
  uint32_t off, len;
  int in_flight, how;
  uint8_t data[];
};

struct ur_ring {
  int fd, efd;
  uint32_t *sq_head, *sq_tail, *sq_mask, *sq_array, *sq_flags;
  uint32_t *cq_head, *cq_tail, *cq_mask;
  struct ur_sqe *sqes;
  struct ur_cqe *cqes;
  void *ring_map;
  size_t ring_len, sqes_len;
  uint32_t sq_entries, sq_local_tail, to_submit;
  struct ur_buf *br;
  uint8_t *bufs;
  size_t br_len, bufs_len;
  uint16_t br_tail;
  long live, accepting;
  uint32_t *st;               /* per slot */
  struct ur_send **sq_first;  /* per slot: the head of its send queue */
  struct ur_send **sq_last;   /* per slot: the tail */
  uint32_t *qbytes;           /* per slot: bytes queued and not yet sent */
  uint32_t *parked;           /* slots whose recv waits for buffers */
  uint32_t nparked;
  /* IORING_FEAT_EXT_ARG: an enter can carry its own timeout, so a sleeper
   * can wait on the ring itself (nish_uring_wait_direct). A restricted ring
   * may not take POLL_ADD, so it watches no descriptor for its caller. */
  uint8_t ext_arg, restricted;
};

struct nish_uring_set {
  int listener, ep;
  uint32_t slots, buf_count, buf_size, sq_entries, cq_entries;
  int nrings, rings_max, acceptor;
  int accept_stopped;
  /* Accepting waits until `resume_ms` after an accept found memory short; the
   * wait doubles from ACCEPT_BACKOFF_MIN_MS while it keeps failing and starts
   * again from the minimum once an accept succeeds. */
  int accept_paused;
  int32_t backoff_ms;
  int64_t resume_ms;
  struct ur_ring **rings;
  struct ur_send *all;
  long stalled_sends; /* heads that found the SQ full */
  /* Buffers lent to the caller by the last wait, given back by the next. */
  uint32_t lent_ring[EVENTS_MAX];
  uint16_t lent_bid[EVENTS_MAX];
  int nlent;
  /* The one-shot POLL_ADD a direct wait arms on its caller's descriptor
   * (NURING-45): the descriptor, whether the poll is in the kernel, the
   * events it answered and not yet taken, and whether one failed, after
   * which no descriptor is watched again. */
  int poll_fd, poll_armed, poll_broken;
  int32_t poll_revents;
  struct nish_uring_stats stats;
};

static int ur_errno(long rc) { return rc < 0 ? -errno : (int)rc; }

/* tests/runtime/uring-test.c stands in for setup and register to force the
 * answers a seccomp filter cannot: an -EINVAL that depends on the flags, a
 * missing feature bit or opcode. */
#ifndef UR_SYS_SETUP
#define UR_SYS_SETUP(entries, p) syscall(__NR_io_uring_setup, entries, p)
#endif
#ifndef UR_SYS_REGISTER
#define UR_SYS_REGISTER(fd, op, arg, nr) syscall(__NR_io_uring_register, fd, op, arg, nr)
#endif
/* What an accept completion answered; uring-test.c turns one into -ENOMEM,
 * which the kernel gives only when memory is short. */
#ifndef UR_ACCEPT_RES
#define UR_ACCEPT_RES(res) (res)
#endif

static int ur_setup(uint32_t entries, struct ur_params *p) { return ur_errno(UR_SYS_SETUP(entries, p)); }

static int ur_enter(struct ur_ring *r, uint32_t submit, uint32_t wait, uint32_t flags) {
  return ur_errno(syscall(__NR_io_uring_enter, r->fd, submit, wait, flags, NULL, 0));
}

static int ur_register(int fd, unsigned op, void *arg, unsigned nr) {
  return ur_errno(UR_SYS_REGISTER(fd, op, arg, nr));
}

static int ur_setup_try(uint32_t entries, uint32_t cq, struct ur_params *p, uint32_t f) {
  memset(p, 0, sizeof *p);
  p->flags = f;
  p->cq_entries = cq;
  return ur_setup(entries, p);
}

/* Make a ring fd with the set's flags. A kernel that has TASKRUN_FLAG but
 * wants COOP_TASKRUN beside it, or DEFER_TASKRUN's precondition, answers
 * -EINVAL, so the second try adds COOP_TASKRUN. */
static int ur_setup_flags(uint32_t entries, uint32_t cq, struct ur_params *p) {
  uint32_t f = UR_SETUP_SINGLE_ISSUER | UR_SETUP_DEFER_TASKRUN | UR_SETUP_TASKRUN_FLAG | UR_SETUP_SUBMIT_ALL;
  if (cq) f |= UR_SETUP_CQSIZE;
  int fd = ur_setup_try(entries, cq, p, f);
  if (fd == -EINVAL) {
    f |= UR_SETUP_COOP_TASKRUN;
    fd = ur_setup_try(entries, cq, p, f);
  }
  return fd;
}

/* Whether the ring `fd` has every opcode the layer submits: 1, -EOPNOTSUPP
 * when one is missing or the kernel has no probe, or the register's errno. */
static int32_t ur_ops_ok(int fd) {
  struct ur_probe pr;
  memset(&pr, 0, sizeof pr);
  int e = ur_register(fd, UR_REGISTER_PROBE, &pr, 64);
  if (e < 0) return e == -EINVAL ? -EOPNOTSUPP : e;
  static const uint8_t ops[] = {UR_OP_ACCEPT, UR_OP_ASYNC_CANCEL, UR_OP_CLOSE, UR_OP_SEND, UR_OP_RECV, UR_OP_SHUTDOWN};
  for (size_t i = 0; i < sizeof ops; i++) {
    uint8_t op = ops[i];
    if (op > pr.last_op || op >= pr.ops_len || !(pr.ops[op].flags & UR_OP_SUPPORTED)) return -EOPNOTSUPP;
  }
  return 1;
}

static int32_t ur_probe_once(void) {
  struct ur_params p;
  int fd = ur_setup_flags(4, 0, &p);
  if (fd < 0) return fd;
  int32_t rc = 1;
  if (!(p.features & UR_FEAT_NODROP) || !(p.features & UR_FEAT_SINGLE_MMAP)) rc = -EOPNOTSUPP;
  if (rc > 0) rc = ur_ops_ok(fd);
  if (rc > 0) {
    struct ur_rsrc_register files;
    memset(&files, 0, sizeof files);
    files.nr = 1;
    files.flags = UR_RSRC_REGISTER_SPARSE;
    int e = ur_register(fd, UR_REGISTER_FILES2, &files, sizeof files);
    if (e < 0) rc = e == -EINVAL ? -EOPNOTSUPP : e;
  }
  if (rc > 0) {
    void *br = mmap(NULL, 4096, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    if (br == MAP_FAILED) {
      rc = -ENOMEM;
    } else {
      struct ur_buf_reg reg;
      memset(&reg, 0, sizeof reg);
      reg.ring_addr = (uint64_t)(uintptr_t)br;
      reg.ring_entries = 8;
      reg.bgid = BGID;
      int e = ur_register(fd, UR_REGISTER_PBUF_RING, &reg, 1);
      if (e < 0) rc = e == -EINVAL ? -EOPNOTSUPP : e;
      close(fd);
      fd = -1;
      munmap(br, 4096);
    }
  }
  if (fd >= 0) close(fd);
  return rc;
}

/* The rings `--sandbox` made before its filter (WP63 S3), which sets take in
 * place of making their own: under that filter `io_uring_setup` and
 * `io_uring_register` kill the process. `made` is set once, before `main`
 * and before any thread, by `nish_uring_premake`; `rc` is the number of rings
 * made or the errno of the step that failed, and `next` the next ring a set
 * takes. `keeper` is one more restricted ring, made after them, which takes
 * only NOP and has no queue mapped: a ring a set frees is dropped by
 * `dup3`ing the keeper over its number, never by closing it, so every number
 * the filter lets `io_uring_enter` take holds a restricted ring for the
 * process's life (NURING-36). -1 when the pool holds no ring. */
#define UR_POOL_MAX 64
/* The default sizes, which a pooled ring is made at. */
#define UR_SQ_DEFAULT 1024
#define UR_CQ_DEFAULT 8192
#define UR_BUF_COUNT_DEFAULT 1024
#define UR_BUF_SIZE_DEFAULT 2048
struct ur_sizes {
  uint32_t slots, buf_count, buf_size, sq_entries, cq_entries;
};
static struct {
  int made;
  int32_t rc;
  struct ur_sizes z;
  struct ur_ring *rings[UR_POOL_MAX];
  int32_t fds[UR_POOL_MAX];
  int n, next;
  int keeper;
} ur_pool = {.keeper = -1};

/* 1 when this process may use a set, else the negative errno that says why
 * not. A yes or a static refusal is kept for the process: what refuses
 * io_uring (the kernel, a seccomp filter, the sysctl) does not change under
 * a running program in a way it could act on. A refusal for want of a
 * resource (-EMFILE, -ENFILE, -ENOMEM, ...) is not kept, so the next call
 * asks again once descriptors or memory are free. */
int32_t nish_uring_probe(void) {
  /* A sandboxed process never calls setup: the pool is the answer. */
  if (ur_pool.made) return ur_pool.rc > 0 ? 1 : ur_pool.rc;
  static int32_t cached;
  int32_t c = __atomic_load_n(&cached, __ATOMIC_RELAXED);
  if (c == 0) {
    c = ur_probe_once();
    if (c > 0 || c == -ENOSYS || c == -EPERM || c == -EINVAL || c == -EOPNOTSUPP)
      __atomic_store_n(&cached, c, __ATOMIC_RELAXED);
  }
  return c;
}

/* Hand the queued submissions to the kernel. -EINTR is tried again; anything
 * else (-EAGAIN for memory, -EBUSY on a kernel that refuses submissions while
 * completions overflow) leaves them queued for the next call to retry. */
static int ur_flush(struct ur_ring *r) {
  while (r->to_submit) {
    int rc = ur_enter(r, r->to_submit, 0, UR_ENTER_GETEVENTS);
    if (rc == -EINTR) continue;
    if (rc < 0) return rc;
    if (rc == 0) return -EAGAIN;
    r->to_submit -= (uint32_t)rc > r->to_submit ? r->to_submit : (uint32_t)rc;
  }
  return 0;
}

/* The next free submission entry, zeroed, or NULL when the SQ stays full
 * after a flush. */
static struct ur_sqe *ur_sqe(struct ur_ring *r) {
  uint32_t head = __atomic_load_n(r->sq_head, __ATOMIC_ACQUIRE);
  if (r->sq_local_tail - head >= r->sq_entries) {
    (void)ur_flush(r);
    head = __atomic_load_n(r->sq_head, __ATOMIC_ACQUIRE);
    if (r->sq_local_tail - head >= r->sq_entries) return NULL;
  }
  uint32_t i = r->sq_local_tail & *r->sq_mask;
  struct ur_sqe *e = &r->sqes[i];
  memset(e, 0, sizeof *e);
  r->sq_array[i] = i;
  r->sq_local_tail++;
  __atomic_store_n(r->sq_tail, r->sq_local_tail, __ATOMIC_RELEASE);
  r->to_submit++;
  return e;
}

static uint64_t ur_tag(unsigned op, uint32_t st, uint32_t slot) {
  return (uint64_t)op | ((uint64_t)(ST_GEN(st) & GEN_MASK) << 8) | ((uint64_t)slot << 32);
}

static void ur_recycle(struct nish_uring_set *s, struct ur_ring *r, uint32_t bid) {
  struct ur_buf *b = &r->br[r->br_tail & (s->buf_count - 1)];
  b->addr = (uint64_t)(uintptr_t)(r->bufs + (size_t)bid * s->buf_size);
  b->len = s->buf_size;
  b->bid = (uint16_t)bid;
  r->br_tail++;
  __atomic_store_n(&r->br[0].resv, r->br_tail, __ATOMIC_RELEASE);
}

/* Arm a slot's multishot recv, or park it for the next wait when the SQ has
 * no room. A slot that has hung up is not armed: a recv on its socket would
 * answer 0 once the kernel has handed over the reset, and a second hangup
 * would turn the reset into a clean end (NURING-27). */
static void ur_arm(struct ur_ring *r, uint32_t slot) {
  if (r->st[slot] & ST_HUP) return;
  struct ur_sqe *e = ur_sqe(r);
  if (!e) {
    if (!(r->st[slot] & ST_PARKED)) {
      r->st[slot] |= ST_PARKED;
      r->parked[r->nparked++] = slot;
    }
    return;
  }
  e->opcode = UR_OP_RECV;
  e->fd = (int32_t)slot;
  e->flags = UR_SQE_FIXED_FILE | UR_SQE_BUFFER_SELECT;
  e->ioprio = UR_RECV_MULTISHOT;
  e->buf_group = BGID;
  e->user_data = ur_tag(UR_RECV, r->st[slot], slot);
  r->st[slot] |= ST_ARMED;
}

static void ur_free_ring(struct ur_ring *r) {
  if (r->efd >= 0) close(r->efd);
  /* A pooled ring's number stays a restricted ring's: `dup3` drops the ring
     and puts the keeper there in one step, which the filter allows from the
     keeper alone, where it kills `close` on that number (NURING-36). It is
     tried again on EINTR and EBUSY; on any other failure the ring is left at
     its number, still restricted, and its kernel memory is held. */
  if (r->fd >= 0 && ur_pool.keeper >= 0) {
    while (syscall(SYS_dup3, ur_pool.keeper, r->fd, O_CLOEXEC) < 0 && (errno == EINTR || errno == EBUSY)) {
    }
  } else if (r->fd >= 0)
    close(r->fd);
  if (r->ring_map && r->ring_map != MAP_FAILED) munmap(r->ring_map, r->ring_len);
  if (r->sqes && (void *)r->sqes != MAP_FAILED) munmap(r->sqes, r->sqes_len);
  if (r->br && (void *)r->br != MAP_FAILED) munmap(r->br, r->br_len);
  if (r->bufs && (void *)r->bufs != MAP_FAILED) munmap(r->bufs, r->bufs_len);
  free(r->st);
  free(r->sq_first);
  free(r->sq_last);
  free(r->parked);
  free(r->qbytes);
  free(r);
}

/* Restrict a ring made with R_DISABLED to what the layer submits (WP63 §6.2):
 * the six opcodes and NOP, the three flags the layer sets, and no register
 * opcode at all once it is enabled. The flags entry allows bits and requires
 * none, so it is the layer, which always sets FIXED_FILE, that confines
 * SHUTDOWN to the ring's own table: an SQE written into the ring by other
 * means could name an ordinary descriptor, as it already could for SEND
 * (NURING-39). */
static int ur_restrict(int fd) {
  static const uint8_t ops[] = {UR_OP_ACCEPT, UR_OP_RECV,  UR_OP_SEND,    UR_OP_CLOSE,
                                UR_OP_ASYNC_CANCEL, UR_OP_NOP, UR_OP_SHUTDOWN};
  struct ur_restriction res[sizeof ops + 1];
  memset(res, 0, sizeof res);
  for (size_t i = 0; i < sizeof ops; i++) {
    res[i].opcode = UR_RESTRICTION_SQE_OP;
    res[i].arg = ops[i];
  }
  res[sizeof ops].opcode = UR_RESTRICTION_SQE_FLAGS_ALLOWED;
  res[sizeof ops].arg = UR_SQE_FIXED_FILE | UR_SQE_BUFFER_SELECT | UR_SQE_CQE_SKIP_SUCCESS;
  return ur_register(fd, UR_REGISTER_RESTRICTIONS, res, (unsigned)(sizeof res / sizeof res[0]));
}

/* The pool's keeper: a ring of one entry made disabled, restricted to NOP
 * with no submission flag, and enabled, with nothing mapped or registered.
 * Answers its descriptor or the failing step's negative errno. */
static int ur_make_keeper(void) {
  struct ur_params p;
  int fd = ur_setup_try(1, 0, &p, UR_SETUP_R_DISABLED);
  if (fd < 0) return fd;
  struct ur_restriction res;
  memset(&res, 0, sizeof res);
  res.opcode = UR_RESTRICTION_SQE_OP;
  res.arg = UR_OP_NOP;
  int rc = ur_register(fd, UR_REGISTER_RESTRICTIONS, &res, 1);
  if (rc >= 0) rc = ur_register(fd, UR_REGISTER_ENABLE_RINGS, NULL, 0);
  if (rc < 0) {
    close(fd);
    return rc;
  }
  return fd;
}

/* A new ring of sizes `z`: the SQ and CQ mapped, a sparse table of
 * `z->slots`, the buffer ring registered, the eventfd registered. A
 * `restricted` ring is made disabled, restricted before anything else is
 * registered, and enabled last; it has no SINGLE_ISSUER, which would tie it to
 * the thread that enabled it, the one that runs `.preinit_array`. Answers 0
 * with the ring in `*out`, or the failing step's negative errno with nothing
 * left behind. */
static int ur_make_ring(const struct ur_sizes *z, int restricted, struct ur_ring **out) {
  *out = NULL;
  struct ur_ring *r = calloc(1, sizeof *r);
  if (!r) return -ENOMEM;
  r->fd = -1;
  r->efd = -1;
  int rc = 0;
  struct ur_params p;
  /* The ring itself, and the two features the layer cannot do without. */
  if (restricted)
    r->fd = ur_setup_try(z->sq_entries, z->cq_entries, &p,
                         UR_SETUP_R_DISABLED | UR_SETUP_COOP_TASKRUN | UR_SETUP_TASKRUN_FLAG | UR_SETUP_SUBMIT_ALL |
                             UR_SETUP_CQSIZE);
  else
    r->fd = ur_setup_flags(z->sq_entries, z->cq_entries, &p);
  if (r->fd < 0) {
    rc = r->fd;
    goto fail;
  }
  if (!(p.features & UR_FEAT_SINGLE_MMAP) || !(p.features & UR_FEAT_NODROP)) {
    rc = -EOPNOTSUPP;
    goto fail;
  }
  r->ext_arg = (p.features & UR_FEAT_EXT_ARG) != 0;
  r->restricted = restricted != 0;
  if (restricted) {
    rc = ur_ops_ok(r->fd);
    if (rc < 0) goto fail;
    rc = ur_restrict(r->fd);
    if (rc < 0) goto fail;
  }
  /* SQ and CQ share one mapping (FEAT_SINGLE_MMAP); the SQEs are another. */
  r->sq_entries = p.sq_entries;
  size_t sq_len = p.sq_off.array + (size_t)p.sq_entries * sizeof(uint32_t);
  size_t cq_len = p.cq_off.cqes + (size_t)p.cq_entries * sizeof(struct ur_cqe);
  r->ring_len = sq_len > cq_len ? sq_len : cq_len;
  r->ring_map = mmap(NULL, r->ring_len, PROT_READ | PROT_WRITE, MAP_SHARED | MAP_POPULATE, r->fd, UR_OFF_SQ_RING);
  if (r->ring_map == MAP_FAILED) {
    rc = -errno;
    goto fail;
  }
  char *m = r->ring_map;
  r->sq_head = (uint32_t *)(void *)(m + p.sq_off.head);
  r->sq_tail = (uint32_t *)(void *)(m + p.sq_off.tail);
  r->sq_mask = (uint32_t *)(void *)(m + p.sq_off.ring_mask);
  r->sq_array = (uint32_t *)(void *)(m + p.sq_off.array);
  r->sq_flags = (uint32_t *)(void *)(m + p.sq_off.flags);
  r->cq_head = (uint32_t *)(void *)(m + p.cq_off.head);
  r->cq_tail = (uint32_t *)(void *)(m + p.cq_off.tail);
  r->cq_mask = (uint32_t *)(void *)(m + p.cq_off.ring_mask);
  r->cqes = (struct ur_cqe *)(void *)(m + p.cq_off.cqes);
  r->sqes_len = (size_t)p.sq_entries * sizeof(struct ur_sqe);
  r->sqes = mmap(NULL, r->sqes_len, PROT_READ | PROT_WRITE, MAP_SHARED | MAP_POPULATE, r->fd, UR_OFF_SQES);
  if ((void *)r->sqes == MAP_FAILED) {
    rc = -errno;
    goto fail;
  }
  r->sq_local_tail = *r->sq_tail;

  /* The sparse file table: one entry per slot, filled by FILE_INDEX_ALLOC. */
  struct ur_rsrc_register files;
  memset(&files, 0, sizeof files);
  files.nr = z->slots;
  files.flags = UR_RSRC_REGISTER_SPARSE;
  rc = ur_register(r->fd, UR_REGISTER_FILES2, &files, sizeof files);
  if (rc < 0) goto fail;

  /* The provided-buffer ring every multishot recv draws from; the set fills it. */
  r->br_len = (size_t)z->buf_count * sizeof(struct ur_buf);
  r->bufs_len = (size_t)z->buf_count * z->buf_size;
  r->br = mmap(NULL, r->br_len, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  r->bufs = mmap(NULL, r->bufs_len, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  if ((void *)r->br == MAP_FAILED || (void *)r->bufs == MAP_FAILED) {
    rc = -ENOMEM;
    goto fail;
  }
  struct ur_buf_reg reg;
  memset(&reg, 0, sizeof reg);
  reg.ring_addr = (uint64_t)(uintptr_t)r->br;
  reg.ring_entries = z->buf_count;
  reg.bgid = BGID;
  rc = ur_register(r->fd, UR_REGISTER_PBUF_RING, &reg, 1);
  if (rc < 0) goto fail;

  /* Per-slot state: generation and flags, send queues, parked recvs. */
  r->st = calloc(z->slots, sizeof *r->st);
  r->sq_first = calloc(z->slots, sizeof *r->sq_first);
  r->sq_last = calloc(z->slots, sizeof *r->sq_last);
  r->parked = calloc(z->slots, sizeof *r->parked);
  r->qbytes = calloc(z->slots, sizeof *r->qbytes);
  if (!r->st || !r->sq_first || !r->sq_last || !r->parked || !r->qbytes) {
    rc = -ENOMEM;
    goto fail;
  }

  /* The eventfd the kernel signals for this ring. */
  r->efd = eventfd(0, EFD_NONBLOCK | EFD_CLOEXEC);
  if (r->efd < 0) {
    rc = -errno;
    goto fail;
  }
  rc = ur_register(r->fd, UR_REGISTER_EVENTFD, &r->efd, 1);
  if (rc < 0) goto fail;
  if (restricted) {
    rc = ur_register(r->fd, UR_REGISTER_ENABLE_RINGS, NULL, 0);
    if (rc < 0) goto fail;
  }
  *out = r;
  return 0;
fail:
  ur_free_ring(r);
  return rc < 0 ? rc : -EINVAL;
}

/* A new ring in the set: made, or taken from the pool when `--sandbox` made
 * one (-ENOSPC when the pool is spent), then its buffer ring filled and its
 * eventfd in the set's epoll with the ring's index as its data. Answers the
 * ring's index or a negative errno, and leaves nothing behind on failure. */
static int ur_add_ring(struct nish_uring_set *s) {
  if (s->nrings >= s->rings_max) return -ENOSPC;
  struct ur_ring *r;
  if (ur_pool.made) {
    /* A full set asks again on every top-up, so a spent pool answers without
       counting: `next` stays within the threads past `n` and never wraps to
       a negative index (NURING-34). */
    if (__atomic_load_n(&ur_pool.next, __ATOMIC_RELAXED) >= ur_pool.n) return -ENOSPC;
    int i = __atomic_fetch_add(&ur_pool.next, 1, __ATOMIC_RELAXED);
    if (i >= ur_pool.n) return -ENOSPC;
    r = ur_pool.rings[i];
    ur_pool.rings[i] = NULL;
  } else {
    struct ur_sizes z = {s->slots, s->buf_count, s->buf_size, s->sq_entries, s->cq_entries};
    int rc = ur_make_ring(&z, 0, &r);
    if (rc < 0) return rc;
  }
  for (uint32_t i = 0; i < s->buf_count; i++) ur_recycle(s, r, i);
  struct epoll_event ev;
  memset(&ev, 0, sizeof ev);
  ev.events = EPOLLIN;
  ev.data.u32 = (uint32_t)s->nrings;
  if (epoll_ctl(s->ep, EPOLL_CTL_ADD, r->efd, &ev) != 0) {
    int rc = -errno;
    ur_free_ring(r);
    return rc;
  }
  s->rings[s->nrings] = r;
  s->stats.rings = ++s->nrings;
  s->stats.slots = (int64_t)s->nrings * s->slots;
  return s->nrings - 1;
}

/* Make `n` restricted rings of `slots` slots, at the sizes a set opens with
 * by default, for the sets this process opens later (WP63 S3). `--sandbox`
 * calls it once, before its seccomp filter and before any thread; with `n`
 * of 0 it only records that this process may not make a ring (-EPERM). A
 * kernel below the probe's floor makes none, and a ring that fails any step
 * closes every ring made; either way the pool answers that step's errno from
 * then on: the process falls back to descriptors for good.
 * Answers the number of rings made or that errno, and writes each ring's
 * descriptor to `fds`, which holds 65: the only descriptors the filter lets
 * `io_uring_enter` take, then the keeper's after them, which the filter
 * keeps every one of those numbers on (NURING-36). */
int32_t nish_uring_premake(int32_t n, int32_t slots, int32_t *fds) {
  if (ur_pool.made) return ur_pool.rc;
  ur_pool.made = 1;
  if (n <= 0) return ur_pool.rc = -EPERM;
  /* A restricted ring drops SINGLE_ISSUER and DEFER_TASKRUN, so it alone
     would take a 5.19 or 6.0 kernel; the probe holds the pool to the floor
     an unsandboxed set has, 6.1 (NURING-33). */
  int32_t probed = ur_probe_once();
  if (probed < 0) return ur_pool.rc = probed;
  if (n > UR_POOL_MAX) n = UR_POOL_MAX;
  if (slots < 1) slots = 1;
  if (slots > UR_MAX_SLOTS) slots = UR_MAX_SLOTS;
  ur_pool.z = (struct ur_sizes){(uint32_t)slots, UR_BUF_COUNT_DEFAULT, UR_BUF_SIZE_DEFAULT, UR_SQ_DEFAULT, UR_CQ_DEFAULT};
  for (int i = 0; i < n; i++) {
    int rc = ur_make_ring(&ur_pool.z, 1, &ur_pool.rings[i]);
    if (rc < 0) {
      for (int j = 0; j < i; j++) ur_free_ring(ur_pool.rings[j]);
      memset(ur_pool.rings, 0, sizeof ur_pool.rings);
      return ur_pool.rc = rc;
    }
  }
  int keeper = ur_make_keeper();
  if (keeper < 0) {
    for (int j = 0; j < n; j++) ur_free_ring(ur_pool.rings[j]);
    memset(ur_pool.rings, 0, sizeof ur_pool.rings);
    return ur_pool.rc = keeper;
  }
  for (int i = 0; i < n; i++) fds[i] = ur_pool.fds[i] = ur_pool.rings[i]->fd;
  fds[n] = ur_pool.keeper = keeper;
  ur_pool.n = n;
  return ur_pool.rc = n;
}

/* The slots of each ring `--sandbox` made, 0 when it made none, or -1 when
 * it ran and made none: a set must open with the pool's sizes. */
int32_t nish_uring_pooled(void) {
  if (!ur_pool.made) return 0;
  return ur_pool.rc > 0 ? (int32_t)ur_pool.z.slots : -1;
}

#ifdef NISH_URING_TEST_HOOKS
/* Test-only: tests/run.js's sandbox section builds the runtime with
 * -DNISH_URING_TEST_HOOKS to ask the kernel what a premade ring takes, and
 * scripts/build.sh never passes it. Submits one entry of opcode `op` with
 * submission flags `flags`, on descriptor `fd`, to premade ring `i` before a
 * listener has taken it, and answers its completion's res: -EACCES is the
 * ring's restriction. -ENOENT when no such ring was made or it was taken. */
int32_t nish_uring_test_submit_fd(int32_t i, int32_t op, int32_t flags, int32_t fd);
int32_t nish_uring_test_submit_fd(int32_t i, int32_t op, int32_t flags, int32_t fd) {
  if (!ur_pool.made || ur_pool.rc <= 0 || i < 0 || i >= ur_pool.n || ur_pool.rings[i] == NULL) return -ENOENT;
  struct ur_ring *r = ur_pool.rings[i];
  struct ur_sqe *e = ur_sqe(r);
  if (e == NULL) return -EBUSY;
  e->opcode = (uint8_t)op;
  e->flags = (uint8_t)flags;
  e->fd = fd;
  e->user_data = 1;
  int rc;
  do rc = ur_enter(r, r->to_submit, 1, UR_ENTER_GETEVENTS);
  while (rc == -EINTR);
  if (rc < 0) return rc;
  r->to_submit = 0;
  uint32_t head = *r->cq_head;
  if (head == __atomic_load_n(r->cq_tail, __ATOMIC_ACQUIRE)) return -EAGAIN;
  int32_t res = r->cqes[head & *r->cq_mask].res;
  __atomic_store_n(r->cq_head, head + 1, __ATOMIC_RELEASE);
  return res;
}
/* As `nish_uring_test_submit_fd`, on no file. */
int32_t nish_uring_test_submit(int32_t i, int32_t op, int32_t flags);
int32_t nish_uring_test_submit(int32_t i, int32_t op, int32_t flags) { return nish_uring_test_submit_fd(i, op, flags, -1); }
/* The number premade ring `i` was made at, whether or not a set has taken
 * it since, or the keeper's for `i` equal to the ring count; -ENOENT for
 * any other `i`. */
int32_t nish_uring_test_fd(int32_t i);
int32_t nish_uring_test_fd(int32_t i) {
  if (!ur_pool.made || ur_pool.rc <= 0 || i < 0 || i > ur_pool.n) return -ENOENT;
  return i == ur_pool.n ? ur_pool.keeper : ur_pool.fds[i];
}
#endif

static int64_t ur_now_ms(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return (int64_t)t.tv_sec * 1000 + t.tv_nsec / 1000000;
}

/* Keep min(ACCEPT_DEPTH, free slots) accepts in flight on the accepting ring,
 * and only there (behaviours 2 and 3). A full acceptor with nothing in flight
 * hands the job to the next ring with a free slot, making one when none has
 * and the set may grow; with `rings_max` reached and every ring full,
 * connections wait in the listener's backlog until a close frees a slot. */
static void ur_top_up(struct nish_uring_set *s) {
  if (s->accept_stopped || s->nrings == 0) return;
  if (s->accept_paused) {
    if (ur_now_ms() < s->resume_ms) return;
    s->accept_paused = 0;
  }
  struct ur_ring *r = s->rings[s->acceptor];
  if (r->live + r->accepting >= (long)s->slots && r->accepting == 0) {
    int moved = 0;
    for (int i = 1; i <= s->nrings; i++) {
      int j = (s->acceptor + i) % s->nrings;
      if (s->rings[j]->live < (long)s->slots) {
        s->acceptor = j;
        moved = 1;
        break;
      }
    }
    if (!moved) {
      int j = ur_add_ring(s);
      if (j < 0) return;
      s->acceptor = j;
    }
    r = s->rings[s->acceptor];
  }
  while (r->accepting < ACCEPT_DEPTH && r->live + r->accepting < (long)s->slots) {
    struct ur_sqe *e = ur_sqe(r);
    if (!e) break;
    e->opcode = UR_OP_ACCEPT;
    e->fd = s->listener;
    e->file_index = UR_FILE_INDEX_ALLOC;
    e->user_data = UR_ACCEPT;
    r->accepting++;
  }
  long accepting = 0, rings = 0;
  for (int i = 0; i < s->nrings; i++) {
    accepting += s->rings[i]->accepting;
    rings += s->rings[i]->accepting > 0;
  }
  s->stats.accepting = accepting;
  if (rings > s->stats.max_accepting_rings) s->stats.max_accepting_rings = rings;
}

/* Submit the slot's first queued send, from where the kernel left off, or
 * its shutdown. */
static void ur_send_head(struct ur_ring *r, uint32_t slot, struct nish_uring_set *s) {
  struct ur_send *q = r->sq_first[slot];
  if (!q || q->in_flight) return;
  struct ur_sqe *e = ur_sqe(r);
  if (!e) {
    s->stalled_sends++;
    return;
  }
  e->fd = (int32_t)slot;
  e->flags = UR_SQE_FIXED_FILE;
  if (q->how >= 0) {
    e->opcode = UR_OP_SHUTDOWN;
    e->len = (uint32_t)q->how;
  } else {
    e->opcode = UR_OP_SEND;
    e->addr = (uint64_t)(uintptr_t)(q->data + q->off);
    e->len = q->len - q->off;
    e->op_flags = MSG_NOSIGNAL;
  }
  e->user_data = (uint64_t)(uintptr_t)q | UR_SEND;
  q->in_flight = 1;
}

static void ur_unlink_all(struct nish_uring_set *s, struct ur_send *q) {
  if (q->prev_all) q->prev_all->next_all = q->next_all;
  else s->all = q->next_all;
  if (q->next_all) q->next_all->prev_all = q->prev_all;
  free(q);
}

/* Drop a slot's queued sends. The one the kernel holds, if any, is left on
 * the all-records list; its completion finds the generation moved on and
 * frees it. */
static void ur_drop_sends(struct nish_uring_set *s, struct ur_ring *r, uint32_t slot) {
  struct ur_send *q = r->sq_first[slot];
  r->sq_first[slot] = r->sq_last[slot] = NULL;
  r->qbytes[slot] = 0;
  while (q) {
    struct ur_send *next = q->next;
    q->next = NULL;
    if (!q->in_flight) ur_unlink_all(s, q);
    q = next;
  }
}

/* An accept that failed for this one peer; the next is submitted at once. */
static int ur_transient_accept(int res) {
  return res == -EAGAIN || res == -EINTR || res == -ECONNABORTED || res == -EPROTO;
}

/* An accept that found the kernel short of memory for a socket (NURING-28).
 * It clears as memory frees, so accepting pauses and resumes; submitting
 * again at once would spin on the same answer while the shortage lasts. */
static int ur_pressure_accept(int res) { return res == -ENOMEM || res == -ENOBUFS; }

static void ur_event(struct nish_uring_event *ev, int kind, int ring, uint32_t slot, int res, const uint8_t *data) {
  ev->kind = kind;
  ev->ring = ring;
  ev->slot = (int32_t)slot;
  ev->res = res;
  ev->data = data;
}

/* One completion. Answers 1 when it wrote an event. */
static int ur_complete(struct nish_uring_set *s, int ri, const struct ur_cqe *c, struct nish_uring_event *ev) {
  struct ur_ring *r = s->rings[ri];
  uint64_t ud = c->user_data;
  int res = c->res;
  if ((ud & 7) == UR_SEND) {
    struct ur_send *q = (struct ur_send *)(uintptr_t)(ud & ~(uint64_t)7);
    q->in_flight = 0;
    uint32_t slot = q->slot;
    if ((r->st[slot] & ST_OPEN) == 0 || ST_GEN(r->st[slot]) != q->gen || r->sq_first[slot] != q) {
      ur_unlink_all(s, q);
      return 0;
    }
    if (q->how >= 0) {
      /* A shutdown's answer is not a send's failure: -ENOTCONN from a peer
       * already gone says nothing a recv will not, so it is not reported. */
      res = 0;
    }
    if (res > 0) r->qbytes[slot] -= (uint32_t)res < r->qbytes[slot] ? (uint32_t)res : r->qbytes[slot];
    if (res > 0 && q->off + (uint32_t)res < q->len) {
      q->off += (uint32_t)res;
      s->stats.send_requeues++;
    } else if (res == -EINTR || res == -EAGAIN || res == -ENOBUFS) {
      s->stats.send_requeues++;
    } else if (res < 0) {
      /* q is the head and no longer in flight, so this frees it with the rest. */
      ur_drop_sends(s, r, slot);
      ur_event(ev, NISH_URING_SEND_FAILED, ri, slot, res, NULL);
      return 1;
    } else {
      r->sq_first[slot] = q->next;
      if (!q->next) r->sq_last[slot] = NULL;
      ur_unlink_all(s, q);
    }
    ur_send_head(r, slot, s);
    return 0;
  }
  if (ud == UR_POLL) {
    /* The direct wait's poll on its caller's descriptor ended: its events
     * wait for nish_uring_poll_events. A failure other than a cancel (the
     * descriptor closed, a kernel that refuses the opcode) stops the watch
     * for good, so a poll that cannot work is not re-armed every sleep. */
    s->poll_armed = 0;
    if (res > 0) s->poll_revents |= res;
    else if (res < 0 && res != -ECANCELED) s->poll_broken = 1;
    return 0;
  }
  unsigned op = (unsigned)(ud & 0xff);
  uint32_t gen = (uint32_t)(ud >> 8) & GEN_MASK;
  uint32_t slot = (uint32_t)(ud >> 32);
  if (op == UR_ACCEPT) {
    r->accepting--;
    res = UR_ACCEPT_RES(res);
    int wrote = 0;
    if (res >= 0 && (uint32_t)res < s->slots) {
      uint32_t at = (uint32_t)res;
      s->backoff_ms = 0;
      r->st[at] = (r->st[at] & ~(ST_ARMED | ST_PARKED | ST_HELD | ST_HUP)) | ST_OPEN;
      r->live++;
      s->stats.live++;
      ur_arm(r, at);
      ur_event(ev, NISH_URING_ACCEPTED, ri, at, 0, NULL);
      wrote = 1;
    } else if (res >= 0) {
      /* A slot past the table the set registered; the kernel never answers
       * one, so it is counted rather than trusted. */
      s->stats.bound_violations++;
    } else if (ur_pressure_accept(res)) {
      /* Accepts already in flight may fail the same way; one pause covers them. */
      if (!s->accept_paused) {
        s->accept_paused = 1;
        s->backoff_ms = s->backoff_ms ? s->backoff_ms * 2 : ACCEPT_BACKOFF_MIN_MS;
        if (s->backoff_ms > ACCEPT_BACKOFF_MAX_MS) s->backoff_ms = ACCEPT_BACKOFF_MAX_MS;
        s->resume_ms = ur_now_ms() + s->backoff_ms;
        s->stats.accept_pauses++;
        ur_event(ev, NISH_URING_ACCEPT_PAUSED, ri, 0, res, NULL);
        wrote = 1;
      }
    } else if (!ur_transient_accept(res)) {
      s->stats.accept_errors++;
      if (res == -ENFILE) s->stats.bound_violations++;
      if (!s->accept_stopped) {
        s->accept_stopped = 1;
        ur_event(ev, NISH_URING_ACCEPT_FAILED, ri, 0, res, NULL);
        wrote = 1;
      }
    }
    ur_top_up(s);
    return wrote;
  }
  if (op != UR_RECV) return 0; /* a close or cancel; nothing to report */
  int stale = slot >= s->slots || (r->st[slot] & ST_OPEN) == 0 || (ST_GEN(r->st[slot]) & GEN_MASK) != gen;
  int more = (c->flags & UR_CQE_F_MORE) != 0;
  uint32_t bid = c->flags >> UR_CQE_BUFFER_SHIFT;
  int has_buf = (c->flags & UR_CQE_F_BUFFER) != 0 && bid < s->buf_count;
  if (stale) {
    if (has_buf) ur_recycle(s, r, bid);
    return 0;
  }
  if (!more) r->st[slot] &= ~ST_ARMED;
  if (res > 0 && has_buf) {
    s->lent_ring[s->nlent] = (uint32_t)ri;
    s->lent_bid[s->nlent] = (uint16_t)bid;
    s->nlent++;
    if (!more && !(r->st[slot] & ST_HELD)) ur_arm(r, slot);
    ur_event(ev, NISH_URING_DATA, ri, slot, res, r->bufs + (size_t)bid * s->buf_size);
    return 1;
  }
  if (has_buf) ur_recycle(s, r, bid);
  /* Only a hold cancels a live slot's recv (a close moves the generation on
   * first). The recv stays down while the slot is held, and one let go before
   * the cancel landed is armed again; a held recv out of buffers stays down. */
  if (!more && res == -ECANCELED) {
    if (!(r->st[slot] & ST_HELD)) ur_arm(r, slot);
    return 0;
  }
  if (!more && res == -ENOBUFS && (r->st[slot] & ST_HELD)) return 0;
  if (res == -ENOBUFS) {
    s->stats.nobufs_rearms++;
    if (!more && !(r->st[slot] & ST_PARKED)) {
      r->st[slot] |= ST_PARKED;
      r->parked[r->nparked++] = slot;
    }
    return 0;
  }
  if (more) return 0;
  r->st[slot] |= ST_HUP;
  ur_event(ev, NISH_URING_HUP, ri, slot, res, NULL);
  return 1;
}

/* Take completions until the CQ is empty or `cap` events are written; what
 * does not fit stays in the CQ for the next wait. */
static int ur_reap(struct nish_uring_set *s, int ri, struct nish_uring_event *ev, int cap) {
  struct ur_ring *r = s->rings[ri];
  int n = 0;
  uint32_t head = *r->cq_head;
  for (;;) {
    uint32_t tail = __atomic_load_n(r->cq_tail, __ATOMIC_ACQUIRE);
    if (head == tail || n >= cap) break;
    struct ur_cqe c = r->cqes[head & *r->cq_mask];
    head++;
    /* Give the entry back before handling it, so a completion's handler that
     * flushes (an accept topping up) frees room in the CQ for what it makes. */
    __atomic_store_n(r->cq_head, head, __ATOMIC_RELEASE);
    n += ur_complete(s, ri, &c, ev + n);
  }
  return n;
}

/* Reap, submit, and enter again while the kernel says it holds more for this
 * ring (behaviour 4): IORING_SQ_TASKRUN for completions DEFER_TASKRUN has not
 * run, IORING_SQ_CQ_OVERFLOW for ones the CQ had no room for. A flush that
 * answers -EBUSY (a kernel that refuses submissions while completions
 * overflow) is retried at once with no backoff: the reap before it has
 * freed CQ room, so the next pass moves the overflow along. The guard only
 * bounds a kernel that keeps a flag up without progress; the next wait
 * starts again from here. */
static int ur_service(struct nish_uring_set *s, int ri, struct nish_uring_event *ev, int cap) {
  struct ur_ring *r = s->rings[ri];
  int n = 0;
  for (int guard = 0; guard < 1 << 16; guard++) {
    n += ur_reap(s, ri, ev + n, cap - n);
    int rc = ur_flush(r);
    if (n >= cap) break;
    uint32_t flags = __atomic_load_n(r->sq_flags, __ATOMIC_ACQUIRE);
    if (flags & (UR_SQ_TASKRUN | UR_SQ_CQ_OVERFLOW)) {
      if (flags & UR_SQ_TASKRUN) s->stats.taskrun_reentries++;
      if (flags & UR_SQ_CQ_OVERFLOW) s->stats.overflow_drains++;
      rc = ur_enter(r, 0, 0, UR_ENTER_GETEVENTS);
      if (rc < 0 && rc != -EINTR && rc != -EBUSY && rc != -EAGAIN) break;
      continue;
    }
    if (rc == -EBUSY) continue;
    if (*r->cq_head == __atomic_load_n(r->cq_tail, __ATOMIC_ACQUIRE)) break;
  }
  return n;
}

int32_t nish_uring_open(struct nish_uring_set **out, int32_t listener, const struct nish_uring_opts *o) {
  *out = NULL;
  int32_t ok = nish_uring_probe();
  if (ok < 0) return ok;
  struct nish_uring_opts d;
  memset(&d, 0, sizeof d);
  if (o) d = *o;
  if (listener < 0 || d.slots < 0 || d.rings_max < 0 || d.sq_entries < 0 || d.cq_entries < 0 || d.buf_count < 0 ||
      d.buf_size < 0)
    return -EINVAL;
  if (d.slots == 0) {
    struct rlimit rl;
    if (getrlimit(RLIMIT_NOFILE, &rl) != 0) return -errno;
    d.slots = rl.rlim_cur == RLIM_INFINITY || rl.rlim_cur > UR_MAX_SLOTS ? UR_MAX_SLOTS : (int32_t)rl.rlim_cur;
  }
  if (d.slots > UR_MAX_SLOTS) return -EINVAL;
  if (d.rings_max == 0) d.rings_max = 64;
  if (d.sq_entries == 0) d.sq_entries = UR_SQ_DEFAULT;
  if (d.cq_entries == 0) d.cq_entries = UR_CQ_DEFAULT;
  if (d.cq_entries < d.sq_entries) d.cq_entries = d.sq_entries;
  if (d.buf_count == 0) d.buf_count = UR_BUF_COUNT_DEFAULT;
  if (d.buf_size == 0) d.buf_size = UR_BUF_SIZE_DEFAULT;
  if (d.rings_max > 4096 || d.buf_count > 32768 || (d.buf_count & (d.buf_count - 1)) != 0 || d.buf_size > (1 << 20))
    return -EINVAL;
  /* A pooled ring was made at its own sizes, before the program could ask. */
  if (ur_pool.made) {
    d.slots = (int32_t)ur_pool.z.slots;
    d.sq_entries = (int32_t)ur_pool.z.sq_entries;
    d.cq_entries = (int32_t)ur_pool.z.cq_entries;
    d.buf_count = (int32_t)ur_pool.z.buf_count;
    d.buf_size = (int32_t)ur_pool.z.buf_size;
  }
  struct nish_uring_set *s = calloc(1, sizeof *s);
  if (!s) return -ENOMEM;
  s->listener = listener;
  s->slots = (uint32_t)d.slots;
  s->rings_max = d.rings_max;
  s->sq_entries = (uint32_t)d.sq_entries;
  s->cq_entries = (uint32_t)d.cq_entries;
  s->buf_count = (uint32_t)d.buf_count;
  s->buf_size = (uint32_t)d.buf_size;
  s->rings = calloc((size_t)d.rings_max, sizeof *s->rings);
  s->poll_fd = -1;
  s->ep = epoll_create1(EPOLL_CLOEXEC);
  if (!s->rings || s->ep < 0) {
    int rc = s->ep < 0 ? -errno : -ENOMEM;
    if (s->ep >= 0) close(s->ep);
    free(s->rings);
    free(s);
    return rc;
  }
  int rc = ur_add_ring(s);
  if (rc < 0) {
    close(s->ep);
    free(s->rings);
    free(s);
    return rc;
  }
  ur_top_up(s);
  (void)ur_flush(s->rings[0]);
  *out = s;
  return 0;
}

/* The epoll descriptor a caller's own loop may wait on beside other sources.
 * It is readable when a ring's eventfd was signalled since that ring was last
 * serviced. It is not readable for events a wait left behind because `cap`
 * was full, so a caller that got `cap` events calls wait again (with a
 * timeout of 0) before it sleeps on this descriptor. Sends and closes are
 * only queued: the next wait hands them to the kernel, so a caller calls
 * wait after them, too, before it sleeps here. A wait returns with nothing
 * left queued unless the kernel refused the submission (-EBUSY while
 * completions overflow, -EAGAIN or -ENOMEM for memory): then the ring has
 * completions to reap or the refusal is transient, and the next wait
 * submits them again.
 *
 * Readable is not the whole answer: the kernel can hold a ring's work with
 * IORING_SQ_TASKRUN up and its eventfd never signalled (NURING-8). A caller
 * that sleeps on this descriptor, alone or beside other sources, asks
 * `nish_uring_sleep_ms` right before it sleeps and sleeps no longer than it
 * answers, then calls wait (with a timeout of 0) whether or not the
 * descriptor became readable. */
int32_t nish_uring_fd(const struct nish_uring_set *s) { return s->ep; }

/* Whether the kernel holds work for one of the ring's completions to post:
 * deferred task work (IORING_SQ_TASKRUN) or completions the CQ had no room
 * for (IORING_SQ_CQ_OVERFLOW). Its eventfd may say nothing of either. */
static int ur_flagged(const struct ur_ring *r) {
  return (__atomic_load_n(r->sq_flags, __ATOMIC_ACQUIRE) & (UR_SQ_TASKRUN | UR_SQ_CQ_OVERFLOW)) != 0;
}

/* The longest sleep on a set: the kernel's eventfd signal can be lost
 * (NURING-8), so the timer is what wakes a sleeper to service a ring the
 * kernel flagged. 10 ms bounds a lost wake's delay; idle, it costs a set 100
 * wakes a second. */
#define UR_SLEEP_MAX_MS 10

/* How long a caller may sleep on `nish_uring_fd` before it calls wait, given
 * the longest it wants (`timeout_ms`, -1 for ever). Answers 0 while a wait has
 * work it can do now: a ring the kernel flagged, completions not yet reaped,
 * buffers the last wait lent, or recvs parked or sends stalled on a full SQ
 * that every ring has room for again. Otherwise answers `timeout_ms` cut to
 * UR_SLEEP_MAX_MS. Submissions the kernel refused, and what waits on them, are
 * retried after that bound, not at once, so a refusal that persists does not
 * spin the caller. */
int32_t nish_uring_sleep_ms(const struct nish_uring_set *s, int32_t timeout_ms) {
  int room = 1, parked = 0;
  for (int ri = 0; ri < s->nrings; ri++) {
    const struct ur_ring *r = s->rings[ri];
    if (ur_flagged(r) || *r->cq_head != __atomic_load_n(r->cq_tail, __ATOMIC_ACQUIRE)) return 0;
    if (r->to_submit) room = 0;
    if (r->nparked) parked = 1;
  }
  if (s->nlent || (room && (parked || s->stalled_sends))) return 0;
  int32_t bound = UR_SLEEP_MAX_MS;
  if (s->accept_paused) {
    int64_t left = s->resume_ms - ur_now_ms();
    if (left <= 0) return 0;
    if (left < bound) bound = (int32_t)left;
  }
  return timeout_ms < 0 || timeout_ms > bound ? bound : timeout_ms;
}

/* What the last wait left to do: give back the buffers it lent, re-arm the
 * recvs it parked, and submit the sends that found the SQ full. */
static void ur_catch_up(struct nish_uring_set *s) {
  if (s->accept_paused) ur_top_up(s); /* accepting resumes once the back-off ends */
  for (int i = 0; i < s->nlent; i++) ur_recycle(s, s->rings[s->lent_ring[i]], s->lent_bid[i]);
  s->nlent = 0;
  for (int ri = 0; ri < s->nrings; ri++) {
    struct ur_ring *r = s->rings[ri];
    uint32_t n = r->nparked;
    r->nparked = 0;
    for (uint32_t i = 0; i < n; i++) {
      uint32_t slot = r->parked[i];
      r->st[slot] &= ~ST_PARKED;
      if ((r->st[slot] & (ST_OPEN | ST_ARMED | ST_HELD)) == ST_OPEN) ur_arm(r, slot);
    }
  }
  /* Scanning every slot of every ring costs rings * slots, but only after a
   * send found the SQ full, which a queue of `sq_entries` (1,024 by default)
   * makes rare; keeping a list of the stalled slots would cost every send. */
  if (s->stalled_sends) {
    s->stalled_sends = 0;
    for (int ri = 0; ri < s->nrings; ri++)
      for (uint32_t slot = 0; slot < s->slots; slot++)
        if (s->rings[ri]->sq_first[slot]) ur_send_head(s->rings[ri], slot, s);
  }
}

/* Hand every ring's queued submissions to the kernel before a wait returns
 * or sleeps. Servicing a ring submits its own, but an accept or a close there
 * can move the accepting job to a ring the wait already passed or will not
 * reach (`cap` full, or not ready), and that ring's new accepts would sit in
 * user space while the caller sleeps on `nish_uring_fd`. A refused flush
 * leaves them queued for the next wait, as ur_flush says. */
static void ur_submit_queued(struct nish_uring_set *s) {
  for (int ri = 0; ri < s->nrings; ri++)
    if (s->rings[ri]->to_submit) (void)ur_flush(s->rings[ri]);
}

/* Wait for events and write at most `cap` of them, at most 256. Answers the
 * count or a negative errno. A DATA event's bytes are the set's buffer until
 * the next wait. A `timeout_ms` of -1 waits until there are events (or answers
 * 0 when a signal interrupts it); 0 does not sleep. Any other timeout is a
 * most, not a least: the wait sleeps no longer than `nish_uring_sleep_ms`
 * answers (NURING-8), so it can answer 0 early, while work is pending or
 * after UR_SLEEP_MAX_MS, and a caller that wants the whole timeout waits again
 * for what is left of it. */
int32_t nish_uring_wait(struct nish_uring_set *s, int32_t timeout_ms, struct nish_uring_event *ev, int32_t cap) {
  if (cap <= 0) return -EINVAL;
  if (cap > EVENTS_MAX) cap = EVENTS_MAX;
again:
  ur_catch_up(s);
  int n = 0;
  for (int ri = 0; ri < s->nrings && n < cap; ri++) n += ur_service(s, ri, ev + n, cap - n);
  ur_submit_queued(s);
  if (n > 0) return n;
  /* No eventfd is trusted to end the sleep (NURING-8): the bound does, and the
   * flagged rings are serviced below whether an eventfd was read or not. */
  struct epoll_event ready[64];
  int k = epoll_wait(s->ep, ready, 64, nish_uring_sleep_ms(s, timeout_ms));
  if (k < 0) return errno == EINTR ? 0 : -errno;
  for (int i = 0; i < k && n < cap; i++) {
    uint32_t ri = ready[i].data.u32;
    if (ri >= (uint32_t)s->nrings) continue;
    struct ur_ring *r = s->rings[ri];
    uint64_t v;
    (void)!read(r->efd, &v, sizeof v);
    (void)ur_enter(r, 0, 0, UR_ENTER_GETEVENTS);
    n += ur_service(s, (int)ri, ev + n, cap - n);
  }
  for (int ri = 0; ri < s->nrings && n < cap; ri++)
    if (ur_flagged(s->rings[ri])) n += ur_service(s, ri, ev + n, cap - n);
  ur_submit_queued(s);
  if (n == 0 && timeout_ms < 0) goto again;
  return n;
}

/* Sleep on the set's one ring itself rather than on `nish_uring_fd`: one
 * io_uring_enter that submits what is queued and waits for `min_complete`
 * completions (at least 1, at most the CQ's size) or until a timeout passes,
 * the timeout `nish_uring_sleep_ms` allows for `timeout_ms`, carried in
 * IORING_ENTER_EXT_ARG. With DEFER_TASKRUN the enter runs the ring's task
 * work itself, so no eventfd signal is waited for and none can be lost; the
 * NURING-8 bound is kept all the same, so a ring the kernel flags without a
 * completion is still serviced within UR_SLEEP_MAX_MS. A `watch_fd` of 0 or
 * more is watched by a one-shot POLL_ADD in the ring, armed once and taken
 * with `nish_uring_poll_events` (NURING-45), so a caller that also waits on one
 * descriptor, `signalFd()`, needs no epoll set beside the ring.
 *
 * Answers 0 after a sleep or when there is work to do now, and the caller
 * then takes events with `nish_uring_wait(s, 0, ...)`; -EOPNOTSUPP when the
 * set has more than one ring, the kernel lacks IORING_FEAT_EXT_ARG (before
 * 5.11), or `watch_fd` cannot be watched (a restricted ring, a poll that
 * failed, or one still armed on another descriptor), and the caller sleeps on
 * `nish_uring_fd` as before; or the enter's negative errno. A timeout or a
 * signal ends the sleep with 0, as epoll_wait's would. */
int32_t nish_uring_wait_direct(struct nish_uring_set *s, int32_t watch_fd, int32_t min_complete, int32_t timeout_ms) {
  if (s->nrings != 1) return -EOPNOTSUPP;
  struct ur_ring *r = s->rings[0];
  if (!r->ext_arg) return -EOPNOTSUPP;
  if (watch_fd >= 0 && (r->restricted || s->poll_broken || (s->poll_armed && s->poll_fd != watch_fd)))
    return -EOPNOTSUPP;
  /* Armed even for a wait that does not sleep, so a loop whose slots are
   * always ready still hears the descriptor: the caller's pump submits it. */
  if (watch_fd >= 0 && !s->poll_armed && s->poll_revents == 0) {
    struct ur_sqe *e = ur_sqe(r);
    if (!e) return 0; /* a full SQ: the caller pumps, which flushes it */
    e->opcode = UR_OP_POLL_ADD;
    e->fd = watch_fd;
    e->op_flags = POLLIN;
    e->user_data = UR_POLL;
    s->poll_armed = 1;
    s->poll_fd = watch_fd;
  }
  /* A poll already answered, by a pump that reaped it before this wait, is
   * work to do now: sleeping would hold a pending signal for a whole enter. */
  if (watch_fd >= 0 && s->poll_revents != 0) return 0;
  int32_t t = nish_uring_sleep_ms(s, timeout_ms);
  if (t == 0) return 0;
  struct {
    int64_t sec, nsec;
  } ts = {t / 1000, (int64_t)(t % 1000) * 1000000};
  struct {
    uint64_t sigmask;
    uint32_t sigmask_sz, min_wait_usec;
    uint64_t ts;
  } arg = {0, 0, 0, (uint64_t)(uintptr_t)&ts};
  uint32_t want = min_complete < 1 ? 1 : (uint32_t)min_complete;
  if (want > s->cq_entries) want = s->cq_entries;
  s->stats.direct_waits++;
  int rc = ur_errno(syscall(__NR_io_uring_enter, r->fd, r->to_submit, want, UR_ENTER_GETEVENTS | UR_ENTER_EXT_ARG,
                            &arg, sizeof arg));
  if (rc > 0) r->to_submit -= (uint32_t)rc > r->to_submit ? r->to_submit : (uint32_t)rc;
  if (rc >= 0 || rc == -ETIME || rc == -EINTR || rc == -EBUSY || rc == -EAGAIN) return 0;
  return rc;
}

/* The events the direct wait's poll answered since they were last taken
 * (POLLIN, POLLHUP and POLLERR as poll(2) gives them), or 0; `take` clears
 * them, so the next direct wait arms the poll again. They say the descriptor
 * was ready, not that it still is: the caller asks its own epoll set. */
int32_t nish_uring_poll_events(struct nish_uring_set *s, int32_t take) {
  int32_t v = s->poll_revents;
  if (take) s->poll_revents = 0;
  return v;
}

static struct ur_ring *ur_open_slot(struct nish_uring_set *s, int32_t ring, int32_t slot) {
  if (ring < 0 || ring >= s->nrings || slot < 0 || (uint32_t)slot >= s->slots) return NULL;
  struct ur_ring *r = s->rings[ring];
  return (r->st[slot] & ST_OPEN) ? r : NULL;
}

/* Put `q` on the set's list of records and behind the slot's queue, and
 * submit it if it is now the head. */
static void ur_enqueue(struct nish_uring_set *s, struct ur_ring *r, uint32_t slot, struct ur_send *q) {
  q->next = NULL;
  q->prev_all = NULL;
  q->next_all = s->all;
  if (s->all) s->all->prev_all = q;
  s->all = q;
  if (r->sq_last[slot]) {
    r->sq_last[slot]->next = q;
  } else {
    r->sq_first[slot] = q;
  }
  r->sq_last[slot] = q;
  ur_send_head(r, slot, s);
}

/* Queue `n` bytes for (ring, slot). They are copied, so the caller's buffer
 * is free on return; a failure comes back later as a SEND_FAILED event. */
int32_t nish_uring_send(struct nish_uring_set *s, int32_t ring, int32_t slot, const uint8_t *p, int32_t n) {
  struct ur_ring *r = ur_open_slot(s, ring, slot);
  if (!r) return -EBADF;
  if (n < 0) return -EINVAL;
  if (n == 0) return 0;
  struct ur_send *q = malloc(sizeof *q + (size_t)n);
  if (!q) return -ENOMEM;
  memcpy(q->data, p, (size_t)n);
  q->slot = (uint32_t)slot;
  q->gen = ST_GEN(r->st[slot]);
  q->off = 0;
  q->len = (uint32_t)n;
  q->in_flight = 0;
  q->how = -1;
  r->qbytes[slot] += (uint32_t)n;
  ur_enqueue(s, r, (uint32_t)slot, q);
  return n;
}

/* Queue a shutdown of (ring, slot)'s `how` side (0 read, 1 write, 2 both)
 * behind the bytes already queued for it, so they reach the peer first. Its
 * answer is not reported: a shutdown that fails, as on a peer already gone,
 * leaves a connection whose next read or write says so. */
int32_t nish_uring_shutdown(struct nish_uring_set *s, int32_t ring, int32_t slot, int32_t how) {
  struct ur_ring *r = ur_open_slot(s, ring, slot);
  if (!r) return -EBADF;
  if ((uint32_t)how > 2) return -EINVAL;
  struct ur_send *q = malloc(sizeof *q);
  if (!q) return -ENOMEM;
  q->slot = (uint32_t)slot;
  q->gen = ST_GEN(r->st[slot]);
  q->off = q->len = 0;
  q->in_flight = 0;
  q->how = how;
  ur_enqueue(s, r, (uint32_t)slot, q);
  return 0;
}

/* Cancel the slot's recv, close the slot, and move its generation on, so
 * every completion still on its way for it is stale. The freed slot goes to
 * the accepting job. -EAGAIN, with nothing changed, when the SQ has no room
 * for both entries or while the slot's shutdown is in flight: a SHUTDOWN runs
 * on io-wq, which looks the slot's file up only when it runs, and the cancel
 * below cannot match a request that has no file yet, so a slot freed before
 * it ran could take a new connection that the shutdown then reaches
 * (NURING-39). */
int32_t nish_uring_close(struct nish_uring_set *s, int32_t ring, int32_t slot) {
  struct ur_ring *r = ur_open_slot(s, ring, slot);
  if (!r) return -EBADF;
  const struct ur_send *h = r->sq_first[slot];
  if (h && h->in_flight && h->how >= 0) return -EAGAIN;
  uint32_t head = __atomic_load_n(r->sq_head, __ATOMIC_ACQUIRE);
  if (r->sq_local_tail - head + 2 > r->sq_entries) {
    (void)ur_flush(r);
    head = __atomic_load_n(r->sq_head, __ATOMIC_ACQUIRE);
    if (r->sq_local_tail - head + 2 > r->sq_entries) return -EAGAIN;
  }
  uint32_t st = r->st[slot];
  struct ur_sqe *e = ur_sqe(r);
  e->opcode = UR_OP_ASYNC_CANCEL;
  e->fd = slot;
  e->op_flags = UR_CANCEL_FD | UR_CANCEL_FD_FIXED | UR_CANCEL_ALL;
  e->flags = UR_SQE_CQE_SKIP_SUCCESS;
  e->user_data = ur_tag(UR_CANCEL, st, (uint32_t)slot);
  e = ur_sqe(r);
  e->opcode = UR_OP_CLOSE;
  e->file_index = (uint32_t)slot + 1;
  e->flags = UR_SQE_CQE_SKIP_SUCCESS;
  e->user_data = ur_tag(UR_CLOSE, st, (uint32_t)slot);
  ur_drop_sends(s, r, (uint32_t)slot);
  r->st[slot] = ((ST_GEN(st) + 1) & GEN_MASK) << 8;
  r->live--;
  s->stats.live--;
  ur_top_up(s);
  return 0;
}

/* The bytes queued for (ring, slot) that the kernel has not yet sent, or -1
 * for a slot that is not open. runtime-net.c bounds a connection's send area
 * with it (NURING-2): a successful send makes no event, so the caller asks. */
int64_t nish_uring_queued(const struct nish_uring_set *s, int32_t ring, int32_t slot) {
  if (ring < 0 || ring >= s->nrings || slot < 0 || (uint32_t)slot >= s->slots) return -1;
  const struct ur_ring *r = s->rings[ring];
  return (r->st[slot] & ST_OPEN) ? (int64_t)r->qbytes[slot] : -1;
}

/* 1 when no accept is in flight and none can be: every ring's table is full
 * and the set has `rings_max` rings or could not make another. A connection
 * then waits in the listener's backlog, and tcpAccept answers -23
 * (NURING-6). A close frees a slot and starts accepting again. */
int32_t nish_uring_full(const struct nish_uring_set *s) {
  if (s->accept_stopped || s->accept_paused) return 0;
  for (int i = 0; i < s->nrings; i++) {
    const struct ur_ring *r = s->rings[i];
    if (r->accepting > 0 || r->live < (long)s->slots) return 0;
  }
  return 1;
}

/* Hold (`on` 1) or let go (`on` 0) a slot's receive. A hold cancels the
 * slot's multishot recv by its tag, not by its descriptor, so the slot's sends
 * in flight go on, and keeps it from being armed again; the bytes the kernel
 * received before the cancel takes effect are still reported. runtime-net.c
 * holds a slot whose receive queue reaches its bound, so a peer the program
 * does not read cannot grow it (NURING-9). Letting go arms the recv again.
 * -EBADF for a slot that is not open; -EAGAIN, nothing changed, when the SQ
 * has no room for the cancel. */
int32_t nish_uring_hold(struct nish_uring_set *s, int32_t ring, int32_t slot, int32_t on) {
  struct ur_ring *r = ur_open_slot(s, ring, slot);
  if (!r) return -EBADF;
  uint32_t st = r->st[slot];
  if (!on) {
    r->st[slot] = st & ~ST_HELD;
    if ((st & (ST_ARMED | ST_PARKED)) == 0) ur_arm(r, (uint32_t)slot);
    return 0;
  }
  if (st & ST_HELD) return 0;
  if (st & ST_ARMED) {
    struct ur_sqe *e = ur_sqe(r);
    if (!e) return -EAGAIN;
    e->opcode = UR_OP_ASYNC_CANCEL;
    e->addr = ur_tag(UR_RECV, st, (uint32_t)slot);
    e->flags = UR_SQE_CQE_SKIP_SUCCESS;
    e->user_data = ur_tag(UR_CANCEL, st, (uint32_t)slot);
  }
  r->st[slot] = st | ST_HELD;
  return 0;
}

void nish_uring_stats(const struct nish_uring_set *s, struct nish_uring_stats *st) { *st = s->stats; }

/* Close every ring, which ends whatever the kernel still held, and free the
 * sends it held them for. The caller's listener stays open: it is theirs. */
void nish_uring_destroy(struct nish_uring_set *s) {
  if (!s) return;
  for (int i = 0; i < s->nrings; i++) ur_free_ring(s->rings[i]);
  while (s->all) {
    struct ur_send *q = s->all;
    s->all = q->next_all;
    free(q);
  }
  close(s->ep);
  free(s->rings);
  free(s);
}

#else /* not Linux: no io_uring, so a set is never available */

int32_t nish_uring_probe(void) { return -38; }
int32_t nish_uring_premake(int32_t n, int32_t slots, int32_t *fds) {
  (void)n;
  (void)slots;
  (void)fds;
  return -38;
}
int32_t nish_uring_pooled(void) { return 0; }
int32_t nish_uring_open(struct nish_uring_set **out, int32_t listener, const struct nish_uring_opts *opts) {
  (void)listener;
  (void)opts;
  *out = NULL;
  return -38;
}
int32_t nish_uring_fd(const struct nish_uring_set *s) {
  (void)s;
  return -38;
}
int32_t nish_uring_sleep_ms(const struct nish_uring_set *s, int32_t timeout_ms) {
  (void)s;
  return timeout_ms;
}
int32_t nish_uring_wait(struct nish_uring_set *s, int32_t timeout_ms, struct nish_uring_event *ev, int32_t cap) {
  (void)s;
  (void)timeout_ms;
  (void)ev;
  (void)cap;
  return -38;
}
int32_t nish_uring_wait_direct(struct nish_uring_set *s, int32_t watch_fd, int32_t min_complete, int32_t timeout_ms) {
  (void)s;
  (void)watch_fd;
  (void)min_complete;
  (void)timeout_ms;
  return -38;
}
int32_t nish_uring_poll_events(struct nish_uring_set *s, int32_t take) {
  (void)s;
  (void)take;
  return 0;
}
int32_t nish_uring_send(struct nish_uring_set *s, int32_t ring, int32_t slot, const uint8_t *p, int32_t n) {
  (void)s;
  (void)ring;
  (void)slot;
  (void)p;
  (void)n;
  return -38;
}
int32_t nish_uring_close(struct nish_uring_set *s, int32_t ring, int32_t slot) {
  (void)s;
  (void)ring;
  (void)slot;
  return -38;
}
int32_t nish_uring_shutdown(struct nish_uring_set *s, int32_t ring, int32_t slot, int32_t how) {
  (void)s;
  (void)ring;
  (void)slot;
  (void)how;
  return -38;
}
int64_t nish_uring_queued(const struct nish_uring_set *s, int32_t ring, int32_t slot) {
  (void)s;
  (void)ring;
  (void)slot;
  return -1;
}
int32_t nish_uring_full(const struct nish_uring_set *s) {
  (void)s;
  return 0;
}
int32_t nish_uring_hold(struct nish_uring_set *s, int32_t ring, int32_t slot, int32_t on) {
  (void)s;
  (void)ring;
  (void)slot;
  (void)on;
  return -38;
}
void nish_uring_stats(const struct nish_uring_set *s, struct nish_uring_stats *st) {
  (void)s;
  memset(st, 0, sizeof *st);
}
void nish_uring_destroy(struct nish_uring_set *s) { (void)s; }
#endif
#endif
