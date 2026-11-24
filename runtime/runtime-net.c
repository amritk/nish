/* Nish runtime, the network half: addresses, non-blocking TCP and UDP, and
 * the readiness loop that waits on them (WP34 N5), the `nish:net` builtin
 * module. Every socket it makes is non-blocking
 * and close-on-exec, so a program owns the loop that waits on it, and a child
 * `spawnSync` starts inherits none of them.
 *
 * A translation unit of its own for the reason runtime-host.c is one: each
 * file carries its own measured `.text*` ceiling in tests/runtime-budgets.js,
 * and sockets are a surface that grows, which would push another unit past its
 * ceiling rather than into a new one. Section GC
 * means a program that calls none of these pays for none of them, and
 * scripts/build.sh pairs this file with runtime.c like the other halves, so a
 * link line still names one runtime.
 *
 * Errors take the shape `signalFd` set, an `i32` that is `>= 0` for success
 * (a descriptor, a byte count, 0) and negative for a failure, and add the
 * errno to it: where `signalFd` and `readSignal` answer a plain -1, a call
 * here answers the failure's errno, negated. The codes a loop branches on are Linux's numbers on every platform (-11
 * would block, -95 unsupported, -32 the peer is gone, -104 reset, -98 the
 * address is in use, -111 refused, -110 timed out, -22 a bad argument, -88
 * not a socket, -107 not connected), so
 * `nish_net_err` translates Darwin's; any other failure is the host's own
 * `-errno`. Nothing here allocates: the addresses a call reads or writes are
 * the caller's `u8[]`.
 *
 * An address is 18 bytes of that array: the 16 bytes of an IPv6 address, an
 * IPv4 one as `::ffff:a.b.c.d`, then the port, big-endian. An IPv4 address is
 * an `AF_INET` socket; any other is `AF_INET6` with `IPV6_V6ONLY` off, so
 * `::` hears both families, and when the kernel has no IPv6 at all
 * (`EAFNOSUPPORT`, as in many containers) `::` falls back to IPv4's
 * `0.0.0.0`.
 *
 * Linux and Darwin differ in nine places: `SOCK_NONBLOCK | SOCK_CLOEXEC` and
 * `accept4` against a `socket` or `accept` followed by `fcntl`, `MSG_NOSIGNAL`
 * against the `SO_NOSIGPIPE` socket option (a write to a gone peer is -32 on
 * both, never SIGPIPE), the errno numbers, UDP's segmentation offload
 * (`UDP_SEGMENT`, `UDP_GRO`) and ECN marks, which Linux has and for which
 * Darwin answers -95, and the readiness loop, which is epoll on Linux and
 * kqueue on Darwin, `TCP_QUICKACK`, which only Linux has (-95 on
 * Darwin), and the MSS, which `netMss` reads from Linux's `TCP_INFO` and from
 * `TCP_MAXSEG` on Darwin, a descriptor `recvFd` keeps, which Linux's
 * `MSG_CMSG_CLOEXEC` makes close-on-exec as it arrives and Darwin marks with
 * `fcntl` after `recvmsg` returns (the window RT-38 records), and
 * `peerCredentials`, which reads Linux's `SO_PEERCRED` and Darwin's
 * `getpeereid` with `LOCAL_PEERPID` (pid -1 where that refuses). Of the UDP calls, only the sending side and
 * the GRO bind say -95 on Darwin: a
 * receive leaves `meta` at 0, 0, and a `meta[1]` of 0 is also what a real
 * Not-ECT datagram reads as, so a program learns that Darwin has no ECN from
 * the send, never from the receive. The Darwin branch is compiled by CI's Darwin bootstrap
 * rows and run by its `runtime-net (macos-latest)` job: tests/runtime-test.c and
 * the `net_` sections of tests/run.js, on a mac. A WASI build has none of this (the checker refuses
 * every `nish:net` call on wasm but `netMss`, folded to -1), so the file is empty.
 */
#if defined(__wasi__) || defined(__wasm__)
/* ISO C wants at least one declaration in a translation unit. */
typedef int nish_net_unused;
#else
#if defined(__linux__)
/* glibc declares `accept4` only with this feature macro. */
#define _GNU_SOURCE
#endif
#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <unistd.h>
#if defined(__linux__)
#include <linux/filter.h>
#include <netinet/udp.h>
#include <sys/epoll.h>
#include <time.h>
/* glibc before 2.29 names neither; the numbers are the kernel's ABI. */
#ifndef UDP_SEGMENT
#define UDP_SEGMENT 103
#endif
#ifndef UDP_GRO
#define UDP_GRO 104
#endif
/* Linux 4.5's; a header older than the kernel may not name it. */
#ifndef SO_ATTACH_REUSEPORT_CBPF
#define SO_ATTACH_REUSEPORT_CBPF 51
#endif
#else
#include <limits.h>
#include <sys/event.h>
#include <sys/time.h>
#endif

#include "nish.h"

/* The bytes an address takes in a caller's `u8[]`. */
#define NISH_ADDR_BYTES 18

/* One buffer big enough for either family, read as whichever it is. */
typedef union nish_sockaddr {
  struct sockaddr sa;
  struct sockaddr_in v4;
  struct sockaddr_in6 v6;
} nish_sockaddr;

/* The first twelve bytes of an IPv4-mapped IPv6 address. */
static const unsigned char nish_mapped_prefix[12] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff};

/* `errno` as the language answers it: negative, and in Linux's numbering for
   the codes a loop branches on. */
static int32_t nish_net_err(int e) {
#if !defined(__linux__)
  if (e == EAGAIN) return -11;
  if (e == EOPNOTSUPP || e == ENOTSUP) return -95;
  if (e == ECONNRESET) return -104;
  if (e == EADDRINUSE) return -98;
  if (e == ECONNREFUSED) return -111;
  if (e == ETIMEDOUT) return -110;
  if (e == ENOTSOCK) return -88;
  if (e == ENAMETOOLONG) return -36;
  if (e == ELOOP) return -40;
  if (e == ENOTCONN) return -107;
#endif
  return -e;
}

/* The same for a call that has just failed. */
static int32_t nish_net_fail(void) { return nish_net_err(errno); }

/* A numeric host into the 16 address bytes: an IPv4 dotted quad as its mapped
   form, or an IPv6 literal. No name resolution. 1 when it parsed. A string
   with a NUL inside is not a literal, however the part before it reads. */
static int nish_net_parse(const nish_str *s, unsigned char a[16]) {
  const char *host = s->data;
  if (strlen(host) != s->len) return 0;
  if (inet_pton(AF_INET, host, a + 12) == 1) {
    memcpy(a, nish_mapped_prefix, 12);
    return 1;
  }
  return inet_pton(AF_INET6, host, a) == 1;
}

/* `a` and `port` as a socket address of the family `v4` names. `noinline`:
   three calls share one body, which inlined into each was 42 bytes more of
   `.text` than the calls cost. */
__attribute__((noinline)) static socklen_t nish_net_sockaddr(nish_sockaddr *s, const unsigned char a[16],
                                                             int32_t port, int v4) {
  memset(s, 0, sizeof *s);
  if (v4) {
    s->v4.sin_family = AF_INET;
    s->v4.sin_port = htons((uint16_t)port);
    memcpy(&s->v4.sin_addr, a + 12, 4);
    return sizeof s->v4;
  }
  s->v6.sin6_family = AF_INET6;
  s->v6.sin6_port = htons((uint16_t)port);
  memcpy(&s->v6.sin6_addr, a, 16);
  return sizeof s->v6;
}

/* A socket that is non-blocking and close-on-exec from the moment it exists
   on Linux, and from the `fcntl` after it on Darwin, where a child another
   thread spawns in between can inherit it. Darwin's `SO_NOSIGPIPE` is set
   here too, because it is a property of the socket rather than of the call. */
#if !defined(__linux__)
static int nish_net_setup(int fd) {
  int one = 1;
  if (fd >= 0) {
    fcntl(fd, F_SETFD, FD_CLOEXEC);
    fcntl(fd, F_SETFL, O_NONBLOCK);
    setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &one, sizeof one);
  }
  return fd;
}
#define NISH_NOSIGNAL 0
#else
#define NISH_NOSIGNAL MSG_NOSIGNAL
#endif

/* Raises the soft `RLIMIT_NOFILE` to the hard limit, once per process, as Go
   and Node do at start-up: a server is otherwise held to the soft limit it
   inherits, often 1024 (256 on macOS), though the hard limit is usually far
   higher. Every call here that makes a descriptor out of nothing calls it
   first, so a program that never touches `nish:net` keeps the limit it was
   given. Darwin's `setrlimit` refuses a soft limit above `OPEN_MAX`, and an
   unlimited hard limit is the usual case there, so the raise stops at
   `OPEN_MAX`. A failure is ignored: the program keeps the limit it had, and
   the call that wanted a descriptor answers -24 when it meets it. The flag is
   claimed atomically because `scope()` tasks can make their first sockets at
   the same moment; a task that loses the claim goes on before the raise lands,
   and holds no more descriptors than it could before. Children `spawn` starts
   inherit the raised soft limit (docs/security/runtime.md, RT-54). */
static void nish_net_raise_nofile(void) {
  static int raised;
  if (__atomic_exchange_n(&raised, 1, __ATOMIC_RELAXED)) return;
  struct rlimit r;
  if (getrlimit(RLIMIT_NOFILE, &r) != 0) return;
  rlim_t want = r.rlim_max;
#if !defined(__linux__)
  if (want > (rlim_t)OPEN_MAX) want = (rlim_t)OPEN_MAX;
#else
  /* Every descriptor stays below 2^20, where slot handles begin. */
  if (want > (rlim_t)(1 << 20)) want = (rlim_t)(1 << 20);
#endif
  if (r.rlim_cur >= want) return;
  r.rlim_cur = want;
  setrlimit(RLIMIT_NOFILE, &r);
}

static int nish_net_socket(int family, int type) {
  nish_net_raise_nofile();
#if defined(__linux__)
  return socket(family, type | SOCK_NONBLOCK | SOCK_CLOEXEC, 0);
#else
  return nish_net_setup(socket(family, type, 0));
#endif
}

/* `netAddress(out, host, port)`: the 18-byte form of a numeric host and a
   port, or -22 for a host that is not a literal, a port outside 0..65535 or
   an `out` shorter than 18 bytes. */
int32_t nish_net_address(nish_array *out, const nish_str *host, int32_t port) {
  unsigned char a[16];
  if (out->len < NISH_ADDR_BYTES || (uint32_t)port > 65535 || !nish_net_parse(host, a)) return -22;
  memcpy(out->data, a, 16);
  out->data[16] = (char)(port >> 8);
  out->data[17] = (char)port;
  return 0;
}

/* Slot handles (WP63 S2, docs/wp63-iouring-net.md §5). A listener opened
   with `tcpListenFlags` flag 8 on Linux accepts into an io_uring set
   (runtime-uring.c) rather than into descriptors, so a connection costs a
   slot in a ring's file table instead of an entry in the process's: a set of
   N rings holds N times RLIMIT_NOFILE connections in N + 1 descriptors.

   A handle is still an `i32`. Below 2^20 it is a descriptor, which is why
   `nish_net_raise_nofile` stops the soft limit at 2^20 on Linux. At or above
   it, `2^20 + ring * 2^20 + field` names a slot: `ring` is a global ring id,
   64 per listener (`NR_RINGS`), and `field` is `slot + slots * (gen % G)`,
   with `G = 2^20 / slots` the generations a slot's handles cycle through. A
   close moves the slot's generation on, so the handle a program closed
   answers -9 at once and does not reach the next connection in that slot
   until the slot has been reused G times (1,024 at a limit of 1,024; never
   fewer than 64). At most `NR_SETS` ring listeners exist in a process, which
   keeps every handle below 2^31; their ids are not reused, so a closed
   listener's handles answer -9 for good.

   `netShutdown` queues an io_uring SHUTDOWN behind the slot's sends, so the
   peer reads every byte written before it and then the FIN (NURING-39);
   `netMss` answers -1, its "not known", for a slot. Every other call that
   takes a handle and is not one of the slot paths here (`sendFd`,
   `connectResult`, `peerCredentials`, ...) passes it to the kernel as a
   descriptor, which no process holds at 2^20 or above, so it answers -9
   (EBADF) with nothing to check.

   Readiness keeps the descriptor contract: a read with nothing queued, a write
   to a full send area and an accept with nothing accepted answer -11, and the
   loop reports a slot level-triggered, in the order it became ready. The set
   receives on its own (a multishot recv per slot), so what arrives is copied
   into the slot's receive queue at once and the ring's buffer goes back. A
   write is copied into the set's send queue; `NR_AREA` bounds what one slot
   may hold there (NURING-2), and a full area is -11 until the kernel has sent
   enough. A full set, every ring's table full and no ring left to make, is
   -23 from `tcpAccept` (NURING-6): the connection waits in the backlog until a
   close frees a slot. */
#if defined(__linux__)
struct nish_uring_set;
struct nish_uring_event {
  int32_t kind;
  int32_t ring;
  int32_t slot;
  int32_t res;
  const uint8_t *data;
};
struct nish_uring_opts {
  int32_t slots;
  int32_t rings_max;
  int32_t sq_entries;
  int32_t cq_entries;
  int32_t buf_count;
  int32_t buf_size;
};
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
int32_t nish_uring_shutdown(struct nish_uring_set *s, int32_t ring, int32_t slot, int32_t how);
int64_t nish_uring_queued(const struct nish_uring_set *s, int32_t ring, int32_t slot);
int32_t nish_uring_full(const struct nish_uring_set *s);
int32_t nish_uring_hold(struct nish_uring_set *s, int32_t ring, int32_t slot, int32_t on);
void nish_uring_destroy(struct nish_uring_set *s);

#define NR_BASE (1 << 20)
#define NR_RINGS 64
#define NR_SETS 31
/* The most bytes one slot may have queued and not yet sent (NURING-2), and
   the receive queue at which the slot's receive is held (NURING-9). */
#define NR_AREA (256 * 1024)
/* What a held slot's queue may still take from the kernel before the cancel
   lands; past it the connection ends with -105 (ENOBUFS). */
#define NR_RECV_MAX (16 * 1024 * 1024)
/* A slot's first receive queue, doubled as it fills: small enough for
   glibc's thread cache, and freed once drained (NURING-38). */
#define NR_RECV_FIRST 1024
/* The most slots per ring: a table is the kernel's memory, sized up front. */
#define NR_SLOTS_MAX 16384
#define NR_EVENTS 256

/* A loop's record of one virtual source, a slot or a ring listener: the loop
   it is in (-1 for none), what it watches and its token, and its place on
   the list of sources that are ready, kept in the order they became so. */
struct nr_vent {
  int32_t loop, events, token;
  uint32_t seen; /* the `nr_epoch` of the batch that last reported it */
  uint8_t listed, is_listener;
  struct nr_vent *prev, *next;
};

/* One slot's connection. `gen` counts the slot's closes; `lingering` is a
   close the program made while bytes were still queued, which ends when they
   are sent, the peer goes or a send fails. `wshut` is a shutdown of the
   write side, after which a write answers -32 as send's EPIPE would. */
struct nr_conn {
  struct nr_vent v;
  uint32_t gen;
  uint8_t open, lingering, hup, wblocked, rheld, wshut;
  int32_t hup_res, werr;
  uint8_t *rbuf;
  uint32_t rlen, roff, rcap;
};

struct nr_set {
  struct nish_uring_set *u;
  struct nr_vent v; /* the listener's own entry */
  int32_t listener, port, slots, gens, dead, accept_err;
  int32_t accept_once; /* an accept that found memory short, answered by the next tcpAccept */
  struct nr_conn *conns[NR_RINGS];
  uint32_t *fifo; /* accepted (ring << 20 | slot), not yet taken */
  uint32_t fhead, flen, fcap;
  uint32_t *pend; /* wblocked or lingering slots, checked after each pump */
  uint32_t npend, pcap;
};

static struct nr_set *nr_sets[NR_SETS];
static int32_t nr_nsets;
/* `netRingState()`: 0 until a listener opens a set (1) or meets a refusal. */
static int32_t nr_state;
static struct nr_vent *nr_head, *nr_tail;

static void nr_unlist(struct nr_vent *v) {
  if (!v->listed) return;
  if (v->prev) v->prev->next = v->next; else nr_head = v->next;
  if (v->next) v->next->prev = v->prev; else nr_tail = v->prev;
  v->prev = v->next = NULL;
  v->listed = 0;
}

static void nr_append(struct nr_vent *v) {
  v->prev = nr_tail;
  v->next = NULL;
  if (nr_tail) nr_tail->next = v; else nr_head = v;
  nr_tail = v;
  v->listed = 1;
}

static struct nr_conn *nr_conn_of(struct nr_vent *v) { return (struct nr_conn *)(void *)v; }
static struct nr_set *nr_set_of(struct nr_vent *v) {
  return (struct nr_set *)(void *)((char *)v - offsetof(struct nr_set, v));
}

/* Whether the slot's connection has failed: a receive's error or a send's.
   A peer's FIN alone (`hup_res` 0) is not a failure. */
static int nr_failed(const struct nr_conn *c) {
  return c->werr || (c->hup && c->hup_res < 0);
}

/* The readiness bits a source holds now: 1 readable, 2 writable, 4 an error. */
static int32_t nr_bits(struct nr_vent *v) {
  if (v->is_listener) {
    struct nr_set *S = nr_set_of(v);
    return (S->flen > 0 || S->accept_err || S->accept_once) ? 1 : 0;
  }
  struct nr_conn *c = nr_conn_of(v);
  int32_t b = 0;
  if (c->rlen > c->roff || c->hup || c->werr) b |= 1;
  if (nr_failed(c)) b |= 4;
  else if (!c->wblocked) b |= 2;
  return b;
}

/* Puts a source that has become ready at the tail of the list. */
static void nr_touch(struct nr_vent *v) {
  if (v->loop >= 0 && !v->listed && (nr_bits(v) & (v->events | 4))) nr_append(v);
}

static void nr_unregister(struct nr_vent *v) {
  if (v->loop < 0) return;
  nr_unlist(v);
  v->loop = -1;
}

static int nr_push(uint32_t **a, uint32_t *n, uint32_t *cap, uint32_t x) {
  if (*n == *cap) {
    uint32_t c = *cap ? *cap * 2 : 64;
    uint32_t *p = realloc(*a, (size_t)c * sizeof *p);
    if (!p) return -12;
    *a = p;
    *cap = c;
  }
  (*a)[(*n)++] = x;
  return 0;
}

/* The connection a handle names, or NULL for a stale or foreign one. */
static struct nr_conn *nr_decode(int32_t h, struct nr_set **set, int32_t *ring, int32_t *slot) {
  if (h < NR_BASE) return NULL;
  uint32_t x = (uint32_t)h - NR_BASE;
  uint32_t g = x >> 20, field = x & (NR_BASE - 1);
  uint32_t si = g / NR_RINGS, ri = g % NR_RINGS;
  if (si >= (uint32_t)nr_nsets) return NULL;
  struct nr_set *S = nr_sets[si];
  if (S->dead || !S->conns[ri]) return NULL;
  uint32_t sl = field % (uint32_t)S->slots, gm = field / (uint32_t)S->slots;
  struct nr_conn *c = &S->conns[ri][sl];
  if (gm >= (uint32_t)S->gens || !c->open || c->lingering || c->gen % (uint32_t)S->gens != gm) return NULL;
  *set = S;
  *ring = (int32_t)ri;
  *slot = (int32_t)sl;
  return c;
}

static int32_t nr_encode(const struct nr_set *S, int32_t si, uint32_t ring, uint32_t slot) {
  const struct nr_conn *c = &S->conns[ring][slot];
  uint32_t field = slot + (uint32_t)S->slots * (c->gen % (uint32_t)S->gens);
  return (int32_t)((uint32_t)NR_BASE + ((uint32_t)si * NR_RINGS + ring) * (uint32_t)NR_BASE + field);
}

/* Ends a slot for good: the set closes it and the slot goes back to the
   accepting job. 1 when done, 0 when the set had no room and it is retried. */
static int nr_finish(struct nr_set *S, uint32_t ring, uint32_t slot) {
  struct nr_conn *c = &S->conns[ring][slot];
  if (nish_uring_close(S->u, (int32_t)ring, (int32_t)slot) == -11) return 0;
  c->open = 0;
  c->lingering = 0;
  return 1;
}

static void nr_dispatch(struct nr_set *S, const struct nish_uring_event *e) {
  if (e->kind == 5) {
    S->accept_err = e->res < 0 ? e->res : -5;
    nr_touch(&S->v);
    return;
  }
  if (e->kind == 6) {
    /* Memory was short for an accept; the set pauses and accepts again. A
       descriptor's accept answers the errno once, and so does tcpAccept. */
    S->accept_once = e->res < 0 ? e->res : -12;
    nr_touch(&S->v);
    return;
  }
  if (e->ring < 0 || e->ring >= NR_RINGS || e->slot < 0 || e->slot >= S->slots) return;
  if (!S->conns[e->ring]) {
    S->conns[e->ring] = calloc((size_t)S->slots, sizeof(struct nr_conn));
    /* With no table to record it in, an accepted slot is closed at once
       rather than left open in the ring for good. */
    if (!S->conns[e->ring]) {
      if (e->kind == 1) (void)nish_uring_close(S->u, e->ring, e->slot);
      return;
    }
  }
  struct nr_conn *c = &S->conns[e->ring][e->slot];
  if (e->kind == 1) {
    /* nr_close freed the queue of a slot reused here (NURING-38). */
    uint32_t gen = c->gen;
    memset(c, 0, sizeof *c);
    c->gen = gen;
    c->open = 1;
    c->v.loop = -1;
    uint32_t i = (S->fhead + S->flen) % (S->fcap ? S->fcap : 1);
    if (S->flen == S->fcap) {
      /* Grow the ring buffer, unrolled into the new array from its head. */
      uint32_t nc = S->fcap ? S->fcap * 2 : 64;
      uint32_t *p = malloc((size_t)nc * sizeof *p);
      if (!p) {
        (void)nr_finish(S, (uint32_t)e->ring, (uint32_t)e->slot);
        return;
      }
      for (uint32_t k = 0; k < S->flen; k++) p[k] = S->fifo[(S->fhead + k) % S->fcap];
      free(S->fifo);
      S->fifo = p;
      S->fcap = nc;
      S->fhead = 0;
      i = S->flen;
    }
    S->fifo[i] = (uint32_t)e->ring << 20 | (uint32_t)e->slot;
    S->flen++;
    nr_touch(&S->v);
    return;
  }
  if (!c->open) return;
  if (e->kind == 2) {
    /* Bytes after the slot has hung up, here or by the kernel, are dropped,
       so a read never runs past the failure it reports. */
    if (c->lingering || c->hup || e->res <= 0) return;
    uint32_t n = (uint32_t)e->res;
    if ((uint64_t)(c->rlen - c->roff) + n > NR_RECV_MAX) {
      c->hup = 1;
      c->hup_res = -105;
      nr_touch(&c->v);
      return;
    }
    if (c->rlen + n > c->rcap) {
      if (c->roff > 0) {
        memmove(c->rbuf, c->rbuf + c->roff, c->rlen - c->roff);
        c->rlen -= c->roff;
        c->roff = 0;
      }
      if (c->rlen + n > c->rcap) {
        uint32_t nc = c->rcap ? c->rcap : NR_RECV_FIRST;
        while (nc < c->rlen + n) nc *= 2;
        uint8_t *p = realloc(c->rbuf, nc);
        if (!p) {
          c->hup = 1;
          c->hup_res = -12;
          nr_touch(&c->v);
          return;
        }
        c->rbuf = p;
        c->rcap = nc;
      }
    }
    memcpy(c->rbuf + c->rlen, e->data, n);
    c->rlen += n;
    if (!c->rheld && c->rlen - c->roff >= NR_AREA && nish_uring_hold(S->u, e->ring, e->slot, 1) == 0) c->rheld = 1;
  } else if (e->kind == 3) {
    /* The first hangup is the one a read reports: a later one, such as the
       kernel's after a -105 here, does not overwrite it (NURING-27). */
    if (!c->hup) {
      c->hup = 1;
      c->hup_res = e->res;
    }
  } else if (e->kind == 4) {
    if (!c->werr) c->werr = e->res < 0 ? e->res : -5;
  }
  if (c->lingering && nr_failed(c)) (void)nr_finish(S, (uint32_t)e->ring, (uint32_t)e->slot);
  else nr_touch(&c->v);
}

/* Takes every event the set holds, and hands the set what it has queued.
   Then the slots waiting on their send areas: a write-blocked one whose area
   has room is ready again, and a lingering close whose bytes are gone ends. */
static void nr_pump(struct nr_set *S) {
  struct nish_uring_event ev[NR_EVENTS];
  for (int round = 0; round < 64; round++) {
    int n = nish_uring_wait(S->u, 0, ev, NR_EVENTS);
    if (n <= 0) break;
    for (int i = 0; i < n; i++) nr_dispatch(S, &ev[i]);
  }
  int full = S->npend > 0 && nish_uring_full(S->u);
  uint32_t keep = 0;
  for (uint32_t i = 0; i < S->npend; i++) {
    uint32_t x = S->pend[i], ring = x >> 20, slot = x & (NR_BASE - 1);
    struct nr_conn *c = &S->conns[ring][slot];
    int64_t q = nish_uring_queued(S->u, (int32_t)ring, (int32_t)slot);
    if (!c->open) continue;
    if (c->lingering) {
      if ((q <= 0 || nr_failed(c) || full) && nr_finish(S, ring, slot)) continue;
    } else if (c->wblocked) {
      if (q >= NR_AREA) {
        S->pend[keep++] = x;
        continue;
      }
      c->wblocked = 0;
      nr_touch(&c->v);
      continue;
    } else {
      continue;
    }
    S->pend[keep++] = x;
  }
  S->npend = keep;
}

static void nr_pump_all(void) {
  for (int32_t i = 0; i < nr_nsets; i++)
    if (!nr_sets[i]->dead) nr_pump(nr_sets[i]);
}

static struct nr_set *nr_listener(int32_t fd) {
  for (int32_t i = 0; i < nr_nsets; i++)
    if (!nr_sets[i]->dead && nr_sets[i]->listener == fd) return nr_sets[i];
  return NULL;
}

/* Whether `r`, from the probe or the first set's open, refuses io_uring for
   the process: EPERM, ENOSYS, EINVAL or EOPNOTSUPP, the answers
   nish_uring_probe keeps (NURING-20). Any other failure, such as EMFILE or
   ENOMEM, may pass, and a later listen asks again. */
static int nr_refused(int32_t r) { return r == -1 || r == -38 || r == -22 || r == -95; }

/* A ring listener for `fd`: 1 when it has one, 0 when it stays on
   descriptors, or -23 when the process has opened every set it may hold.
   Whatever else fails, the probe or this set's open, the listener falls back
   to descriptors (§5.4); a refusal before any set has opened also decides for
   every later listen, and any other failure, such as -24 or -12, only for
   this one (NURING-20, NURING-22). */
static int32_t nr_slots(void) {
  struct rlimit rl;
  if (getrlimit(RLIMIT_NOFILE, &rl) != 0) return -1;
  int32_t n = rl.rlim_cur == RLIM_INFINITY || rl.rlim_cur > NR_SLOTS_MAX ? NR_SLOTS_MAX : (int32_t)rl.rlim_cur;
  return n < 1 ? 1 : n;
}

static int32_t nr_open(int32_t fd, int32_t port) {
  if (nr_state < 0) return 0;
  /* Under `--sandbox` every set takes the rings made before the filter, so
     any failure of theirs, a refusal or not, decides for good: no ring can be
     made again (WP63 S3). */
  int32_t pooled = nish_uring_pooled();
  if (nr_state == 0) {
    int32_t p = nish_uring_probe();
    if (p < 0) {
      if (pooled != 0 || nr_refused(p)) nr_state = p;
      return 0;
    }
  }
  if (nr_nsets >= NR_SETS) return -23;
  struct nish_uring_opts o;
  memset(&o, 0, sizeof o);
  o.slots = pooled > 0 ? pooled : nr_slots();
  if (o.slots < 0) return 0;
  o.rings_max = NR_RINGS;
  struct nr_set *S = calloc(1, sizeof *S);
  if (!S) return 0;
  int32_t r = nish_uring_open(&S->u, fd, &o);
  if (r < 0) {
    free(S);
    if (nr_state == 0 && (pooled != 0 || nr_refused(r))) nr_state = r;
    return 0;
  }
  /* Only an open set decides for rings: a probe that passed before a set
     that ran short leaves the state at 0 (NURING-26). */
  nr_state = 1;
  S->listener = fd;
  S->port = port;
  S->slots = o.slots;
  S->gens = NR_BASE / o.slots;
  S->v.loop = -1;
  S->v.is_listener = 1;
  nr_sets[nr_nsets++] = S;
  return 1;
}

/* Closes a ring listener: the set and every slot in it, then the descriptor.
   The record stays, dead, so its handles answer -9. */
static int32_t nr_close_listener(struct nr_set *S) {
  nr_unregister(&S->v);
  for (int ri = 0; ri < NR_RINGS; ri++) {
    if (!S->conns[ri]) continue;
    for (int32_t sl = 0; sl < S->slots; sl++) {
      nr_unregister(&S->conns[ri][sl].v);
      free(S->conns[ri][sl].rbuf);
    }
    free(S->conns[ri]);
    S->conns[ri] = NULL;
  }
  nish_uring_destroy(S->u);
  S->u = NULL;
  free(S->fifo);
  free(S->pend);
  S->fifo = S->pend = NULL;
  S->dead = 1;
  return close(S->listener) != 0 ? nish_net_fail() : 0;
}

static int32_t nr_accept(struct nr_set *S, nish_array *peer) {
  int32_t si = 0;
  while (nr_sets[si] != S) si++;
  nr_pump(S);
  while (S->flen > 0) {
    uint32_t x = S->fifo[S->fhead];
    S->fhead = (S->fhead + 1) % S->fcap;
    S->flen--;
    uint32_t ring = x >> 20, slot = x & (NR_BASE - 1);
    if (!S->conns[ring][slot].open) continue;
    /* A slot has no descriptor to ask its peer of, so the address is the
       18 zeros `recvmsg` gives for one it does not know. */
    memset(peer->data, 0, NISH_ADDR_BYTES);
    return nr_encode(S, si, ring, slot);
  }
  if (S->accept_err) return S->accept_err;
  if (S->accept_once) {
    int32_t r = S->accept_once;
    S->accept_once = 0;
    return r;
  }
  return nish_uring_full(S->u) ? -23 : -11;
}

static int32_t nr_read(struct nr_set *S, struct nr_conn *c, int32_t ring, int32_t slot, nish_array *buf, int64_t off,
                       int64_t len) {
  if (c->rlen == c->roff && !c->hup) nr_pump(S);
  uint32_t have = c->rlen - c->roff;
  if (have > 0) {
    uint32_t n = len < (int64_t)have ? (uint32_t)len : have;
    memcpy(buf->data + off, c->rbuf + c->roff, n);
    c->roff += n;
    /* A held receive goes again once the program has read half the queue. */
    if (c->rheld && c->rlen - c->roff < NR_AREA / 2 && nish_uring_hold(S->u, ring, slot, 0) == 0) c->rheld = 0;
    /* A drained queue is freed and emptied, so an idle slot holds none
       (NURING-38) and a receive never finds roff at rlen past 0. */
    if (c->roff == c->rlen) {
      free(c->rbuf);
      c->rbuf = NULL;
      c->rcap = c->roff = c->rlen = 0;
    }
    return (int32_t)n;
  }
  if (c->hup) return c->hup_res < 0 ? c->hup_res : 0;
  /* A failed send ends the read side too, as recv's error would. */
  if (c->werr) return c->werr;
  return len == 0 ? 0 : -11;
}

/* The errno a failed slot answers a write with: its send's, else its
   receive's, such as -104 for a peer's reset. */
static int32_t nr_fail_code(const struct nr_conn *c) {
  return c->werr ? c->werr : c->hup_res;
}

/* Copies at most what the slot's send area has room for into the set's send
   queue. -11 when it has none, or the connection's errno once it has failed. */
static int32_t nr_send(struct nr_set *S, struct nr_conn *c, int32_t ring, int32_t slot, const char *p, int64_t len) {
  if (nr_failed(c)) return nr_fail_code(c);
  if (c->wshut) return -32;
  int64_t q = nish_uring_queued(S->u, ring, slot);
  if (q < 0) return -9;
  if (q >= NR_AREA) {
    nr_pump(S);
    if (nr_failed(c)) return nr_fail_code(c);
    q = nish_uring_queued(S->u, ring, slot);
  }
  int64_t room = NR_AREA - q;
  int32_t n = room <= 0 ? 0 : (int32_t)(len < room ? len : room);
  int32_t r = n > 0 ? nish_uring_send(S->u, ring, slot, (const uint8_t *)p, n) : 0;
  if (r < 0) return r;
  if (q + n >= NR_AREA && !c->wblocked) {
    c->wblocked = 1;
    if (nr_push(&S->pend, &S->npend, &S->pcap, (uint32_t)ring << 20 | (uint32_t)slot) != 0) c->wblocked = 0;
  }
  return len > 0 && n == 0 ? -11 : n;
}

/* Half-closes a slot (NURING-39). The SHUTDOWN goes behind the queued sends,
   so the peer reads them and then the FIN. A shut read side reads as the
   peer's end: what is queued, then 0, with later bytes dropped. */
static int32_t nr_shutdown(struct nr_set *S, struct nr_conn *c, int32_t ring, int32_t slot, int32_t how) {
  if (nr_failed(c)) return -107;
  int32_t r = nish_uring_shutdown(S->u, ring, slot, how);
  if (r < 0) return r;
  if (how != 0) c->wshut = 1;
  if (how != 1 && !c->hup) {
    c->hup = 1;
    c->hup_res = 0;
    nr_touch(&c->v);
  }
  return 0;
}

static int32_t nr_close(struct nr_set *S, struct nr_conn *c, int32_t ring, int32_t slot) {
  nr_unregister(&c->v);
  c->gen++;
  c->roff = c->rlen = 0;
  free(c->rbuf);
  c->rbuf = NULL;
  c->rcap = 0;
  int64_t q = nish_uring_queued(S->u, ring, slot);
  /* A peer that only stopped sending (a FIN) still takes what is queued, so
     only a failure ends the slot before its bytes are sent. */
  if ((q <= 0 || nr_failed(c)) && nr_finish(S, (uint32_t)ring, (uint32_t)slot)) {
    nr_pump(S);
    return 0;
  }
  c->lingering = 1;
  if (!c->wblocked && nr_push(&S->pend, &S->npend, &S->pcap, (uint32_t)ring << 20 | (uint32_t)slot) != 0) {
    while (!nr_finish(S, (uint32_t)ring, (uint32_t)slot)) nr_pump(S);
    return 0;
  }
  nr_pump(S);
  return 0;
}

/* The loops a virtual source has joined, so a close of any other descriptor
   skips the scan below; past NR_LOOPS of them every close scans. */
#define NR_LOOPS 64
static int32_t nr_loops[NR_LOOPS];
static int32_t nr_nloops, nr_loops_spilled;

static void nr_note_loop(int32_t loop) {
  for (int32_t i = 0; i < nr_nloops; i++)
    if (nr_loops[i] == loop) return;
  if (nr_nloops < NR_LOOPS) nr_loops[nr_nloops++] = loop;
  else nr_loops_spilled = 1;
}

/* A closed descriptor may have been a loop: every virtual source in it leaves
   it, as epoll drops its registrations, so a later loop that gets the same
   number reports none of them. */
static void nr_forget_loop(int32_t fd) {
  int32_t at = -1;
  for (int32_t i = 0; i < nr_nloops; i++)
    if (nr_loops[i] == fd) at = i;
  if (at < 0 && !nr_loops_spilled) return;
  if (at >= 0) nr_loops[at] = nr_loops[--nr_nloops];
  for (int32_t si = 0; si < nr_nsets; si++) {
    struct nr_set *S = nr_sets[si];
    if (S->v.loop == fd) nr_unregister(&S->v);
    for (int32_t ring = 0; ring < NR_RINGS; ring++) {
      if (!S->conns[ring]) continue;
      for (int32_t slot = 0; slot < S->slots; slot++)
        if (S->conns[ring][slot].v.loop == fd) nr_unregister(&S->conns[ring][slot].v);
    }
  }
}

/* The virtual source `fd` names in a loop, or NULL for a descriptor. A stale
   slot handle sets `*stale`. */
static struct nr_vent *nr_vent_for(int32_t fd, int *stale, struct nr_set **set) {
  *stale = 0;
  if (fd >= NR_BASE) {
    int32_t ring, slot;
    struct nr_conn *c = nr_decode(fd, set, &ring, &slot);
    if (!c) *stale = 1;
    return c ? &c->v : NULL;
  }
  struct nr_set *S = nr_listener(fd);
  *set = S;
  return S ? &S->v : NULL;
}

static int32_t nr_ctl(int32_t loop, int op, struct nr_vent *v, struct nr_set *S, int32_t events, int32_t token) {
  if (op == EPOLL_CTL_ADD) {
    if (v->loop >= 0) return -17;
    /* The set's own epoll descriptor joins the loop, marked so a wake on it
       is taken as the set's, never reported as a token. */
    struct epoll_event e;
    memset(&e, 0, sizeof e);
    e.events = EPOLLIN;
    int32_t si = 0;
    while (nr_sets[si] != S) si++;
    e.data.u64 = (uint64_t)1 << 32 | (uint32_t)si;
    if (epoll_ctl(loop, EPOLL_CTL_ADD, nish_uring_fd(S->u), &e) != 0 && errno != EEXIST) return nish_net_fail();
    v->loop = loop;
    nr_note_loop(loop);
  } else if (v->loop != loop) {
    return -2;
  }
  if (op == EPOLL_CTL_DEL) {
    nr_unregister(v);
    return 0;
  }
  v->events = events;
  v->token = token;
  nr_unlist(v);
  nr_touch(v);
  return 0;
}

/* Writes the loop's ready virtual sources into `out`, at most `max`, in the
   order they became ready. One reported and still ready goes to the tail,
   so a busy source does not starve the rest. */
static uint32_t nr_epoch;

static int nr_collect_from(int32_t loop, int32_t *out, int max, int skip_seen) {
  int n = 0;
  struct nr_vent *again = NULL, *again_tail = NULL;
  for (struct nr_vent *v = nr_head, *next; v && n < max; v = next) {
    next = v->next;
    if (v->loop != loop) continue;
    /* A batch's second wait passes over what its first already reported,
       which stays listed for the next call. */
    if (skip_seen && v->seen == nr_epoch) continue;
    int32_t bits = nr_bits(v) & (v->events | 4);
    nr_unlist(v);
    if (bits == 0) continue;
    out[2 * n] = v->token;
    out[2 * n + 1] = bits;
    v->seen = nr_epoch;
    n++;
    v->next = NULL;
    if (again_tail) again_tail->next = v; else again = v;
    again_tail = v;
  }
  for (struct nr_vent *v = again, *next; v; v = next) {
    next = v->next;
    nr_append(v);
  }
  return n;
}

static int nr_collect(int32_t loop, int32_t *out, int max) { return nr_collect_from(loop, out, max, 0); }

static int64_t nr_now_ms(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return (int64_t)t.tv_sec * 1000 + t.tv_nsec / 1000000;
}

/* Whose turn a full wait with room for one gives: 1 the epoll set's. */
static int nr_turn;

/* The ordinary descriptors each loop watches, as `pollAdd` and `pollModify`
   left them, so a wait can tell a loop that holds nothing but ring slots and
   `signalFd()` from one that must sleep in epoll_wait. A close without
   `pollRemove` may leave an entry behind, which only keeps that loop on
   epoll; past NR_FDS entries no loop waits on its ring directly. */
#define NR_FDS 64
static struct {
  int32_t loop, fd, events;
} nr_fds[NR_FDS];
static int32_t nr_nfds, nr_fds_spilled;

static void nr_fd_note(int32_t loop, int op, int32_t fd, int32_t events) {
  int32_t at = -1;
  for (int32_t i = 0; i < nr_nfds; i++)
    if (nr_fds[i].loop == loop && nr_fds[i].fd == fd) at = i;
  if (op == EPOLL_CTL_DEL) {
    if (at >= 0) nr_fds[at] = nr_fds[--nr_nfds];
    return;
  }
  if (at < 0) {
    if (nr_nfds == NR_FDS) {
      nr_fds_spilled = 1;
      return;
    }
    at = nr_nfds++;
    nr_fds[at].loop = loop;
    nr_fds[at].fd = fd;
  }
  nr_fds[at].events = events;
}

/* `fd` is closed or new: it watches nothing and is in no loop. */
static void nr_fd_forget(int32_t fd) {
  for (int32_t i = 0; i < nr_nfds;)
    if (nr_fds[i].loop == fd || nr_fds[i].fd == fd) nr_fds[i] = nr_fds[--nr_nfds];
    else i++;
}

/* The set a wait on `loop` may sleep on directly, in io_uring_enter rather
   than epoll_wait, and in `*watch` the one descriptor its ring must watch
   for it, or -1: there is one live set, no other loop holds a virtual
   source, and the loop's only ordinary descriptor, if any, is `signalFd()`
   watched for reading. NULL otherwise, and the wait uses epoll. */
static struct nr_set *nr_direct(int32_t loop, int32_t *watch) {
  if (nr_fds_spilled || nr_loops_spilled || nr_nloops != 1 || nr_loops[0] != loop) return NULL;
  struct nr_set *D = NULL;
  for (int32_t i = 0; i < nr_nsets; i++) {
    if (nr_sets[i]->dead) continue;
    if (D) return NULL;
    D = nr_sets[i];
  }
  *watch = -1;
  for (int32_t i = 0; i < nr_nfds; i++) {
    if (nr_fds[i].loop != loop) continue;
    if (*watch >= 0 || nr_fds[i].fd != nish_signal_fd_made() || nr_fds[i].events != 1) return NULL;
    *watch = nr_fds[i].fd;
  }
  return D;
}

/* `pollWait` for a loop that may hold virtual sources: pump every set, take
   what is ready, and sleep on the loop's epoll set, which holds each set's
   descriptor, no longer than the sets allow (NURING-8). A wake by the bound,
   or an EINTR, with nothing to report sleeps again until the caller's timeout
   is spent. */
static int32_t nr_poll_wait(int32_t loop, int32_t *out, int max, int32_t timeout_ms) {
  int64_t deadline = timeout_ms > 0 ? nr_now_ms() + timeout_ms : 0;
  for (;;) {
    nr_pump_all();
    int n = nr_collect(loop, out, max);
    int32_t t = 0;
    if (n == 0) {
      t = timeout_ms < 0 ? -1 : timeout_ms == 0 ? 0 : (int32_t)(deadline - nr_now_ms());
      if (t < -1 || (timeout_ms > 0 && t < 0)) t = 0;
      for (int32_t i = 0; i < nr_nsets; i++)
        if (!nr_sets[i]->dead) t = nish_uring_sleep_ms(nr_sets[i]->u, t);
    }
    /* Ready slots that fill the batch still leave the epoll set a share of
       it, half, or every other wait with room for one, so a descriptor such
       as `signalFd()` is not starved by them (NURING-18). */
    int room = max - n;
    if (room == 0) room = max > 1 ? max / 2 : (nr_turn ^= 1);
    struct epoll_event e[NR_EVENTS];
    int woke = 0, k = -2, watch;
    /* A loop of ring slots and at most `signalFd()` sleeps on its ring, and
       reads its epoll set only once the ring's poll says the signal
       descriptor is ready; that read takes the place of NURING-18's share. */
    struct nr_set *D = room > 0 ? nr_direct(loop, &watch) : NULL;
    if (D) {
      int rc = nish_uring_wait_direct(D->u, watch, 1, t);
      if (rc != -EOPNOTSUPP) {
        if (rc < 0) {
          errno = -rc;
          return nish_net_fail();
        }
        nr_pump(D);
        woke = 1;
        k = watch >= 0 && nish_uring_poll_events(D->u, 1) ? epoll_wait(loop, e, room, 0) : 0;
      }
    }
    if (k == -2) k = room > 0 ? epoll_wait(loop, e, room, t) : 0;
    /* io_uring's task work interrupts the wait with no signal behind it, so
       EINTR is a wake to pump for, not an answer of 0 before the timeout. */
    if (k < 0 && errno != EINTR) return nish_net_fail();
    if (k < 0) {
      k = 0;
      woke = 1;
    }
    int got_fds = 0;
    for (int i = 0; i < k; i++) got_fds += !(e[i].data.u64 >> 32);
    /* The slots this drops stay listed and ready, and a later wait reports them. */
    if (n + got_fds > max) n = max - got_fds;
    for (int i = 0; i < k; i++) {
      if (e[i].data.u64 >> 32) {
        woke = 1;
        continue;
      }
      uint32_t got = e[i].events;
      out[2 * n] = (int32_t)e[i].data.u32;
      out[2 * n + 1] = ((got & EPOLLIN) ? 1 : 0) | ((got & EPOLLOUT) ? 2 : 0) | ((got & (EPOLLHUP | EPOLLERR)) ? 4 : 0);
      n++;
    }
    if (n > 0) return n;
    if (woke) {
      nr_pump_all();
      n = nr_collect(loop, out, max);
      if (n > 0) return n;
    }
    if (timeout_ms == 0 || (timeout_ms > 0 && nr_now_ms() >= deadline)) return 0;
  }
}
#endif

#if defined(__linux__)
/* A batch's second wait: `n` pairs are in `out`, and it waits on the one live
   set's ring, up to `max_wait_ms`, until `min` are ready or `max` fill it. It
   reads no epoll set, so an ordinary descriptor that becomes ready meanwhile
   waits for the next call, at most `max_wait_ms`; on a direct loop the
   ring's poll on `signalFd()` ends the batch as soon as it answers, and the
   next call reports it. */
static int nr_batch(int32_t loop, int32_t *out, int n, int max, int32_t min, int32_t max_wait_ms) {
  struct nr_set *S = NULL;
  for (int32_t i = 0; i < nr_nsets; i++) {
    if (nr_sets[i]->dead) continue;
    if (S) return n; /* a batch waits on one ring set, never on several */
    S = nr_sets[i];
  }
  if (!S) return n;
  int32_t watch = -1;
  int direct = nr_direct(loop, &watch) == S;
  int64_t end = nr_now_ms() + max_wait_ms;
  while (n < min && n < max) {
    int64_t left = end - nr_now_ms();
    if (left <= 0) break;
    int rc = direct ? nish_uring_wait_direct(S->u, watch, min - n, (int32_t)left) : -EOPNOTSUPP;
    if (rc == -EOPNOTSUPP) {
      struct nish_uring_event ev[NR_EVENTS];
      int k = nish_uring_wait(S->u, (int32_t)left, ev, NR_EVENTS);
      if (k < 0) break;
      for (int i = 0; i < k; i++) nr_dispatch(S, &ev[i]);
    } else if (rc < 0) {
      break;
    }
    nr_pump(S);
    n += nr_collect_from(loop, out + 2 * n, max - n, 1);
    if (direct && watch >= 0 && nish_uring_poll_events(S->u, 0)) break;
  }
  return n;
}
#endif


/* `netRingState()`: whether `tcpListenFlags` flag 8 gets rings. 0 before a
   listener has asked, 1 when it got them, or the negative errno that refused
   them, after which every listener in the process is a descriptor one: -1
   (EPERM) for a filter or `io_uring_disabled`, -38 for a kernel without
   io_uring, -22 or -95 for one too old for the features the set needs. Darwin
   has no io_uring, and answers -95. */
/* WP63 S3: `--sandbox`, before its filter, makes the `n` restricted rings
   every ring listener of this process takes, at the slots `nr_open` would
   give a set, and writes each ring's descriptor to `fds` (64 of them). With
   `n` of 0 it records that no ring may be made. */
int32_t nish_net_ring_premake(int32_t n, int32_t *fds) {
#if defined(__linux__)
  int32_t slots = nr_slots();
  return nish_uring_premake(n, slots < 0 ? 1 : slots, fds);
#else
  (void)n;
  (void)fds;
  return -95;
#endif
}

int32_t nish_net_ring_state(void) {
#if defined(__linux__)
  return nr_state;
#else
  return -95;
#endif
}

/* `netLocalPort(fd)`: the port the socket is bound to, which is how a
   program that listened on port 0 learns the one the kernel chose. */
int32_t nish_net_local_port(int32_t fd) {
#if defined(__linux__)
  if (fd >= NR_BASE) {
    struct nr_set *S;
    int32_t ring, slot;
    return nr_decode(fd, &S, &ring, &slot) ? S->port : -9;
  }
#endif
  nish_sockaddr s;
  socklen_t n = sizeof s;
  if (getsockname(fd, &s.sa, &n) != 0) return nish_net_fail();
  return ntohs(s.sa.sa_family == AF_INET ? s.v4.sin_port : s.v6.sin6_port);
}

/* A socket of `type` bound to a numeric host and port, or the failure. An
   IPv4 host is an `AF_INET` socket; any other is `AF_INET6` with
   `IPV6_V6ONLY` off, so `::` hears both families. A stream gets
   `SO_REUSEADDR` and `arg` its backlog; a datagram socket's `arg` is
   `udpBind`'s flags. `opts` is a stream's `tcpListenFlags` word: bit 1 asks
   for `SO_REUSEPORT`, bit 2 for `TCP_NODELAY`. Every option is set before the
   bind, which is where `SO_REUSEPORT` has to be, and where `UDP_GRO` has to be
   for the first datagram to be coalesced. */
static int32_t nish_net_bound(const nish_str *host, int32_t port, int type, int32_t arg, int32_t opts) {
  unsigned char a[16];
  if ((uint32_t)port > 65535 || !nish_net_parse(host, a)) return -22;
  int v4 = memcmp(a, nish_mapped_prefix, 12) == 0;
  int fd = nish_net_socket(v4 ? AF_INET : AF_INET6, type);
  /* `::` on a kernel without IPv6: the same wildcard in the family there is.
     All sixteen bytes are zero, so the last four are already `0.0.0.0`. */
  static const unsigned char any[16];
  if (fd < 0 && errno == EAFNOSUPPORT && memcmp(a, any, 16) == 0) {
    v4 = 1;
    fd = nish_net_socket(AF_INET, type);
  }
  if (fd < 0) return nish_net_fail();
  int one = 1;
  int zero = 0;
  /* Both families at once on an IPv6 socket; on an IPv4 one this fails with
     `ENOPROTOOPT` and changes nothing, which is cheaper than asking. */
  setsockopt(fd, IPPROTO_IPV6, IPV6_V6ONLY, &zero, sizeof zero);
  int bad = (opts & 1) ? setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, &one, sizeof one) : 0;
  if (type == SOCK_STREAM) {
    setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
    if (opts & 2) bad |= setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof one);
  } else {
#if defined(__linux__)
    if (arg & 2) bad |= setsockopt(fd, IPPROTO_UDP, UDP_GRO, &one, sizeof one);
    /* ECN is always read. An IPv6 socket needs both: a datagram from an IPv4
       peer reports its TOS byte, one from an IPv6 peer its traffic class. */
    setsockopt(fd, IPPROTO_IP, IP_RECVTOS, &one, sizeof one);
    setsockopt(fd, IPPROTO_IPV6, IPV6_RECVTCLASS, &one, sizeof one);
#endif
  }
  nish_sockaddr s;
  socklen_t n = nish_net_sockaddr(&s, a, port, v4);
#if defined(__linux__)
  /* `tcpListenFlags` flag 4's program, two instructions, the kernel
     selftest's: load the receiving CPU, return it. It is the reuseport
     group's, so attaching it from every listener installs the same program
     each time, and it goes on after `listen`, once the socket is in its
     group. Only a stream listener's `opts` can hold 4. */
  static struct sock_filter cpu[] = {
      {BPF_LD | BPF_W | BPF_ABS, 0, 0, (uint32_t)(SKF_AD_OFF + SKF_AD_CPU)},
      {BPF_RET | BPF_A, 0, 0, 0},
  };
  static const struct sock_fprog steer = {2, cpu};
  /* `udpBind` flag 4's program (docs/h3-multicore.md §3.1): byte 0 of the
     Destination Connection ID, from byte 1 of a short header or byte 6 of a
     long one, modulo the group's count in bits 8-15 of the flags, so every
     datagram names a socket by its DCID alone and the kernel's address hash
     is never used. A load past a runt's end returns 0: socket 0. The count
     is the call's, so the program is built here and not shared. */
  static const struct sock_filter dcid0[] = {
      {BPF_LD | BPF_B | BPF_ABS, 0, 0, 0},
      {BPF_JMP | BPF_JSET | BPF_K, 2, 0, 0x80},
      {BPF_LD | BPF_B | BPF_ABS, 0, 0, 1},
      {BPF_JMP | BPF_JA, 0, 0, 1},
      {BPF_LD | BPF_B | BPF_ABS, 0, 0, 6},
      {BPF_ALU | BPF_MOD | BPF_K, 0, 0, 0},
      {BPF_RET | BPF_A, 0, 0, 0},
  };
  struct sock_filter dcid[7];
  memcpy(dcid, dcid0, sizeof dcid);
  dcid[5].k = (uint32_t)((arg >> 8) & 255);
  const struct sock_fprog quic = {7, dcid};
  int udp_steer = type == SOCK_DGRAM && (arg & 4);
#endif
  if (bad != 0 || bind(fd, &s.sa, n) != 0 || (type == SOCK_STREAM && listen(fd, arg) != 0)
#if defined(__linux__)
      || ((opts & 4) && setsockopt(fd, SOL_SOCKET, SO_ATTACH_REUSEPORT_CBPF, &steer, sizeof steer) != 0)
      || (udp_steer && setsockopt(fd, SOL_SOCKET, SO_ATTACH_REUSEPORT_CBPF, &quic, sizeof quic) != 0)
#endif
  ) {
    int e = errno;
    close(fd);
    return nish_net_err(e);
  }
  return fd;
}

/* `tcpListen(host, port, backlog)`: a listening socket with `SO_REUSEADDR`,
   so a restarted server rebinds a port whose old connections are still in
   TIME_WAIT. */
int32_t nish_tcp_listen(const nish_str *host, int32_t port, int32_t backlog) {
  return nish_net_bound(host, port, SOCK_STREAM, backlog, 0);
}

/* `tcpListenFlags(host, port, backlog, flags)`: `tcpListen`'s socket, with
   `SO_REUSEPORT` for flag 1, so several listeners of one uid share the port
   (Linux spreads new connections across them; Darwin hands them all to one),
   and `TCP_NODELAY` for flag 2, which the listener carries so that
   `tcpAccept` sets it on each connection it takes. Flag 4, which needs flag
   1, steers by CPU: a reuseport program (`SO_ATTACH_REUSEPORT_CBPF`) hands a
   new connection to the group's listener whose index is the CPU that received
   it, the index being the order the group's sockets were bound in, and the
   kernel falls back to its hash when there is no such listener. Linux alone
   has it; elsewhere flag 4 is -95. Flag 8 asks for io_uring slots: on Linux
   with io_uring, `tcpAccept` hands out slot handles rather than descriptors,
   so the listener holds connections past RLIMIT_NOFILE (above). Where rings
   are refused the listener is a plain one and `netRingState()` says why;
   Darwin has none, and the flag does nothing there. Any other bit, or 4
   without 1, is -22. */
int32_t nish_tcp_listen_flags(const nish_str *host, int32_t port, int32_t backlog, int32_t flags) {
  if ((uint32_t)flags > 15 || (flags & 5) == 4) return -22;
#if !defined(__linux__)
  if (flags & 4) return -95;
#endif
  int32_t fd = nish_net_bound(host, port, SOCK_STREAM, backlog, flags & 7);
#if defined(__linux__)
  if (fd >= 0 && (flags & 8)) {
    int32_t r = nr_open(fd, nish_net_local_port(fd));
    if (r < 0) {
      close(fd);
      return r;
    }
  }
#endif
  return fd;
}

/* A socket address of `n` bytes into the caller's 18-byte form. An IPv4 peer
   is written mapped, and the port is already in network order, which is the
   form's big-endian. Anything else -- no address at all, which is what
   `recvmsg` reports on a connected or Unix socket, or a family that is not
   IP -- is eighteen zeros: those bytes of `s` were never written, and copying
   them handed the caller whatever the stack held (docs/security/runtime.md,
   RT-6). */
static void nish_net_put(nish_array *out, const nish_sockaddr *s, socklen_t n) {
  unsigned char *p = (unsigned char *)out->data;
  uint16_t port = 0;
  memset(p, 0, NISH_ADDR_BYTES);
  if (n >= sizeof s->v4 && s->sa.sa_family == AF_INET) {
    memcpy(p, nish_mapped_prefix, 12);
    memcpy(p + 12, &s->v4.sin_addr, 4);
    port = s->v4.sin_port;
  } else if (n >= sizeof s->v6 && s->sa.sa_family == AF_INET6) {
    memcpy(p, &s->v6.sin6_addr, 16);
    port = s->v6.sin6_port;
  }
  memcpy(p + 16, &port, 2);
}

/* `tcpAccept(fd, peer)`: the next connection as a descriptor of its own,
   non-blocking and close-on-exec, with the peer's address written into
   `peer`; -11 when none is waiting. A `peer` shorter than 18 bytes is -22
   before anything is accepted, so no connection is taken and lost.

   A listener opened with `tcpListenFlags` flag 2 holds `TCP_NODELAY`, and the
   connection gets it here. Linux copies the option to an accepted socket,
   but that is not a rule other systems keep, so it is read off the listener
   and set on the connection everywhere. The listener is the record of the
   flag, rather than a table beside the descriptors, so it holds for a
   descriptor however the program came by it, and a closed listener's number
   reused leaves nothing stale behind. A listener that cannot answer (not
   TCP) has no Nagle to turn off; a connection on which the set fails is
   closed and its failure answered, so a flag-2 listener never hands out a
   socket without it. */
int32_t nish_tcp_accept(int32_t fd, nish_array *peer) {
  if (peer->len < NISH_ADDR_BYTES) return -22;
#if defined(__linux__)
  struct nr_set *R = nr_nsets > 0 ? nr_listener(fd) : NULL;
  if (R) return nr_accept(R, peer);
#endif
  nish_sockaddr s;
  socklen_t n = sizeof s;
#if defined(__linux__)
  int c = accept4(fd, &s.sa, &n, SOCK_NONBLOCK | SOCK_CLOEXEC);
#else
  int c = nish_net_setup(accept(fd, &s.sa, &n));
#endif
  if (c < 0) return nish_net_fail();
  int nodelay = 0;
  socklen_t size = sizeof nodelay;
  if (getsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &nodelay, &size) == 0 && nodelay != 0 &&
      setsockopt(c, IPPROTO_TCP, TCP_NODELAY, &nodelay, sizeof nodelay) != 0) {
    int e = errno;
    close(c);
    return nish_net_err(e);
  }
  nish_net_put(peer, &s, n);
  return c;
}

/* `tcpConnect(addr)`: a new socket, non-blocking and close-on-exec, connecting
   to the address in `addr`; an IPv4 one is an `AF_INET` socket, any other
   `AF_INET6`. A non-blocking `connect` seldom finishes at once (on Linux not
   even over loopback), and its `EINPROGRESS` (-115) is not a failure: the
   descriptor is answered all the same, and the connection is made once the
   loop reports it writable, when `connectResult` says how it went. Any other
   failure closes the socket and is answered instead of it. An `addr` shorter
   than 18 bytes is -22 before any socket exists. The socket holds
   `TCP_NODELAY` before it connects, as libpq and Go's net package set it on
   every client socket: a client writes whole requests and waits on the
   answer, and Nagle would hold a small write behind an unacknowledged one
   for a delayed ACK (#942). A refused option closes the socket and is
   answered instead of it. */
int32_t nish_tcp_connect(const nish_array *addr) {
  if (addr->len < NISH_ADDR_BYTES) return -22;
  const unsigned char *p = (const unsigned char *)addr->data;
  int v4 = memcmp(p, nish_mapped_prefix, 12) == 0;
  int fd = nish_net_socket(v4 ? AF_INET : AF_INET6, SOCK_STREAM);
  if (fd < 0) return nish_net_fail();
  int one = 1;
  if (setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof one) != 0) {
    int e = errno;
    close(fd);
    return nish_net_err(e);
  }
  nish_sockaddr s;
  socklen_t n = nish_net_sockaddr(&s, p, (p[16] << 8) | p[17], v4);
  if (connect(fd, &s.sa, n) != 0 && errno != EINPROGRESS) {
    int e = errno;
    close(fd);
    return nish_net_err(e);
  }
  return fd;
}

/* `connectResult(fd)`: how the connection `tcpConnect` started went, once the
   descriptor is writable: 0 when it is made, or its failure (-111 refused,
   -110 timed out) from `SO_ERROR`. The kernel clears `SO_ERROR` as it is
   read, so a failure is answered once. */
int32_t nish_connect_result(int32_t fd) {
  int e = 0;
  socklen_t n = sizeof e;
  if (getsockopt(fd, SOL_SOCKET, SO_ERROR, &e, &n) != 0) return nish_net_fail();
  return e != 0 ? nish_net_err(e) : 0;
}

/* `netRead(fd, buf, off, len)`: at most `len` bytes into `buf` from `off`.
   The compiled call has already checked `0 <= off <= off + len <=
   buf.length`. */
int32_t nish_net_read(int32_t fd, nish_array *buf, int64_t off, int64_t len) {
#if defined(__linux__)
  if (fd >= NR_BASE) {
    struct nr_set *S;
    int32_t ring, slot;
    struct nr_conn *c = nr_decode(fd, &S, &ring, &slot);
    return c ? nr_read(S, c, ring, slot, buf, off, len) : -9;
  }
#endif
  ssize_t n = recv(fd, buf->data + off, (size_t)len, 0);
  return n < 0 ? nish_net_fail() : (int32_t)n;
}

/* `netWrite(fd, buf, off, len)`: at most `len` bytes of `buf` from `off`,
   with a peer that has gone answering -32 rather than raising SIGPIPE. */
int32_t nish_net_write(int32_t fd, const nish_array *buf, int64_t off, int64_t len) {
#if defined(__linux__)
  if (fd >= NR_BASE) {
    struct nr_set *S;
    int32_t ring, slot;
    struct nr_conn *c = nr_decode(fd, &S, &ring, &slot);
    return c ? nr_send(S, c, ring, slot, buf->data + off, len) : -9;
  }
#endif
  ssize_t n = send(fd, buf->data + off, (size_t)len, NISH_NOSIGNAL);
  return n < 0 ? nish_net_fail() : (int32_t)n;
}

/* `netWrite2(fd, a, aoff, alen, b, boff, blen)`: `netWrite` of two ranges in
   one `sendmsg`, so a response head and its body leave in one system call
   without being copied together first. Both ranges are checked by the
   compiled call. The count is at most `alen + blen`; a sum past `INT32_MAX`
   is offered only up to it, so the answer always fits, and a short write is a
   count, as `netWrite`'s is. */
int32_t nish_net_write2(int32_t fd, const nish_array *a, int64_t aoff, int64_t alen, const nish_array *b,
                        int64_t boff, int64_t blen) {
  struct iovec iov[2];
  struct msghdr msg;
  if (blen > (int64_t)INT32_MAX - alen) blen = (int64_t)INT32_MAX - alen;
#if defined(__linux__)
  if (fd >= NR_BASE) {
    struct nr_set *S;
    int32_t ring, slot;
    struct nr_conn *c = nr_decode(fd, &S, &ring, &slot);
    if (!c) return -9;
    int32_t n = nr_send(S, c, ring, slot, a->data + aoff, alen);
    if (n < 0 || n < alen || blen == 0) return n;
    int32_t m = nr_send(S, c, ring, slot, b->data + boff, blen);
    /* With nothing of the first range sent, the second's answer is the
       call's, -11 included, as `sendmsg`'s would be. */
    return n == 0 ? m : m < 0 ? n : n + m;
  }
#endif
  iov[0].iov_base = a->data + aoff;
  iov[0].iov_len = (size_t)alen;
  iov[1].iov_base = b->data + boff;
  iov[1].iov_len = (size_t)blen;
  memset(&msg, 0, sizeof msg);
  msg.msg_iov = iov;
  msg.msg_iovlen = 2;
  ssize_t n = sendmsg(fd, &msg, NISH_NOSIGNAL);
  return n < 0 ? nish_net_fail() : (int32_t)n;
}

/* `netShutdown(fd, how)`: 0 the read side, 1 the write side, 2 both, which
   are `SHUT_RD`, `SHUT_WR` and `SHUT_RDWR` on both platforms. */
int32_t nish_net_shutdown(int32_t fd, int32_t how) {
  if ((uint32_t)how > 2) return -22;
#if defined(__linux__)
  if (fd >= NR_BASE) { struct nr_set *S; int32_t ring, slot;
    struct nr_conn *c = nr_decode(fd, &S, &ring, &slot);
    return c ? nr_shutdown(S, c, ring, slot, how) : -9; }
#endif
  return shutdown(fd, how) != 0 ? nish_net_fail() : 0;
}

/* `netClose(fd)`. The descriptor is gone whatever this answers, as `close`
   promises on Linux, so a failure is information rather than a retry. */
int32_t nish_net_close(int32_t fd) {
#if defined(__linux__)
  if (fd >= NR_BASE) {
    struct nr_set *S;
    int32_t ring, slot;
    struct nr_conn *c = nr_decode(fd, &S, &ring, &slot);
    return c ? nr_close(S, c, ring, slot) : -9;
  }
  struct nr_set *R = nr_nsets > 0 ? nr_listener(fd) : NULL;
  if (R) return nr_close_listener(R);
  if (nr_nsets > 0) nr_forget_loop(fd);
  nr_fd_forget(fd);
#endif
  return close(fd) != 0 ? nish_net_fail() : 0;
}

/* `netSetOption(fd, option, value)`: one option from a whitelist, named by
   the runtime's own id rather than a level and an option number, so a
   program can set these five and nothing else. `value` is 0 or 1 for the
   flags and a byte count for the buffers, passed to the kernel as it is
   (Linux stores twice a buffer size, to cover its bookkeeping). Linux does
   not keep quick-ACK mode: the kernel leaves it of its own accord, so a
   server that wants it on or off sets it again after each response. */
int32_t nish_net_set_option(int32_t fd, int32_t option, int32_t value) {
#if defined(__linux__)
  /* A slot's socket is the ring's; no option reaches it from here. */
  if (fd >= NR_BASE) {
    struct nr_set *S;
    int32_t ring, slot;
    return nr_decode(fd, &S, &ring, &slot) ? -95 : -9;
  }
#endif
  int level = SOL_SOCKET;
  int name;
  switch (option) {
  case 1:
    level = IPPROTO_TCP;
    name = TCP_NODELAY;
    break;
  case 2:
#if defined(__linux__)
    level = IPPROTO_TCP;
    name = TCP_QUICKACK;
    break;
#else
    return -95;
#endif
  case 3:
    name = SO_KEEPALIVE;
    break;
  case 4:
    name = SO_SNDBUF;
    break;
  case 5:
    name = SO_RCVBUF;
    break;
  default:
    return -22;
  }
  return setsockopt(fd, level, name, &value, sizeof value) != 0 ? nish_net_fail() : 0;
}

/* `netMss(fd)`: the segment size a connected TCP socket sends, the bytes of
   payload one packet carries, or a plain -1 when there is none to read: not
   an errno, because "no MSS" is one answer whatever the reason. A socket
   with no peer is -1 first, as a fresh one answers the default 536 to both
   options below. Linux's `TCP_INFO` answers the current `tcpi_snd_mss`; the
   kernel copies at most the struct it has and says how much, so an answer
   too short to reach the field is not read. `TCP_MAXSEG` is the fallback,
   and Darwin's only reading. A ring slot is -1 too (NURING-39): its socket
   is a fixed file with no descriptor to ask, and io_uring's getsockopt
   command reads only SOL_SOCKET options, not TCP's. */
int32_t nish_net_mss(int32_t fd) {
#if defined(__linux__)
  if (fd >= NR_BASE) return -1;
#endif
  struct sockaddr_storage peer;
  socklen_t len = sizeof peer;
  if (getpeername(fd, (struct sockaddr *)&peer, &len) != 0) return -1;
#if defined(TCP_INFO) && defined(__linux__)
  struct tcp_info info;
  memset(&info, 0, sizeof info);
  len = sizeof info;
  if (getsockopt(fd, IPPROTO_TCP, TCP_INFO, &info, &len) == 0 &&
      len >= offsetof(struct tcp_info, tcpi_snd_mss) + sizeof info.tcpi_snd_mss &&
      info.tcpi_snd_mss > 0 && info.tcpi_snd_mss <= INT32_MAX)
    return (int32_t)info.tcpi_snd_mss;
#endif
#if defined(TCP_MAXSEG)
  int mss = 0;
  len = sizeof mss;
  if (getsockopt(fd, IPPROTO_TCP, TCP_MAXSEG, &mss, &len) == 0 && len == sizeof mss && mss > 0) return mss;
#endif
  return -1;
}

/* `udpBind(host, port, flags)`: a datagram socket, non-blocking and
   close-on-exec, bound like `tcpListen`'s, with `SO_REUSEPORT` for flag 1
   and `UDP_GRO` for flag 2. Flag 4 steers QUIC (docs/h3-multicore.md): it
   needs flag 1 and a group count N from 1 to 255 in bits 8-15, refuses
   flag 2, and attaches a reuseport program that hands each datagram to the
   group's socket at index (DCID byte 0) mod N. A refused attach closes the
   socket and answers the error. Any other bit, flag 4 without 1, with 2 or
   with a count of 0, or a count without 4, is -22; Linux alone has 2 and 4,
   elsewhere they are -95. */
int32_t nish_udp_bind(const nish_str *host, int32_t port, int32_t flags) {
  /* Without flag 4, 0 to 3; with it, flag 1 alone below it and a count. */
  if ((flags & 4) ? (uint32_t)flags > 0xffff || flags < 0x100 || (flags & 0xfb) != 1 : (uint32_t)flags > 3)
    return -22;
#if !defined(__linux__)
  if (flags & 6) return -95;
#endif
  return nish_net_bound(host, port, SOCK_DGRAM, flags, flags & 1);
}

/* Room for the two control messages either direction carries: a segment size
   (a `uint16_t` out, an `int` in) and a TOS byte or traffic class (an `int`
   either way). A union, so the buffer is aligned as a `cmsghdr` must be. */
typedef union nish_cmsgs {
  struct cmsghdr h;
  char b[CMSG_SPACE(sizeof(int)) * 2];
} nish_cmsgs;

/* `udpSendTo(fd, buf, off, len, to, segment, ecn)`: `buf[off, off + len)` to
   the address in `to`, in one `sendmsg`. A `segment` above 0 is
   `UDP_SEGMENT`: the kernel cuts the payload into datagrams of that many
   bytes, the last one shorter, which is one system call for many datagrams.
   `ecn` is the two ECN bits of the IP header (0 not ECN-capable, 1 ECT(1),
   2 ECT(0), 3 CE). A `to` shorter than 18 bytes, a `segment` outside 0..65535
   or an `ecn` outside 0..3 is -22. */
int32_t nish_udp_send_to(int32_t fd, const nish_array *buf, int64_t off, int64_t len, const nish_array *to,
                         int32_t segment, int32_t ecn) {
  if (to->len < NISH_ADDR_BYTES || (uint32_t)segment > 65535 || (uint32_t)ecn > 3) return -22;
  const unsigned char *p = (const unsigned char *)to->data;
  int v4 = memcmp(p, nish_mapped_prefix, 12) == 0;
#if !defined(__linux__)
  if (segment > 0 || ecn > 0) return -95;
  /* Darwin's IPv6 socket takes an IPv4 peer only in its mapped form. */
  nish_sockaddr self;
  socklen_t k = sizeof self;
  if (v4 && getsockname(fd, &self.sa, &k) == 0 && self.sa.sa_family == AF_INET6) v4 = 0;
#endif
  /* Linux: an IPv4 peer as an `AF_INET` address, which an IPv4 socket needs
     and a dual-stack IPv6 one accepts, sending it as IPv4. */
  nish_sockaddr s;
  socklen_t n = nish_net_sockaddr(&s, p, (p[16] << 8) | p[17], v4);
  struct iovec iov = {buf->data + off, (size_t)len};
  struct msghdr m = {.msg_name = &s, .msg_namelen = n, .msg_iov = &iov, .msg_iovlen = 1};
#if defined(__linux__)
  /* Zeroed, so the padding `CMSG_SPACE` adds after each message is too. */
  nish_cmsgs c;
  memset(&c, 0, sizeof c);
  size_t used = 0;
  struct cmsghdr *h = &c.h;
  if (segment > 0) {
    uint16_t size = (uint16_t)segment;
    h->cmsg_level = SOL_UDP;
    h->cmsg_type = UDP_SEGMENT;
    h->cmsg_len = CMSG_LEN(sizeof size);
    memcpy(CMSG_DATA(h), &size, sizeof size);
    used = CMSG_SPACE(sizeof size);
    h = (struct cmsghdr *)(c.b + used);
  }
  if (ecn > 0) {
    /* The level follows the header the datagram leaves with: IPv4's TOS for
       an IPv4 peer, whatever the socket's family, IPv6's traffic class
       otherwise. */
    h->cmsg_level = v4 ? IPPROTO_IP : IPPROTO_IPV6;
    h->cmsg_type = v4 ? IP_TOS : IPV6_TCLASS;
    h->cmsg_len = CMSG_LEN(sizeof ecn);
    memcpy(CMSG_DATA(h), &ecn, sizeof ecn);
    used += CMSG_SPACE(sizeof ecn);
  }
  if (used > 0) {
    m.msg_control = c.b;
    m.msg_controllen = used;
  }
#endif
  ssize_t sent = sendmsg(fd, &m, 0);
  return sent < 0 ? nish_net_fail() : (int32_t)sent;
}

/* `udpRecvFrom(fd, buf, off, len, from, meta)`: the next datagram into
   `buf[off, off + len)` in one `recvmsg`, its sender's address into `from`,
   and into `meta` the segment size (`meta[0]`: the size of each datagram
   `UDP_GRO` coalesced into this one, 0 when it coalesced none) and the ECN
   bits it arrived with (`meta[1]`). A datagram longer than `len` is cut to
   it. -11 when none is waiting; a `from` shorter than 18 bytes or a `meta`
   shorter than 2 is -22 before anything is taken. */
int32_t nish_udp_recv_from(int32_t fd, nish_array *buf, int64_t off, int64_t len, nish_array *from,
                           nish_array *meta) {
  if (from->len < NISH_ADDR_BYTES || meta->len < 2) return -22;
  nish_sockaddr s;
  struct iovec iov = {buf->data + off, (size_t)len};
  nish_cmsgs c;
  struct msghdr m = {
      .msg_name = &s, .msg_namelen = sizeof s, .msg_iov = &iov, .msg_iovlen = 1, .msg_control = c.b, .msg_controllen = sizeof c};
  ssize_t got = recvmsg(fd, &m, 0);
  if (got < 0) return nish_net_fail();
  /* Darwin sets neither option, so both stay 0 there: a `meta[1]` that reads
     as Not-ECT whatever arrived, which is why the -95 of a marked send, not
     this, is how a program learns ECN is unsupported. */
  int32_t info[2] = {0, 0};
#if defined(__linux__)
  for (struct cmsghdr *h = CMSG_FIRSTHDR(&m); h != NULL; h = CMSG_NXTHDR(&m, h)) {
    /* `UDP_GRO` and `IPV6_TCLASS` carry an `int`, IPv4's `IP_TOS` one byte. */
    const unsigned char *d = CMSG_DATA(h);
    int v = *d;
    if (h->cmsg_len >= CMSG_LEN(sizeof v)) memcpy(&v, d, sizeof v);
    if (h->cmsg_level == SOL_UDP && h->cmsg_type == UDP_GRO) info[0] = v;
    if ((h->cmsg_level == IPPROTO_IP && h->cmsg_type == IP_TOS) ||
        (h->cmsg_level == IPPROTO_IPV6 && h->cmsg_type == IPV6_TCLASS))
      info[1] = v & 3;
  }
#endif
  memcpy(meta->data, info, sizeof info);
  nish_net_put(from, &s, m.msg_namelen);
  return (int32_t)got;
}

/* The readiness loop. Level-triggered: a descriptor that is still ready is
   reported again by the next wait, so a program that handles one event of
   many loses none. The events a program asks for and is told of are bits: 1
   readable, 2 writable, and, told only, 4 for a hang-up or an error. A token
   is the program's own `i32` for the descriptor, handed back as it was
   given. Nothing allocates: the kernel's records for one wait are on the
   stack, at most `NISH_POLL_CHUNK` of them, and whatever did not fit is still
   ready at the next wait. */
#define NISH_POLL_CHUNK 64
#if defined(__linux__)
#define NISH_POLL_ADD EPOLL_CTL_ADD
#define NISH_POLL_MODIFY EPOLL_CTL_MOD
#define NISH_POLL_REMOVE EPOLL_CTL_DEL
#else
#define NISH_POLL_ADD 0
#define NISH_POLL_MODIFY 1
#define NISH_POLL_REMOVE 2
#endif

/* `pollCreate()`: a loop descriptor, close-on-exec from the moment it exists
   on Linux, where `epoll_create1(EPOLL_CLOEXEC)` sets it atomically, and from
   the `fcntl` after `kqueue()` on Darwin, where a child another thread spawns
   in between can inherit it, as `nish_net_setup`'s sockets can. */
int32_t nish_poll_create(void) {
  nish_net_raise_nofile();
#if defined(__linux__)
  int fd = epoll_create1(EPOLL_CLOEXEC);
  if (fd >= 0) nr_fd_forget(fd);
#else
  int fd = kqueue();
  if (fd >= 0) fcntl(fd, F_SETFD, FD_CLOEXEC);
#endif
  return fd < 0 ? nish_net_fail() : fd;
}

#if !defined(__linux__)
/* One kqueue change, answered as an errno or 0. `EV_RECEIPT` returns each
   change's own result rather than failing the whole call, and takes no event
   off the queue. */
static int nish_poll_change(int32_t loop, int32_t fd, int filter, int flags, int32_t token) {
  struct kevent k;
  EV_SET(&k, fd, filter, flags | EV_RECEIPT, 0, 0, (void *)(intptr_t)token);
  if (kevent(loop, &k, 1, &k, 1, NULL) < 0) return errno;
  return (k.flags & EV_ERROR) ? (int)k.data : 0;
}
#endif

/* Add, modify or remove `fd` in `loop`. epoll does each in one call, with
   the token in `data.u32`. kqueue has a filter per direction rather than a
   set of events, so the answers epoll gives are built from filters: a
   descriptor in the loop has at least one, a disabled read filter standing for
   one added watching nothing; an add first touches both filters with no flags,
   which answers ENOENT for a filter not there, and is EEXIST when either is;
   a modification or a removal deletes both, and is ENOENT when neither was
   there; a modification then adds the ones asked for, each carrying the token
   in `udata`. A touch rewrites the filter's `udata`, and the add touches both
   filters, so the add that answers -17 leaves the descriptor watched for its
   old events, both ways, under the token it gave rather than the old one. */
static int32_t nish_poll_ctl(int32_t loop, int op, int32_t fd, int32_t events, int32_t token) {
  if ((uint32_t)events > 3) return -22;
#if defined(__linux__)
  if (nr_nsets > 0) {
    int stale;
    struct nr_set *S;
    struct nr_vent *v = nr_vent_for(fd, &stale, &S);
    if (stale) return -9;
    if (v) return nr_ctl(loop, op, v, S, events, token);
  }
  struct epoll_event e;
  memset(&e, 0, sizeof e);
  e.events = ((events & 1) ? EPOLLIN : 0) | ((events & 2) ? EPOLLOUT : 0);
  /* The high word is 0 for a descriptor, and 1 for a ring set's own. */
  e.data.u64 = (uint32_t)token;
  if (epoll_ctl(loop, op, fd, &e) != 0) return nish_net_fail();
  nr_fd_note(loop, op, fd, events);
  return 0;
#else
  int r, w;
  if (op == NISH_POLL_ADD) {
    r = nish_poll_change(loop, fd, EVFILT_READ, 0, token);
    w = nish_poll_change(loop, fd, EVFILT_WRITE, 0, token);
    if (r == 0 || w == 0) return -17;
    if (r != ENOENT) return nish_net_err(r);
    if (w != ENOENT) return nish_net_err(w);
  } else {
    r = nish_poll_change(loop, fd, EVFILT_READ, EV_DELETE, 0);
    w = nish_poll_change(loop, fd, EVFILT_WRITE, EV_DELETE, 0);
    if (r != 0 && w != 0) return nish_net_err(r);
    if (op == NISH_POLL_REMOVE) return 0;
  }
  int e = 0;
  if (events & 1) e = nish_poll_change(loop, fd, EVFILT_READ, EV_ADD | EV_ENABLE, token);
  if (e == 0 && (events & 2)) e = nish_poll_change(loop, fd, EVFILT_WRITE, EV_ADD | EV_ENABLE, token);
  if (events == 0) e = nish_poll_change(loop, fd, EVFILT_READ, EV_ADD | EV_DISABLE, token);
  return e != 0 ? nish_net_err(e) : 0;
#endif
}

/* `pollAdd(loop, fd, events, token)`: watch `fd` for `events` under `token`. */
int32_t nish_poll_add(int32_t loop, int32_t fd, int32_t events, int32_t token) {
  return nish_poll_ctl(loop, NISH_POLL_ADD, fd, events, token);
}

/* `pollModify(loop, fd, events, token)`: the same descriptor, new events or a new token. */
int32_t nish_poll_modify(int32_t loop, int32_t fd, int32_t events, int32_t token) {
  return nish_poll_ctl(loop, NISH_POLL_MODIFY, fd, events, token);
}

/* `pollRemove(loop, fd)`: stop watching `fd`. Closing it does the same. */
int32_t nish_poll_remove(int32_t loop, int32_t fd) { return nish_poll_ctl(loop, NISH_POLL_REMOVE, fd, 0, 0); }

/* `pollWait(loop, ready, timeoutMs)`: wait until a descriptor is ready or
   `timeout_ms` milliseconds pass, a negative one never, and write a token and
   its events into `ready` per ready descriptor, `ready[2k]` and
   `ready[2k + 1]`. The count is at most `ready.length / 2` and at most
   `NISH_POLL_CHUNK`. Until the process has opened a ring listener, a signal
   that interrupts the wait answers 0, as a timeout does, rather than waiting
   again past the deadline; the program's loop comes round and, if it watches
   `signalFd()`, finds the signal ready. From then on, for the rest of the
   process's life, an interrupted wait sleeps again (NURING-14).
   A `ready` shorter than 2 is -22. */
int32_t nish_poll_wait(int32_t loop, nish_array *ready, int32_t timeout_ms) {
  uint64_t room = ready->len / 2;
  if (room == 0) return -22;
  int max = room < NISH_POLL_CHUNK ? (int)room : NISH_POLL_CHUNK;
  int32_t *out = (int32_t *)ready->data;
#if defined(__linux__)
  if (nr_nsets > 0) return nr_poll_wait(loop, out, max, timeout_ms);
  struct epoll_event e[NISH_POLL_CHUNK];
  /* epoll waits forever for any negative timeout, as the language does. */
  int n = epoll_wait(loop, e, max, timeout_ms);
  if (n < 0) return errno == EINTR ? 0 : nish_net_fail();
  for (int i = 0; i < n; i++) {
    uint32_t got = e[i].events;
    out[2 * i] = (int32_t)e[i].data.u32;
    out[2 * i + 1] = ((got & EPOLLIN) ? 1 : 0) | ((got & EPOLLOUT) ? 2 : 0) | ((got & (EPOLLHUP | EPOLLERR)) ? 4 : 0);
  }
  return n;
#else
  /* A record per filter, so a descriptor ready both ways is two, folded here
     into one pair as epoll's one event is. Twice the room is asked for, so a
     full `ready` is not cut short by the folding; a descriptor that finds no
     pair free is still ready at the next wait. */
  struct kevent e[NISH_POLL_CHUNK];
  struct timespec t = {timeout_ms / 1000, (long)(timeout_ms % 1000) * 1000000};
  int got = kevent(loop, NULL, 0, e, 2 * max < NISH_POLL_CHUNK ? 2 * max : NISH_POLL_CHUNK, timeout_ms < 0 ? NULL : &t);
  if (got < 0) return errno == EINTR ? 0 : nish_net_fail();
  int n = 0;
  for (int i = 0; i < got; i++) {
    int32_t bits = (e[i].filter == EVFILT_READ ? 1 : 2) | ((e[i].flags & (EV_EOF | EV_ERROR)) ? 4 : 0);
    int k = 0;
    while (k < n && e[k].ident != e[i].ident) k++;
    if (k == n) {
      if (n == max) continue;
      e[n] = e[i];
      out[2 * n] = (int32_t)(intptr_t)e[i].udata;
      out[2 * n + 1] = 0;
      n++;
    }
    out[2 * k + 1] |= bits;
  }
  return n;
#endif
}

/* `pollWaitBatch(loop, ready, timeoutMs, minEvents, maxWaitMs)`: wait as
   `pollWait` does for the first event, then, on a loop with one ring set,
   up to `maxWaitMs` more until `minEvents` are ready (nr_batch). */
int32_t nish_poll_wait_batch(int32_t loop, nish_array *ready, int32_t timeout_ms, int32_t min_events,
                             int32_t max_wait_ms) {
#if defined(__linux__)
  uint64_t room = ready->len / 2;
  if (nr_nsets > 0 && min_events > 1 && max_wait_ms > 0 && room > 0) {
    int max = room < NISH_POLL_CHUNK ? (int)room : NISH_POLL_CHUNK;
    int32_t *out = (int32_t *)ready->data;
    nr_epoch++;
    int n = nr_poll_wait(loop, out, max, timeout_ms);
    if (n <= 0 || n >= min_events || n >= max) return n;
    return nr_batch(loop, out, n, max, min_events, max_wait_ms);
  }
#else
  (void)min_events;
  (void)max_wait_ms;
#endif
  return nish_poll_wait(loop, ready, timeout_ms);
}

/* The Unix-domain address `path` names into `s`, its length into `n`, and 1
   or 0 for whether it is abstract; or the failure, before any socket exists.
   An empty path or one with a NUL inside is -22, and so is a bare `@`. A path
   too long for `sun_path` with its NUL is -36: the kernel would cut it short
   or refuse it, and a cut one binds a file the program never named
   (docs/security/runtime.md, RT-33). A leading `@` is Linux's abstract
   namespace: the rest, at most `sizeof sun_path - 1` bytes, follows a NUL,
   and the length is exact, because the name is every byte the length covers.
   Darwin has no abstract namespace, so there `@` is -95. */
static int32_t nish_unix_addr(const nish_str *path, struct sockaddr_un *s, socklen_t *n) {
  const char *p = path->data;
  uint64_t len = path->len;
  memset(s, 0, sizeof *s);
  s->sun_family = AF_UNIX;
  if (len == 0 || strlen(p) != len || (len == 1 && p[0] == '@')) return -22;
  int abstract = p[0] == '@';
#if !defined(__linux__)
  if (abstract) return -95;
#endif
  if (len + !abstract > sizeof s->sun_path) return -36;
  memcpy(s->sun_path, p, len);
  if (abstract) s->sun_path[0] = 0;
  *n = (socklen_t)(offsetof(struct sockaddr_un, sun_path) + len + !abstract);
#if !defined(__linux__)
  s->sun_len = (unsigned char)*n;
#endif
  return abstract;
}

/* Whether the socket file at `s` (`n` bytes) is stale, for `unixListen` flag
   1 after a bind found the path taken: 0 once it is unlinked, else the
   failure. Anything but a socket is -17 and left alone. A probe connects to
   it: a refusal means nothing listens, and only then is the file unlinked; a
   connect that succeeds or would wait (a full backlog) is a live listener,
   -98. The probe is a connection the live listener sees and that closes at
   once. Between the probe and the unlink another process may bind the path,
   and that file is the one unlinked: the socket's directory is the trust
   boundary (RT-34). Darwin refuses a connect to a listener whose backlog is
   full with the same `ECONNREFUSED` as one to a dead file, so the probe
   cannot tell them apart there, and a socket file in the way is -95 and left
   alone: the flag never removes a live listener's file. */
static int32_t nish_unix_stale(const struct sockaddr_un *s, socklen_t n) {
  struct stat st;
  if (lstat(s->sun_path, &st) != 0) return errno == ENOENT ? 0 : nish_net_fail();
  if (!S_ISSOCK(st.st_mode)) return -17;
#if !defined(__linux__)
  (void)n;
  return -95;
#else
  int probe = nish_net_socket(AF_UNIX, SOCK_STREAM);
  if (probe < 0) return nish_net_fail();
  int e = connect(probe, (const struct sockaddr *)s, n) == 0 ? 0 : errno;
  close(probe);
  if (e != ECONNREFUSED) return e == 0 || e == EAGAIN || e == EINPROGRESS ? -98 : nish_net_err(e);
  return unlink(s->sun_path) != 0 && errno != ENOENT ? nish_net_fail() : 0;
#endif
}

/* A listening Unix stream socket at `path`, or the failure. A path that
   exists is -98, unless flag 1 asks `nish_unix_stale` to clear a socket file
   nothing listens on, after which the bind is tried once more; any other bit
   is -22, and an abstract name ignores the flag, since no file is left
   behind. A pathname socket's file gets `mode` between the bind and the
   listen: a connect needs write permission on it, and until the listen every
   connect is refused, so the umask's mode the bind gave it never admits
   anyone (RT-35; `tests/cases/net_unix_paths` checks the order under umask
   0). A failure after the bind closes the socket and unlinks the
   file it made, so no failure leaves a descriptor or a file behind
   (RT-36). */
static int32_t nish_unix_bound(const nish_str *path, int32_t backlog, int32_t flags, int32_t mode) {
  if ((uint32_t)flags > 1) return -22;
  struct sockaddr_un s;
  socklen_t n;
  int32_t abstract = nish_unix_addr(path, &s, &n);
  if (abstract < 0) return abstract;
  int fd = nish_net_socket(AF_UNIX, SOCK_STREAM);
  if (fd < 0) return nish_net_fail();
  int bound = bind(fd, (struct sockaddr *)&s, n);
  if (bound != 0 && errno == EADDRINUSE && (flags & 1) && !abstract) {
    int32_t stale = nish_unix_stale(&s, n);
    if (stale != 0) {
      close(fd);
      return stale;
    }
    bound = bind(fd, (struct sockaddr *)&s, n);
  }
  if (bound != 0) {
    int e = errno;
    close(fd);
    return nish_net_err(e);
  }
  if ((!abstract && chmod(s.sun_path, (mode_t)mode) != 0) || listen(fd, backlog) != 0) {
    int e = errno;
    close(fd);
    if (!abstract) unlink(s.sun_path);
    return nish_net_err(e);
  }
  return fd;
}

/* `unixListen(path, backlog, flags)`: a listening Unix stream socket whose
   file only its owner may connect to (0600). */
int32_t nish_unix_listen(const nish_str *path, int32_t backlog, int32_t flags) {
  return nish_unix_bound(path, backlog, flags, 0600);
}

/* `unixListenMode(path, backlog, flags, mode)`: the same with the file's mode
   chosen, 0 to 0o777 and no other bits; an abstract name has no file to give
   one, so it is -22, as a mode outside the range is. */
int32_t nish_unix_listen_mode(const nish_str *path, int32_t backlog, int32_t flags, int32_t mode) {
  if ((uint32_t)mode > 0777) return -22;
  if (path->len > 0 && path->data[0] == '@') return -22;
  return nish_unix_bound(path, backlog, flags, mode);
}

/* `unixConnect(path)`: a new socket, non-blocking and close-on-exec,
   connecting to the listener at `path`. A Unix connect finishes at once or
   fails; a full backlog is -11 on Linux (`EAGAIN`) and -111 on Darwin, which
   answers it as it answers a dead file, and either closes the socket, so the
   caller tries again later. `EINPROGRESS` is answered as `tcpConnect`
   answers it: the descriptor, with `connectResult` to say how it went once it
   is writable. Any other failure closes the socket and is answered. */
int32_t nish_unix_connect(const nish_str *path) {
  struct sockaddr_un s;
  socklen_t n;
  int32_t abstract = nish_unix_addr(path, &s, &n);
  if (abstract < 0) return abstract;
  int fd = nish_net_socket(AF_UNIX, SOCK_STREAM);
  if (fd < 0) return nish_net_fail();
  if (connect(fd, (struct sockaddr *)&s, n) != 0 && errno != EINPROGRESS) {
    int e = errno;
    close(fd);
    return nish_net_err(e);
  }
  return fd;
}

/* `unixAccept(fd)`: the next connection, non-blocking and close-on-exec; -11
   when none is waiting. A Unix peer has no address worth the name (a client
   is seldom bound), so none is written. */
int32_t nish_unix_accept(int32_t fd) {
#if defined(__linux__)
  int c = accept4(fd, NULL, NULL, SOCK_NONBLOCK | SOCK_CLOEXEC);
#else
  int c = nish_net_setup(accept(fd, NULL, NULL));
#endif
  return c < 0 ? nish_net_fail() : c;
}

/* `unixSocketPair(kind, fds)`: two connected sockets into `fds[0]` and
   `fds[1]`, non-blocking and close-on-exec, and 0. Kind 1 is a byte stream,
   kind 2 keeps each write one message (`SOCK_SEQPACKET`), and any other kind,
   or an `fds` shorter than two, is -22 before any socket exists. Darwin has
   no Unix `SOCK_SEQPACKET`, so kind 2 there is -95. */
int32_t nish_unix_socket_pair(int32_t kind, nish_array *fds) {
  if ((kind != 1 && kind != 2) || fds->len < 2) return -22;
  int sv[2];
  nish_net_raise_nofile();
#if defined(__linux__)
  if (socketpair(AF_UNIX, (kind == 1 ? SOCK_STREAM : SOCK_SEQPACKET) | SOCK_NONBLOCK | SOCK_CLOEXEC, 0, sv) != 0)
    return nish_net_fail();
#else
  if (socketpair(AF_UNIX, kind == 1 ? SOCK_STREAM : SOCK_SEQPACKET, 0, sv) != 0)
    return errno == EPROTONOSUPPORT || errno == EPROTOTYPE ? -95 : nish_net_fail();
  nish_net_setup(sv[0]);
  nish_net_setup(sv[1]);
#endif
  int32_t *out = (int32_t *)fds->data;
  out[0] = sv[0];
  out[1] = sv[1];
  return 0;
}

/* 0 when `fd` is a Unix-domain socket, the one kind a descriptor or a
   credential passes over; else the refusal: -88 for a descriptor that is not
   a socket, -95 for a socket of another family, and the host's failure for a
   descriptor that is not open (-9). Asked before the call rather than read
   from it, because a TCP socket does not refuse `SCM_RIGHTS` as such: Linux
   answers -22 for the control message, and `SO_PEERCRED` on one succeeds with
   no peer behind it. */
static int32_t nish_unix_only(int32_t fd) {
  struct sockaddr_un s;
  socklen_t n = sizeof s;
  if (getsockname(fd, (struct sockaddr *)&s, &n) != 0) return nish_net_fail();
  return s.sun_family == AF_UNIX ? 0 : -95;
}

/* The most descriptors one `recvFd` makes room for: one is kept and every
   other is closed, so the room only decides how many the kernel installs to
   be closed rather than drops itself (docs/security/runtime.md, RT-37). */
#define NISH_RECV_FDS 8

/* Linux marks a received descriptor close-on-exec as it arrives; Darwin has
   no such flag, and `nish_recv_fd` marks it after (RT-38). */
#if defined(__linux__)
#define NISH_RECV_CLOEXEC MSG_CMSG_CLOEXEC
#else
#define NISH_RECV_CLOEXEC 0
#endif

/* `sendFd(sock, fd, buf, off, len)`: `len` bytes of `buf` from `off`, with
   one `SCM_RIGHTS` copy of `fd` riding on them, and the bytes sent or the
   failure. A descriptor travels with data, so `len` 0 is -22, and so is a
   negative `fd`; one that is not open is the kernel's -9. Only a Unix socket
   carries one (`nish_unix_only`). A gone peer is -32, as `netWrite`'s is.
   The descriptor stays open here: the receiver gets its own. */
int32_t nish_send_fd(int32_t sock, int32_t fd, const nish_array *buf, int64_t off, int64_t len) {
  if (len == 0 || fd < 0) return -22;
  int32_t kind = nish_unix_only(sock);
  if (kind != 0) return kind;
  union {
    struct cmsghdr h;
    char room[CMSG_SPACE(sizeof(int))];
  } c;
  memset(&c, 0, sizeof c);
  struct iovec v = {buf->data + off, (size_t)len};
  struct msghdr m;
  memset(&m, 0, sizeof m);
  m.msg_iov = &v;
  m.msg_iovlen = 1;
  m.msg_control = c.room;
  m.msg_controllen = sizeof c.room;
  struct cmsghdr *h = CMSG_FIRSTHDR(&m);
  h->cmsg_level = SOL_SOCKET;
  h->cmsg_type = SCM_RIGHTS;
  h->cmsg_len = CMSG_LEN(sizeof(int));
  int one = fd;
  memcpy(CMSG_DATA(h), &one, sizeof one);
  ssize_t n = sendmsg(sock, &m, NISH_NOSIGNAL);
  return n < 0 ? nish_net_fail() : (int32_t)n;
}

/* `recvFd(sock, buf, off, len, fd)`: at most `len` bytes into `buf` from
   `off`, and the bytes read (0 at end of stream) or the failure. `fd[0]` is
   the first descriptor the message carried, or -1 when it carried none; every
   further one is closed before the answer, so a peer cannot make this process
   hold descriptors it never asked for (RT-37). A message carrying more than
   NISH_RECV_FDS has the rest dropped by the kernel (`MSG_CTRUNC`), and the
   bytes and the first descriptor are answered under the same rule. `len` 0 is
   -22, as `sendFd`'s is, and so is an empty `fd`, both before anything is
   read. The descriptor kept is close-on-exec: from the receive on Linux
   (`MSG_CMSG_CLOEXEC`), and from the `fcntl` after it on Darwin, where a child
   another thread spawns in between inherits it (RT-38); a Darwin `fcntl`
   that fails closes it and answers the failure, so no descriptor is handed
   out without the flag. It is not made
   non-blocking: its status flags are the open file's, which the sender
   shares. */
int32_t nish_recv_fd(int32_t sock, nish_array *buf, int64_t off, int64_t len, nish_array *fd) {
  if (len == 0 || fd->len < 1) return -22;
  int32_t *out = (int32_t *)fd->data;
  out[0] = -1;
  int32_t kind = nish_unix_only(sock);
  if (kind != 0) return kind;
  union {
    struct cmsghdr h;
    char room[CMSG_SPACE(NISH_RECV_FDS * sizeof(int))];
  } c;
  struct iovec v = {buf->data + off, (size_t)len};
  struct msghdr m;
  memset(&m, 0, sizeof m);
  m.msg_iov = &v;
  m.msg_iovlen = 1;
  m.msg_control = c.room;
  m.msg_controllen = sizeof c.room;
  ssize_t n = recvmsg(sock, &m, NISH_RECV_CLOEXEC);
  if (n < 0) return nish_net_fail();
  int32_t err = 0;
  int kept = 0;
  for (struct cmsghdr *h = CMSG_FIRSTHDR(&m); h; h = CMSG_NXTHDR(&m, h)) {
    if (h->cmsg_level != SOL_SOCKET || h->cmsg_type != SCM_RIGHTS) continue;
    /* Counted from the header, but never past the room the kernel filled:
       a truncated message's last header may claim more than arrived. */
    size_t room = (size_t)((char *)m.msg_control + m.msg_controllen - (char *)CMSG_DATA(h));
    size_t claim = h->cmsg_len > CMSG_LEN(0) ? h->cmsg_len - CMSG_LEN(0) : 0;
    size_t count = (claim < room ? claim : room) / sizeof(int);
    for (size_t k = 0; k < count; k++) {
      int got;
      memcpy(&got, CMSG_DATA(h) + k * sizeof(int), sizeof got);
      if (!kept) {
        kept = 1;
#if !defined(__linux__)
        if (fcntl(got, F_SETFD, FD_CLOEXEC) != 0) {
          err = nish_net_fail();
          close(got);
          continue;
        }
#endif
        out[0] = got;
      } else {
        close(got);
      }
    }
  }
  return err != 0 ? err : (int32_t)n;
}

/* `peerCredentials(fd, out)`: the process at the other end of a connected
   Unix socket, as `out[0..2]` = pid, uid, gid, and 0; an `out` shorter than
   three is -22 before anything is asked. The kernel recorded them when the
   connection was made (`connect`, or `socketpair` for a pair), so a peer that
   has since changed its uid, or passed the socket to another process, still
   reads as it was then (RT-39). A socket with no peer, listening or never
   connected, is -107 (ENOTCONN) on both: Linux's `SO_PEERCRED` would answer
   the listener's own credentials, or none, so `getpeername` is asked first;
   a peer that has since closed keeps its connect-time answer. Linux reads
   `SO_PEERCRED`. Darwin reads uid
   and gid from `getpeereid` and the pid from `LOCAL_PEERPID` where the SDK
   names it, else -1. */
int32_t nish_peer_credentials(int32_t fd, nish_array *out) {
  if (out->len < 3) return -22;
  int32_t kind = nish_unix_only(fd);
  if (kind != 0) return kind;
  int32_t *o = (int32_t *)out->data;
#if defined(__linux__)
  struct sockaddr_un a;
  socklen_t an = sizeof a;
  if (getpeername(fd, (struct sockaddr *)&a, &an) != 0) return nish_net_fail();
  struct ucred c;
  socklen_t n = sizeof c;
  if (getsockopt(fd, SOL_SOCKET, SO_PEERCRED, &c, &n) != 0) return nish_net_fail();
  o[0] = (int32_t)c.pid;
  o[1] = (int32_t)c.uid;
  o[2] = (int32_t)c.gid;
#else
  uid_t uid;
  gid_t gid;
  if (getpeereid(fd, &uid, &gid) != 0) return nish_net_fail();
  int32_t pid = -1;
#if defined(LOCAL_PEERPID)
  pid_t p;
  socklen_t n = sizeof p;
  if (getsockopt(fd, SOL_LOCAL, LOCAL_PEERPID, &p, &n) == 0) pid = (int32_t)p;
#endif
  o[0] = pid;
  o[1] = (int32_t)uid;
  o[2] = (int32_t)gid;
#endif
  return 0;
}
#endif
