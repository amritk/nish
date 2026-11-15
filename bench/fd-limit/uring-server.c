/* One process, one thread, N io_uring rings: the design WP63 measures
 * (docs/wp63-iouring-net.md). Every connection lives in a ring's registered
 * file table and never in the process's descriptor table, so the process can
 * hold more sockets than RLIMIT_NOFILE allows descriptors. A ring's table is
 * itself capped at RLIMIT_NOFILE slots (io_uring/rsrc.c, io_sqe_files_register),
 * so holding C connections takes ceil(C / limit) rings.
 *
 * Per ring: a sparse file table of `limit` slots (IORING_RSRC_REGISTER_SPARSE,
 * 5.19); a bounded set of single-shot accepts on the shared listener, each
 * allocating its own slot (IORING_FILE_INDEX_ALLOC, 5.19; ACCEPT_DEPTH says
 * why not multishot); one multishot recv per connection into a
 * provided-buffer ring (IORING_RECV_MULTISHOT, 6.0; IORING_REGISTER_PBUF_RING,
 * 5.19); sends on the fixed file whose success CQE is skipped
 * (IOSQE_CQE_SKIP_SUCCESS, 5.17); and SINGLE_ISSUER | DEFER_TASKRUN |
 * TASKRUN_FLAG (6.0, 6.1, 5.19). With more than one ring the thread
 * sleeps in epoll_wait on one eventfd per ring (IORING_REGISTER_EVENTFD); a
 * DEFER_TASKRUN ring signals its eventfd when work is queued for it
 * (io_uring.c, io_req_local_work_add). With one ring it sleeps in
 * io_uring_enter.
 *
 * Usage: uring-server <port> <rings>. Prints `listening <port>` when ready,
 * then once a second `live <n> fds <m> ring <a>/<b>/...` on stderr. */
#define _GNU_SOURCE
#include "common.h"

#include <arpa/inet.h>
#include <errno.h>
#include <linux/io_uring.h>
#include <netinet/in.h>
#include <signal.h>
#include <stdint.h>
#include <sys/epoll.h>
#include <sys/eventfd.h>
#include <sys/mman.h>
#include <sys/socket.h>
#include <sys/syscall.h>
#include <time.h>
#include <unistd.h>

#define SQ_ENTRIES 4096
#define CQ_ENTRIES 65536
#define BUF_COUNT 4096
#define BUF_SIZE 1024
#define BGID 1
#define MAX_RINGS 64
#define BATCH 16

/* Accepts in flight per ring. They are single-shot, and a ring never has more
 * in flight than it has free slots: an accept that finds the table full has
 * already taken the connection off the listener, and the kernel drops it
 * (io_uring/net.c, io_accept: io_fixed_fd_install fails and puts the file).
 * A multishot accept cannot be bounded that way, because it keeps accepting
 * while the listener's queue is non-empty (io_accept's `goto retry`), so one
 * burst overruns the table: measured, three connections of 78,000 lost. */
#define ACCEPT_DEPTH 32

enum { OP_ACCEPT = 1, OP_RECV = 2, OP_SEND = 3, OP_CLOSE = 4 };

struct ring {
  int fd, efd;
  unsigned *sq_head, *sq_tail, *sq_mask, *sq_array, *sq_flags;
  unsigned *cq_head, *cq_tail, *cq_mask;
  struct io_uring_sqe *sqes;
  struct io_uring_cqe *cqes;
  unsigned sq_local_tail, to_submit;
  struct io_uring_buf_ring *br;
  char *bufs;
  unsigned br_tail;
  long live, accepted, accepting;
};

static struct ring rings[MAX_RINGS];
static int nrings, listener;
static long slots;
static char batch[RESPONSE_LEN * BATCH];

static int enter(struct ring *r, unsigned submit, unsigned wait, unsigned flags) {
  int rc = (int)syscall(__NR_io_uring_enter, r->fd, submit, wait, flags, NULL, 0);
  return rc < 0 ? -errno : rc;
}

static void flush(struct ring *r) {
  while (r->to_submit) {
    int rc = enter(r, r->to_submit, 0, IORING_ENTER_GETEVENTS);
    if (rc < 0) {
      if (rc == -EINTR || rc == -EAGAIN || rc == -EBUSY) continue;
      fprintf(stderr, "io_uring_enter: %s\n", strerror(-rc));
      exit(1);
    }
    r->to_submit -= (unsigned)rc;
  }
}

static struct io_uring_sqe *sqe(struct ring *r) {
  unsigned head = __atomic_load_n(r->sq_head, __ATOMIC_ACQUIRE);
  if (r->sq_local_tail - head >= SQ_ENTRIES) flush(r);
  unsigned i = r->sq_local_tail & *r->sq_mask;
  struct io_uring_sqe *s = &r->sqes[i];
  memset(s, 0, sizeof *s);
  r->sq_array[i] = i;
  r->sq_local_tail++;
  __atomic_store_n(r->sq_tail, r->sq_local_tail, __ATOMIC_RELEASE);
  r->to_submit++;
  return s;
}

static int acceptor;

/* Keep min(ACCEPT_DEPTH, free slots) accepts in flight on the accepting ring,
 * and only there. Accepts on one listener are exclusive waiters, woken one per
 * arriving connection, so an accept that is only waiting never learns of
 * connections already queued: with every ring armed, a ring that filled took
 * the last wake-ups and the others slept while 38,000 connections sat in the
 * backlog. A fresh accept is tried at once, so moving the job to another ring
 * by submitting there drains what is queued. */
static void top_up_accepts(void) {
  struct ring *r = &rings[acceptor];
  if (r->live + r->accepting >= slots && r->accepting == 0) {
    for (int i = 1; i <= nrings; i++) {
      struct ring *q = &rings[(acceptor + i) % nrings];
      if (q->live < slots) {
        acceptor = (int)(q - rings);
        r = q;
        break;
      }
    }
  }
  while (r->accepting < ACCEPT_DEPTH && r->live + r->accepting < slots) {
    struct io_uring_sqe *s = sqe(r);
    s->opcode = IORING_OP_ACCEPT;
    s->fd = listener;
    s->file_index = IORING_FILE_INDEX_ALLOC;
    s->user_data = (uint64_t)OP_ACCEPT << 32;
    r->accepting++;
  }
}

static void arm_recv(struct ring *r, unsigned slot) {
  struct io_uring_sqe *s = sqe(r);
  s->opcode = IORING_OP_RECV;
  s->fd = (int)slot;
  s->flags = IOSQE_FIXED_FILE | IOSQE_BUFFER_SELECT;
  s->ioprio = IORING_RECV_MULTISHOT;
  s->buf_group = BGID;
  s->user_data = ((uint64_t)OP_RECV << 32) | slot;
}

static void close_slot(struct ring *r, unsigned slot) {
  struct io_uring_sqe *s = sqe(r);
  s->opcode = IORING_OP_CLOSE;
  s->file_index = slot + 1;
  s->flags = IOSQE_CQE_SKIP_SUCCESS;
  s->user_data = ((uint64_t)OP_CLOSE << 32) | slot;
  r->live--;
  top_up_accepts();
}

static void send_slot(struct ring *r, unsigned slot, int k) {
  while (k > 0) {
    int n = k > BATCH ? BATCH : k;
    struct io_uring_sqe *s = sqe(r);
    s->opcode = IORING_OP_SEND;
    s->fd = (int)slot;
    s->flags = IOSQE_FIXED_FILE | IOSQE_CQE_SKIP_SUCCESS;
    s->addr = (uint64_t)(uintptr_t)batch;
    s->len = (unsigned)(RESPONSE_LEN * (unsigned)n);
    s->msg_flags = MSG_NOSIGNAL;
    s->user_data = ((uint64_t)OP_SEND << 32) | slot;
    k -= n;
  }
}

static void recycle(struct ring *r, unsigned bid) {
  struct io_uring_buf *b = &r->br->bufs[r->br_tail & (BUF_COUNT - 1)];
  b->addr = (uint64_t)(uintptr_t)(r->bufs + (size_t)bid * BUF_SIZE);
  b->len = BUF_SIZE;
  b->bid = (uint16_t)bid;
  r->br_tail++;
  __atomic_store_n(&r->br->tail, (uint16_t)r->br_tail, __ATOMIC_RELEASE);
}

static void reap(struct ring *r) {
  for (;;) {
    unsigned head = *r->cq_head;
    unsigned tail = __atomic_load_n(r->cq_tail, __ATOMIC_ACQUIRE);
    if (head == tail) return;
    for (; head != tail; head++) {
      struct io_uring_cqe *c = &r->cqes[head & *r->cq_mask];
      unsigned op = (unsigned)(c->user_data >> 32);
      unsigned slot = (unsigned)c->user_data;
      int res = c->res;
      int more = (c->flags & IORING_CQE_F_MORE) != 0;
      switch (op) {
      case OP_ACCEPT:
        r->accepting--;
        if (res >= 0) {
          r->live++;
          r->accepted++;
          arm_recv(r, (unsigned)res);
        } else if (res != -EAGAIN && res != -EINTR && res != -ECONNABORTED) {
          fprintf(stderr, "accept: %s\n", strerror(-res));
        }
        top_up_accepts();
        break;
      case OP_RECV:
        if (res > 0) {
          unsigned bid = c->flags >> IORING_CQE_BUFFER_SHIFT;
          int k = count_requests(r->bufs + (size_t)bid * BUF_SIZE, res);
          recycle(r, bid);
          if (k > 0) send_slot(r, slot, k);
          if (!more) arm_recv(r, slot);
        } else if (res == -ENOBUFS) {
          if (!more) arm_recv(r, slot);
        } else {
          close_slot(r, slot);
        }
        break;
      case OP_SEND:
        /* Only a failed send posts a CQE; the recv side closes the slot. */
        break;
      case OP_CLOSE:
        break;
      }
    }
    __atomic_store_n(r->cq_head, head, __ATOMIC_RELEASE);
  }
}

/* Reap, submit what reaping queued, and go again while the kernel has work
 * left for this ring. A DEFER_TASKRUN ring runs at most 20 queued items per
 * io_uring_enter (io_uring.c, IO_LOCAL_TW_DEFAULT_MAX) and keeps the rest
 * without signalling its eventfd again; IORING_SETUP_TASKRUN_FLAG makes it
 * say so in IORING_SQ_TASKRUN (io_run_local_work_continue). A loop that
 * stopped at an empty CQ would leave that ring asleep until new work arrived:
 * measured, one ring of four sat with 20,000 connections unaccepted. */
static void service(struct ring *r) {
  for (;;) {
    reap(r);
    flush(r);
    if (__atomic_load_n(r->sq_flags, __ATOMIC_ACQUIRE) & IORING_SQ_TASKRUN) {
      enter(r, 0, 0, IORING_ENTER_GETEVENTS);
      continue;
    }
    if (*r->cq_head == __atomic_load_n(r->cq_tail, __ATOMIC_ACQUIRE)) return;
  }
}

static void setup_ring(struct ring *r) {
  struct io_uring_params p;
  memset(&p, 0, sizeof p);
  p.flags = IORING_SETUP_SINGLE_ISSUER | IORING_SETUP_DEFER_TASKRUN | IORING_SETUP_SUBMIT_ALL |
            IORING_SETUP_TASKRUN_FLAG | IORING_SETUP_CQSIZE;
  p.cq_entries = CQ_ENTRIES;
  r->fd = (int)syscall(__NR_io_uring_setup, SQ_ENTRIES, &p);
  if (r->fd < 0) {
    perror("io_uring_setup");
    exit(1);
  }
  size_t sq_sz = p.sq_off.array + p.sq_entries * sizeof(unsigned);
  size_t cq_sz = p.cq_off.cqes + p.cq_entries * sizeof(struct io_uring_cqe);
  if (cq_sz > sq_sz) sq_sz = cq_sz;
  char *sq = mmap(NULL, sq_sz, PROT_READ | PROT_WRITE, MAP_SHARED | MAP_POPULATE, r->fd, IORING_OFF_SQ_RING);
  if (sq == MAP_FAILED) {
    perror("mmap sq");
    exit(1);
  }
  r->sq_head = (unsigned *)(sq + p.sq_off.head);
  r->sq_tail = (unsigned *)(sq + p.sq_off.tail);
  r->sq_mask = (unsigned *)(sq + p.sq_off.ring_mask);
  r->sq_array = (unsigned *)(sq + p.sq_off.array);
  r->sq_flags = (unsigned *)(sq + p.sq_off.flags);
  r->cq_head = (unsigned *)(sq + p.cq_off.head);
  r->cq_tail = (unsigned *)(sq + p.cq_off.tail);
  r->cq_mask = (unsigned *)(sq + p.cq_off.ring_mask);
  r->cqes = (struct io_uring_cqe *)(sq + p.cq_off.cqes);
  r->sqes = mmap(NULL, p.sq_entries * sizeof(struct io_uring_sqe), PROT_READ | PROT_WRITE,
                 MAP_SHARED | MAP_POPULATE, r->fd, IORING_OFF_SQES);
  if (r->sqes == MAP_FAILED) {
    perror("mmap sqes");
    exit(1);
  }
  r->sq_local_tail = *r->sq_tail;

  struct io_uring_rsrc_register files;
  memset(&files, 0, sizeof files);
  files.nr = (unsigned)slots;
  files.flags = IORING_RSRC_REGISTER_SPARSE;
  if (syscall(__NR_io_uring_register, r->fd, IORING_REGISTER_FILES2, &files, sizeof files) < 0) {
    perror("IORING_REGISTER_FILES2");
    exit(1);
  }

  size_t br_sz = BUF_COUNT * sizeof(struct io_uring_buf);
  r->br = mmap(NULL, br_sz, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  r->bufs = mmap(NULL, (size_t)BUF_COUNT * BUF_SIZE, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  if (r->br == MAP_FAILED || r->bufs == MAP_FAILED) {
    perror("mmap buffers");
    exit(1);
  }
  struct io_uring_buf_reg reg;
  memset(&reg, 0, sizeof reg);
  reg.ring_addr = (uint64_t)(uintptr_t)r->br;
  reg.ring_entries = BUF_COUNT;
  reg.bgid = BGID;
  if (syscall(__NR_io_uring_register, r->fd, IORING_REGISTER_PBUF_RING, &reg, 1) < 0) {
    perror("IORING_REGISTER_PBUF_RING");
    exit(1);
  }
  for (unsigned i = 0; i < BUF_COUNT; i++) recycle(r, i);

  r->efd = -1;
  if (nrings > 1) {
    r->efd = eventfd(0, EFD_NONBLOCK | EFD_CLOEXEC);
    if (r->efd < 0 || syscall(__NR_io_uring_register, r->fd, IORING_REGISTER_EVENTFD, &r->efd, 1) < 0) {
      perror("IORING_REGISTER_EVENTFD");
      exit(1);
    }
  }
  top_up_accepts();
  flush(r);
}

static double now(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (double)ts.tv_sec + (double)ts.tv_nsec / 1e9;
}

static void report(void) {
  long live = 0;
  char per[1024];
  int at = 0;
  for (int i = 0; i < nrings; i++) {
    live += rings[i].live;
    at += snprintf(per + at, sizeof per - (size_t)at, "%s%ld", i ? "/" : "", rings[i].live);
    if (at >= (int)sizeof per - 16) break;
  }
  fprintf(stderr, "live %ld fds %ld ring %s\n", live, count_fds(), per);
}

int main(int argc, char **argv) {
  int port = argc > 1 ? atoi(argv[1]) : 8080;
  nrings = argc > 2 ? atoi(argv[2]) : 1;
  if (nrings < 1 || nrings > MAX_RINGS) {
    fprintf(stderr, "rings must be 1..%d\n", MAX_RINGS);
    return 2;
  }
  signal(SIGPIPE, SIG_IGN);
  slots = raise_nofile();
  for (int i = 0; i < BATCH; i++) memcpy(batch + (size_t)i * RESPONSE_LEN, RESPONSE, RESPONSE_LEN);

  listener = socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
  int one = 1;
  setsockopt(listener, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
  struct sockaddr_in a;
  memset(&a, 0, sizeof a);
  a.sin_family = AF_INET;
  a.sin_port = htons((uint16_t)port);
  a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  if (bind(listener, (struct sockaddr *)&a, sizeof a) != 0 || listen(listener, 65535) != 0) {
    perror("listen");
    return 1;
  }
  for (int i = 0; i < nrings; i++) setup_ring(&rings[i]);

  int ep = -1;
  if (nrings > 1) {
    ep = epoll_create1(EPOLL_CLOEXEC);
    for (int i = 0; i < nrings; i++) {
      struct epoll_event ev = {.events = EPOLLIN, .data.u32 = (uint32_t)i};
      epoll_ctl(ep, EPOLL_CTL_ADD, rings[i].efd, &ev);
    }
  }
  fprintf(stderr, "slots %ld per ring, %d rings\n", slots, nrings);
  printf("listening %d\n", port);
  fflush(stdout);

  double next = now() + 1;
  for (;;) {
    if (nrings == 1) {
      struct ring *r = &rings[0];
      int rc = enter(r, r->to_submit, 1, IORING_ENTER_GETEVENTS);
      if (rc >= 0) r->to_submit -= (unsigned)rc;
      service(r);
    } else {
      struct epoll_event evs[MAX_RINGS];
      int n = epoll_wait(ep, evs, MAX_RINGS, 1000);
      for (int i = 0; i < n; i++) {
        struct ring *r = &rings[evs[i].data.u32];
        uint64_t v;
        (void)!read(r->efd, &v, sizeof v);
        enter(r, 0, 0, IORING_ENTER_GETEVENTS);
        service(r);
        /* A close here may have moved the accepting ring. */
        if (rings[acceptor].to_submit) service(&rings[acceptor]);
      }
    }
    double t = now();
    if (t >= next) {
      report();
      next = t + 1;
    }
  }
}
