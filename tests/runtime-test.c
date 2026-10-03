/* Unit test for runtime/runtime.c: arena semantics, string handling, number
 * formatting (checked against what Node prints for `String(x)`), the random
 * generator, and file I/O. */
#include <assert.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

/* WP20 T0: the arena's storage class is part of the ABI, so this file spells it
 * the way runtime.c, nish.h and runtime-wasm.c do. Without the macro a
 * -DNISH_THREADS build would not link at all -- a non-TLS reference to a TLS
 * definition is an error, which is the property the threads section below is
 * really resting on. */
#ifdef NISH_THREADS
#define NISH_TLS _Thread_local
#else
#define NISH_TLS
#endif

typedef struct { uint64_t len; char data[]; } nish_str;
extern NISH_TLS struct nish_arena { char *buf; size_t off; size_t cap; void *chunks; } nish_arena;
void *nish_alloc_struct(size_t);
void nish_reset_arena(void);
void nish_free_arena(void);
uint64_t nish_arena_mark(void);
void nish_arena_release(uint64_t);
uint64_t nish_arena_used(void);
void *nish_arena_keep(uint64_t, void *);
nish_str *nish_str_new(const char *, uint64_t);
nish_str *nish_str_concat(const nish_str *, const nish_str *);
_Bool nish_str_eq(const nish_str *, const nish_str *);
uint64_t nish_str_len(const nish_str *);
nish_str *nish_str_from_i32(int32_t);
nish_str *nish_str_from_i64(int64_t);
nish_str *nish_str_from_f64(double);
int64_t nish_str_index_of(const nish_str *, const nish_str *);
double nish_random(void);
/* runtime-parallel.c. Declared here like every other symbol this file calls:
   the test compiles against the same private copy of the ABI the rest of it
   uses, so a drift between the two shows up as a link error. */
typedef void (*nish_par_body)(int64_t lo, int64_t hi, void *ctx);
int64_t nish_cpu_count(void);
void nish_parallel_range(nish_par_body body, void *ctx, int64_t len, int64_t grain);
nish_str *nish_read_file(const nish_str *);
void nish_write_file(const nish_str *, const nish_str *);
void nish_append_file(const nish_str *, const nish_str *);
/* runtime-host.c (WP34 N3). */
int32_t nish_signal_fd(void);
int32_t nish_read_signal(int32_t fd);

static void expect_str(const nish_str *s, const char *want, const char *what) {
  if (s->len != strlen(want) || memcmp(s->data, want, s->len) != 0 || s->data[s->len] != 0) {
    fprintf(stderr, "runtime_test: %s: expected \"%s\", got \"%.*s\"\n", what, want, (int)s->len, s->data);
    assert(0);
  }
}

static void expect_f64(double v, const char *want) { expect_str(nish_str_from_f64(v), want, want); }

static void expect_i64(int64_t got, int64_t want, const char *what) {
  if (got != want) {
    fprintf(stderr, "runtime_test: %s: expected %lld, got %lld\n", what, (long long)want, (long long)got);
    assert(0);
  }
}
/* WP4 */
typedef struct nish_array { uint64_t len; uint64_t cap; char *data; } nish_array;
void nish_array_grow(nish_array *, uint64_t);
nish_array *nish_alloc_array(uint64_t, uint64_t);
/* WP34 N5: runtime-net.c */
int32_t nish_net_address(nish_array *out, const nish_str *host, int32_t port);
int32_t nish_net_local_port(int32_t fd);
int32_t nish_tcp_listen(const nish_str *host, int32_t port, int32_t backlog);
int32_t nish_tcp_accept(int32_t fd, nish_array *peer);
int32_t nish_net_read(int32_t fd, nish_array *buf, int64_t off, int64_t len);
int32_t nish_net_write(int32_t fd, const nish_array *buf, int64_t off, int64_t len);
int32_t nish_net_shutdown(int32_t fd, int32_t how);
int32_t nish_net_close(int32_t fd);
int32_t nish_udp_bind(const nish_str *host, int32_t port, int32_t flags);
int32_t nish_udp_send_to(int32_t fd, const nish_array *buf, int64_t off, int64_t len, const nish_array *to,
                         int32_t segment, int32_t ecn);
int32_t nish_udp_recv_from(int32_t fd, nish_array *buf, int64_t off, int64_t len, nish_array *from,
                           nish_array *meta);
int32_t nish_poll_create(void);
int32_t nish_poll_add(int32_t loop, int32_t fd, int32_t events, int32_t token);
int32_t nish_poll_remove(int32_t loop, int32_t fd);
int32_t nish_poll_wait(int32_t loop, nish_array *ready, int32_t timeout_ms);
/* WP7: process.argv and string parsing */
extern nish_array *nish_argv;
void nish_argv_init(int32_t, char **);
double nish_parse_number(const nish_str *, int32_t);

static nish_str *lit(const char *s) { return nish_str_new(s, strlen(s)); }
/* Expected text is `node -p "String(<js expression>)"`; a mode-2 result is what `parseInt` sees before saturation. */
static void expect_parse(const char *input, int32_t mode, const char *want) {
  char what[64];
  snprintf(what, sizeof what, "parse(\"%s\", %d)", input, mode);
  expect_str(nish_str_from_f64(nish_parse_number(lit(input), mode)), want, what);
}

/* ---- WP20 T0: the thread-local arena -------------------------------------
 * Only compiled into the -DNISH_THREADS build, which is the build where
 * `nish_arena` and the RNG seed are `_Thread_local`. Everything asserted here
 * is deterministic: the worker runs to completion before the parent looks
 * again, so nothing depends on how the two threads interleave.
 *
 * The RNG is exercised but its *values* are not pinned. Both threads seed
 * lazily from `time(0)` and the pid, so two threads starting in the same second
 * start from the same seed — which makes "the streams are independent"
 * indistinguishable from "the streams are identical" without reaching into the
 * seed word, and would make any equality assertion here a test of the clock.
 * What the thread-local seed buys is that neither thread's draw can tear the
 * other's state; the range check is what this file can honestly say about it. */
/* The chunk table `test_parallel_common` fills, and the mutex that makes filling
   it from several chunks at once well defined. Declared before the tests and
   defined for both configurations so the sequential build compiles the same
   assertions rather than a second copy of them. */
#define NISH_PAR_TEST_MAX 64
#ifdef NISH_THREADS
#include <pthread.h>
static pthread_mutex_t par_lock = PTHREAD_MUTEX_INITIALIZER;
#define PAR_LOCK() pthread_mutex_lock(&par_lock)
#define PAR_UNLOCK() pthread_mutex_unlock(&par_lock)
#else
#define PAR_LOCK() ((void)0)
#define PAR_UNLOCK() ((void)0)
#endif
static void par_record_chunk(int64_t lo, int64_t hi);

/* ---- Parallel ranges (runtime-parallel.c) -----------------------------------
 *
 * Compiled in both configurations, because the entry point exists in both: with
 * `-DNISH_THREADS` the chunks run on their own threads and without it the whole
 * range runs on the calling one, and everything asserted here is true either
 * way. What only the threaded build can check is in `test_parallel_threads`.
 *
 * Every chunk writes only its own indices, which is the precondition the
 * partition exists to provide, so nothing below needs a lock to be
 * deterministic. */
#define PAR_N 10000
static int par_seen[PAR_N];
static int64_t par_chunks;
static int64_t par_lo_of_chunk[NISH_PAR_TEST_MAX];
static int64_t par_hi_of_chunk[NISH_PAR_TEST_MAX];

static void par_record_chunk(int64_t lo, int64_t hi) {
  PAR_LOCK();
  if (par_chunks < NISH_PAR_TEST_MAX) {
    par_lo_of_chunk[par_chunks] = lo;
    par_hi_of_chunk[par_chunks] = hi;
  }
  par_chunks++;
  PAR_UNLOCK();
}

static void par_count_body(int64_t lo, int64_t hi, void *ctx) {
  (void)ctx;
  for (int64_t i = lo; i < hi; i++) par_seen[i]++;
  /* The chunk table is the one thing here two chunks share, so it is the one
     thing that needs the lock. Under a sequential build there is no contention
     and the lock is still correct. */
  par_record_chunk(lo, hi);
}

static void test_parallel_common(void) {
  memset(par_seen, 0, sizeof par_seen);
  par_chunks = 0;
  nish_parallel_range(par_count_body, NULL, PAR_N, 1);
  /* Every index exactly once: a partition, not a cover and not a sample. */
  for (int i = 0; i < PAR_N; i++) assert(par_seen[i] == 1);
  assert(par_chunks >= 1);
  /* The chunks are contiguous, non-empty, and cover [0, PAR_N) with no gap and
     no overlap -- sorted by `lo`, since they are recorded in completion order. */
  int64_t n = par_chunks;
  for (int64_t i = 0; i < n; i++)
    for (int64_t j = i + 1; j < n; j++)
      if (par_lo_of_chunk[j] < par_lo_of_chunk[i]) {
        int64_t tl = par_lo_of_chunk[i], th = par_hi_of_chunk[i];
        par_lo_of_chunk[i] = par_lo_of_chunk[j];
        par_hi_of_chunk[i] = par_hi_of_chunk[j];
        par_lo_of_chunk[j] = tl;
        par_hi_of_chunk[j] = th;
      }
  assert(par_lo_of_chunk[0] == 0);
  assert(par_hi_of_chunk[n - 1] == PAR_N);
  int64_t longest = 0, shortest = PAR_N;
  for (int64_t i = 0; i < n; i++) {
    assert(par_hi_of_chunk[i] > par_lo_of_chunk[i]);
    if (i > 0) assert(par_lo_of_chunk[i] == par_hi_of_chunk[i - 1]);
    int64_t len = par_hi_of_chunk[i] - par_lo_of_chunk[i];
    if (len > longest) longest = len;
    if (len < shortest) shortest = len;
  }
  /* The remainder is spread one element at a time, so no chunk is more than one
     element longer than any other -- which is what keeps the last worker from
     being the one everybody waits for. */
  assert(longest - shortest <= 1);

  /* An empty or negative range runs the body zero times rather than once with
     an empty range, so a caller need not special-case it. */
  memset(par_seen, 0, sizeof par_seen);
  par_chunks = 0;
  nish_parallel_range(par_count_body, NULL, 0, 1);
  nish_parallel_range(par_count_body, NULL, -5, 1);
  assert(par_chunks == 0);

  /* A grain coarser than the range asks for one chunk, whatever the machine
     has: dividing four elements eight ways is all overhead. */
  memset(par_seen, 0, sizeof par_seen);
  par_chunks = 0;
  nish_parallel_range(par_count_body, NULL, 4, 1000);
  assert(par_chunks == 1);
  assert(par_lo_of_chunk[0] == 0 && par_hi_of_chunk[0] == 4);

  assert(nish_cpu_count() >= 1);
}

#ifdef NISH_THREADS
#include <pthread.h>

/* What the worker thread saw in its own arena, read by the parent after join. */
static struct {
  uint64_t used_at_entry;
  char *first;
  uint64_t used_after_two;
  uint64_t used_after_release;
  int random_in_range;
} worker;

static void *thread_body(void *unused) {
  (void)unused;
  /* A fresh thread starts with an empty arena however much the parent has
     bumped, because the arena it bumps is not the parent's. */
  worker.used_at_entry = nish_arena_used();
  worker.first = nish_alloc_struct(12);
  nish_alloc_struct(12);
  worker.used_after_two = nish_arena_used();
  /* WP20 §3.1: scopes are per-thread by construction, so a worker's release
     rewinds its own arena and cannot reach into the parent's. */
  uint64_t mark = nish_arena_mark();
  nish_alloc_struct(4096);
  nish_arena_release(mark);
  worker.used_after_release = nish_arena_used();
  worker.random_in_range = 1;
  for (int i = 0; i < 1000; i++) {
    double r = nish_random();
    if (!(r >= 0.0 && r < 1.0)) worker.random_in_range = 0;
  }
  /* The worker owns its chunks, so it frees them; the parent's are untouched. */
  nish_free_arena();
  return NULL;
}

/* What only the threaded build can check: that the range was actually divided,
   that each worker allocated in its own arena, and that a nested region does
   not multiply the thread count. */
static pthread_t par_tid[NISH_PAR_TEST_MAX];
static uint64_t par_used_at_entry[NISH_PAR_TEST_MAX];
static int64_t par_inner_chunks;

static void par_thread_body(int64_t lo, int64_t hi, void *ctx) {
  (void)ctx;
  /* Allocate before recording, so `used_at_entry` is read on a worker that has
     already touched its arena and the parent's total is still untouched. */
  uint64_t at_entry = nish_arena_used();
  char *block = nish_alloc_struct(64);
  block[0] = (char)(lo & 0x7f);
  PAR_LOCK();
  if (par_chunks < NISH_PAR_TEST_MAX) {
    par_lo_of_chunk[par_chunks] = lo;
    par_hi_of_chunk[par_chunks] = hi;
    par_tid[par_chunks] = pthread_self();
    par_used_at_entry[par_chunks] = at_entry;
  }
  par_chunks++;
  PAR_UNLOCK();
}

static void par_inner_body(int64_t lo, int64_t hi, void *ctx) {
  (void)lo;
  (void)hi;
  (void)ctx;
  PAR_LOCK();
  par_inner_chunks++;
  PAR_UNLOCK();
}

static void par_outer_body(int64_t lo, int64_t hi, void *ctx) {
  (void)ctx;
  /* A body that divides again. The guard is thread-local, so each of the outer
     chunks sees itself as already inside a region and the inner range comes
     back as exactly one chunk. */
  par_record_chunk(lo, hi);
  nish_parallel_range(par_inner_body, NULL, 1000, 1);
}

static void test_parallel_threads(void) {
  nish_free_arena();
  nish_str *parent = lit("parent string");
  char *parent_block = nish_alloc_struct(64);
  parent_block[0] = 'p';
  uint64_t used_before = nish_arena_used();

  par_chunks = 0;
  nish_parallel_range(par_thread_body, NULL, PAR_N, 1);
  int64_t n = par_chunks;
  assert(n >= 1 && n <= nish_cpu_count());
  /* On a machine with more than one core the range is actually divided, which
     is the whole point and the one thing a sequential build cannot assert. */
  if (nish_cpu_count() > 1) assert(n > 1);

  /* Chunk 0 runs on the calling thread, so exactly one chunk's thread id is
     this one: N-way parallelism costs N-1 spawns. */
  int64_t on_caller = 0;
  for (int64_t i = 0; i < n; i++)
    if (pthread_equal(par_tid[i], pthread_self())) on_caller++;
  assert(on_caller == 1);

  /* Every chunk but the caller's began with an empty arena, because the arena
     is per thread (WP20 T0) -- and the caller's began with what the parent had
     bumped, which is the asymmetry runtime-parallel.c documents rather than
     hides. */
  for (int64_t i = 0; i < n; i++) {
    if (pthread_equal(par_tid[i], pthread_self())) assert(par_used_at_entry[i] == used_before);
    else assert(par_used_at_entry[i] == 0);
  }

  /* The parent's arena came through with only its own chunk's allocation added,
     and its contents intact: every worker freed its own and reached none of
     the parent's. */
  assert(nish_arena_used() == used_before + 64);
  assert(parent_block[0] == 'p');
  expect_str(parent, "parent string", "the parent's string survives a parallel range");

  /* Nesting runs sequentially: one inner chunk per outer chunk, never
     cpu_count() of them, so the thread count does not multiply by depth. */
  par_chunks = 0;
  par_inner_chunks = 0;
  nish_parallel_range(par_outer_body, NULL, PAR_N, 1);
  /* One inner chunk per outer chunk, rather than cpu_count() of them each, so
     the thread count does not multiply by the nesting depth. */
  assert(par_chunks > 0);
  assert(par_inner_chunks == par_chunks);

  nish_free_arena();
}

static void test_threads(void) {
  nish_free_arena();
  nish_str *parent = lit("parent string");
  uint64_t used_before = nish_arena_used();
  char *parent_block = nish_alloc_struct(64);
  parent_block[0] = 'p';
  assert(used_before > 0);

  pthread_t t;
  assert(pthread_create(&t, NULL, thread_body, NULL) == 0);
  assert(pthread_join(t, NULL) == 0);

  assert(worker.used_at_entry == 0);   /* its own arena, not the parent's */
  assert(worker.used_after_two == 32); /* two 12-byte bumps, 8-byte rounded */
  assert(worker.used_after_release == 32);
  assert(worker.random_in_range);
  /* Disjoint storage: the worker never bumped a byte of the parent's chunk. */
  assert(worker.first != parent_block);
  /* And the parent's arena came through the join exactly as it was, contents
     included — which one shared arena would not have survived, because the
     worker released and then freed everything it could see. */
  assert(nish_arena_used() == used_before + 64);
  assert(parent_block[0] == 'p');
  expect_str(parent, "parent string", "the parent's string survives a worker thread");

  double r = nish_random();
  assert(r >= 0.0 && r < 1.0);
  nish_free_arena();
}
#endif

#ifdef NISH_THREADS
#include <fcntl.h>
#include <signal.h>

/* A thread that was running, with nothing blocked, before `nish_signal_fd()`
   was called: it waits in `read` on a pipe of its own until the test lets it
   go. */
static int host_gate[2];
static void *host_waiting_thread(void *unused) {
  (void)unused;
  char b;
  while (read(host_gate[0], &b, 1) < 0) {
  }
  return NULL;
}

/* WP34 N3, review R1-1: a signal that lands on a thread which was already
   running when the descriptor was made is still read back, and does not end
   the process. `pthread_kill` aims each signal at that thread, so the test
   does not depend on which thread the kernel would have picked. A `signalfd`
   with the signals blocked only in the calling thread fails here: the waiting
   thread takes SIGINT at its default action and the whole test exits 130. */
static void test_host_signal_threads(void) {
  assert(pipe(host_gate) == 0);
  pthread_t t;
  assert(pthread_create(&t, NULL, host_waiting_thread, NULL) == 0);
  int32_t fd = nish_signal_fd();
  assert(fd >= 0);
  assert(nish_signal_fd() == fd);
  /* R1-2: the pipe is close-on-exec, so a child spawned meanwhile does not
     inherit it; on Linux it is from the moment `pipe2` makes it. */
  assert((fcntl(fd, F_GETFD) & FD_CLOEXEC) != 0);
  assert(pthread_kill(t, SIGINT) == 0);
  expect_i64(nish_read_signal(fd), 2, "SIGINT on a thread started before signalFd");
  assert(pthread_kill(t, SIGTERM) == 0);
  expect_i64(nish_read_signal(fd), 15, "SIGTERM on a thread started before signalFd");
  assert(kill(getpid(), SIGINT) == 0);
  expect_i64(nish_read_signal(fd), 2, "SIGINT to the process");
  expect_i64(nish_read_signal(fd + 1), -1, "a descriptor that is not the signal descriptor");
  assert(write(host_gate[1], "x", 1) == 1);
  assert(pthread_join(t, NULL) == 0);
}
#endif

#include <arpa/inet.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <sys/socket.h>

/* WP34 N5, runtime-net.c: what the Node-driven echo in tests/run.js cannot
   see from outside the process. A listener and an accepted connection are
   both non-blocking and close-on-exec; the peer's address arrives in the
   18-byte form with the port the client was given; a read with nothing
   waiting is -11; and a write to a peer that has gone is -32 rather than a
   SIGPIPE that would end this test. */
static void test_net(void) {
  char space[18];
  nish_array peer = {18, 18, space};
  const nish_str *loopback = nish_str_new("127.0.0.1", 9);
  int32_t fd = nish_tcp_listen(loopback, 0, 4);
  assert(fd >= 0);
  assert((fcntl(fd, F_GETFD) & FD_CLOEXEC) != 0 && (fcntl(fd, F_GETFL) & O_NONBLOCK) != 0);
  expect_i64(nish_tcp_accept(fd, &peer), -11, "an accept with no connection waiting");

  int client = socket(AF_INET, SOCK_STREAM, 0);
  struct sockaddr_in to = {0};
  to.sin_family = AF_INET;
  to.sin_port = htons((uint16_t)nish_net_local_port(fd));
  to.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  assert(client >= 0 && connect(client, (struct sockaddr *)&to, sizeof to) == 0);
  struct sockaddr_in from;
  socklen_t n = sizeof from;
  assert(getsockname(client, (struct sockaddr *)&from, &n) == 0);

  int32_t conn = nish_tcp_accept(fd, &peer);
  assert(conn >= 0);
  assert((fcntl(conn, F_GETFD) & FD_CLOEXEC) != 0 && (fcntl(conn, F_GETFL) & O_NONBLOCK) != 0);
  static const unsigned char mapped[16] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff, 127, 0, 0, 1};
  assert(memcmp(space, mapped, 16) == 0);
  expect_i64(((unsigned char)space[16] << 8) | (unsigned char)space[17], ntohs(from.sin_port), "the peer's port");

  char bytes[4] = {'p', 'i', 'n', 'g'};
  nish_array buf = {4, 4, bytes};
  expect_i64(nish_net_read(conn, &buf, 0, 4), -11, "a read with nothing waiting");
  assert(write(client, "abc", 3) == 3);
  expect_i64(nish_net_read(conn, &buf, 1, 3), 3, "the three bytes the client sent");
  assert(memcmp(bytes, "pabc", 4) == 0);
  expect_i64(nish_net_write(conn, &buf, 0, 4), 4, "four bytes back");
  expect_i64(nish_net_shutdown(conn, 1), 0, "the write side shut");
  char back[8];
  expect_i64(read(client, back, sizeof back), 4, "the client reads what was written");
  expect_i64(read(client, back, sizeof back), 0, "and then the end of the stream");

  /* The client goes: the first write may still be accepted into the kernel's
     buffer, and a later one fails with EPIPE once the reset has arrived. */
  close(client);
  int32_t gone = 0;
  for (int i = 0; i < 1000 && gone >= 0; i++) {
    gone = nish_net_write(conn, &buf, 0, 4);
    if (gone == -11) gone = 0;
  }
  assert(gone == -32 || gone == -104);
  expect_i64(nish_net_close(conn), 0, "the connection closed");
  expect_i64(nish_net_close(conn), -9, "a descriptor closed twice");
  expect_i64(nish_net_close(fd), 0, "the listener closed");
}

/* The UDP half of runtime-net.c: a socket bound to 127.0.0.1 sends to itself,
   and on Linux one segmented send comes back from one GRO receive whole, with
   its segment size and the ECN bits it was sent with. */
static void test_udp(void) {
  const nish_str *loopback = nish_str_new("127.0.0.1", 9);
  int32_t fd = nish_udp_bind(loopback, 0, 2);
#if defined(__linux__)
  assert(fd >= 0);
  assert((fcntl(fd, F_GETFD) & FD_CLOEXEC) != 0 && (fcntl(fd, F_GETFL) & O_NONBLOCK) != 0);
  char space[18];
  nish_array to = {18, 18, space};
  expect_i64(nish_net_address(&to, loopback, nish_net_local_port(fd)), 0, "the socket's own address");
  static char payload[3000];
  for (int i = 0; i < 3000; i++) payload[i] = (char)(i % 251);
  nish_array data = {3000, 3000, payload};
  static char into[4096];
  nish_array buf = {4096, 4096, into};
  char who[18];
  nish_array from = {18, 18, who};
  int32_t words[2] = {-1, -1};
  nish_array meta = {2, 2, (char *)words};
  expect_i64(nish_udp_recv_from(fd, &buf, 0, 4096, &from, &meta), -11, "a receive with nothing waiting");
  expect_i64(nish_udp_send_to(fd, &data, 0, 3000, &to, 1000, 2), 3000, "one segmented send");
  int32_t got = -11;
  for (int i = 0; i < 1000000 && got == -11; i++) got = nish_udp_recv_from(fd, &buf, 0, 4096, &from, &meta);
  expect_i64(got, 3000, "the three segments in one receive");
  expect_i64(words[0], 1000, "the segment size");
  expect_i64(words[1], 2, "the ECN bits");
  assert(memcmp(into, payload, 3000) == 0 && memcmp(who, space, 18) == 0);
  nish_array word = {1, 1, (char *)words};
  expect_i64(nish_udp_recv_from(fd, &buf, 0, 4096, &from, &word), -22, "a one-word meta");
  expect_i64(nish_udp_send_to(fd, &data, 0, 3, &to, 0, 4), -22, "ECN bits past 3");
  expect_i64(nish_udp_bind(loopback, 0, 4), -22, "an unknown flag");
  expect_i64(nish_net_close(fd), 0, "the socket closed");
#else
  expect_i64(fd, -95, "UDP_GRO where there is none");
#endif
}

#include <signal.h>
#include <sys/time.h>
#include <time.h>

/* A signal that interrupts a wait and does nothing else. */
static void poll_interrupt(int sig) { (void)sig; }

/* The readiness loop of runtime-net.c: what `net_loop_calls` and the
   Node-driven `net_loop_two` cannot reach. The loop descriptor is
   close-on-exec; a negative token comes back as it went in; one wait reports
   at most 64 descriptors however long `ready` is, and the rest stay ready for
   the next; a `ready` shorter than 2 is -22; and a signal that interrupts a
   wait answers 0 at once rather than waiting out the timeout. */
static void test_poll(void) {
  int32_t loop = nish_poll_create();
  assert(loop >= 0);
  assert((fcntl(loop, F_GETFD) & FD_CLOEXEC) != 0);
  const nish_str *loopback = nish_str_new("127.0.0.1", 9);
  enum { MANY = 70 };
  int32_t fds[MANY];
  for (int i = 0; i < MANY; i++) {
    fds[i] = nish_udp_bind(loopback, 0, 0);
    assert(fds[i] >= 0);
    expect_i64(nish_poll_add(loop, fds[i], 2, -1000 - i), 0, "a writable socket watched");
  }
  static int32_t pairs[200];
  nish_array ready = {200, 200, (char *)pairs};
  expect_i64(nish_poll_wait(loop, &ready, 0), 64, "one wait reports at most 64");
  for (int i = 0; i < 64; i++) {
    int32_t token = pairs[2 * i];
    assert(token <= -1000 && token > -1000 - MANY && pairs[2 * i + 1] == 2);
  }
  expect_i64(nish_poll_wait(loop, &ready, 0), 64, "and they are still ready at the next");
  nish_array one = {1, 1, (char *)pairs};
  expect_i64(nish_poll_wait(loop, &one, 0), -22, "a ready array of one number");
  for (int i = 0; i < MANY; i++) {
    expect_i64(nish_poll_remove(loop, fds[i]), 0, "a socket no longer watched");
    nish_net_close(fds[i]);
  }

  /* One SIGALRM 20 ms from now, into a ten-second wait on nothing: 0, and
     long before the timeout. A finite timeout, so a signal that arrived
     before the wait began costs ten seconds and a failure, never a hang. */
  signal(SIGALRM, poll_interrupt);
  time_t started = time(NULL);
  struct itimerval once = {{0, 0}, {0, 20000}};
  assert(setitimer(ITIMER_REAL, &once, NULL) == 0);
  expect_i64(nish_poll_wait(loop, &ready, 10000), 0, "a wait a signal interrupts");
  assert(time(NULL) - started < 5);
  signal(SIGALRM, SIG_DFL);
  expect_i64(nish_net_close(loop), 0, "the loop closed");
}

/* ---- The security audit (docs/security/runtime.md) ---------------------
 * One check per finding the audit fixed and per property it pinned. Each
 * names its finding, and a failed one says what it saw rather than stopping
 * the run, so a run against the old runtime lists every finding at once; the
 * last line of `test_security` turns any failure into the assertion the rest
 * of this file uses. Everything a check would do to this process for good --
 * exit, allocate gigabytes, overwrite a file -- happens in a child. */
#include <dirent.h>
#include <stdlib.h>
#include <sys/stat.h>

/* POSIX, and declared by <unistd.h> only under a feature macro this file does
   not define: -std=c11 alone is strict ISO C. */
int ftruncate(int, off_t);
int symlink(const char *, const char *);

nish_str *nish_read_file_or_null(const nish_str *);
nish_array *nish_read_file_bytes(const nish_str *);
nish_array *nish_readdir(const nish_str *);
_Bool nish_is_dir(const nish_str *);
_Bool nish_mkdir(const nish_str *);
nish_str *nish_getenv(const nish_str *);
nish_str *nish_realpath(const nish_str *);
int32_t nish_spawn(const nish_array *);
int32_t nish_spawn_to(const nish_array *, const nish_str *, const nish_str *);
double nish_stat_mtime(const nish_str *);
void nish_random_fill(nish_array *);
int64_t nish_lstat_owner_mode(const nish_str *);
int64_t nish_euid(void);
_Bool nish_is_executable(const nish_str *);

#include <sys/mman.h>

/* The longest string or array the runtime may make, and a size every page
   size divides (4 KiB on Linux x86-64, 16 KiB on Darwin arm64, 64 KiB on some
   arm64 Linux). */
#define SEC_MAX 2147483647u
#define SEC_PAGE 65536u

/* Address space for the checks at exactly SEC_MAX, which must get past each
   limit without two gigabytes ever being resident. A sparse file is mapped
   whole with no access, private, so nothing is committed and nothing is
   written back: 4 GiB of address space in two halves, each of one
   read-write page followed by pages that fault. The first half's page holds
   a string header whose bytes start in the faulting pages; the second half
   is where the check points the arena. A fault in a child that has got past
   the limit lands in `sec_fault`, which answers 42 if the arena handed out
   exactly the block that length needs. */
#define SEC_HALF ((uint64_t)SEC_MAX + 1 + 2 * SEC_PAGE)
static char *sec_space;
static uint64_t sec_fault_off;

static void sec_fault(int sig) {
  (void)sig;
  _exit(nish_arena.off == sec_fault_off ? 42 : 43);
}

static int sec_reserve(const char *path) {
  int fd = open(path, O_RDWR | O_CREAT | O_TRUNC, 0644);
  int ok = fd >= 0 && ftruncate(fd, (off_t)(2 * SEC_HALF)) == 0;
  if (ok) sec_space = mmap(NULL, 2 * SEC_HALF, PROT_NONE, MAP_PRIVATE, fd, 0);
  if (fd >= 0) close(fd);
  unlink(path);
  return ok && sec_space != MAP_FAILED && mprotect(sec_space, SEC_PAGE, PROT_READ | PROT_WRITE) == 0 &&
         mprotect(sec_space + SEC_HALF, SEC_PAGE, PROT_READ | PROT_WRITE) == 0;
}

/* In a child: the arena is the second half from `at` bytes in, and a fault is
   `sec_fault`'s to answer. */
static void sec_arena_at(uint64_t at, uint64_t fault_off) {
  nish_arena.buf = sec_space + SEC_HALF + at;
  nish_arena.off = 0;
  nish_arena.cap = SEC_HALF - at;
  nish_arena.chunks = NULL;
  sec_fault_off = fault_off;
  signal(SIGSEGV, sec_fault);
#ifdef SIGBUS
  signal(SIGBUS, sec_fault);
#endif
}

static int sec_failed;

static void sec_check(int ok, const char *finding, const char *what) {
  if (!ok) {
    fprintf(stderr, "runtime_test: %s: %s\n", finding, what);
    sec_failed++;
  }
}

/* The status a child left: its exit code, 128 + n for signal n. */
static int sec_status(pid_t child) {
  int status = 0;
  waitpid(child, &status, 0);
  return WIFSIGNALED(status) ? 128 + WTERMSIG(status) : WEXITSTATUS(status);
}

static int sec_file_is(const char *path, const char *want) {
  nish_str *got = nish_read_file_or_null(lit(path));
  return got && got->len == strlen(want) && memcmp(got->data, want, got->len) == 0;
}

/* `strcmp`, counted while `sec_counting` is set. The definition here is the
   one the link resolves runtime-os.c's calls to, which is the only way to see
   how many compares `nish_readdir` makes without a hook in the runtime. */
static int sec_counting;
static uint64_t sec_compares;
int strcmp(const char *a, const char *b) {
  if (sec_counting) sec_compares++;
  const unsigned char *p = (const unsigned char *)a, *q = (const unsigned char *)b;
  while (*p && *p == *q) p++, q++;
  return *p - *q;
}

/* A few kilobytes of stack set to 0xA5, so that whatever the next call leaves
   unwritten in its frame reads back as that and not as a lucky zero. */
static void sec_dirty_stack(void) {
  volatile unsigned char junk[8192];
  for (size_t i = 0; i < sizeof junk; i++) junk[i] = 0xA5;
}

/* RT-10 to RT-13 each need a system call to misbehave on cue: a write that
   takes only part of what it was given, a call that a signal interrupts
   before it moves a byte, a second thread that makes the signal pipe first.
   None of those can be made to happen on time from outside the process, so,
   as with `strcmp` above, the definitions below are the ones the link
   resolves the runtime's calls to. Until a check arms them they do the real
   work through a neighbouring call (`writev`, `lseek` and `read`, `pipe` and
   `fcntl`), so the rest of this file sees the system calls it always did. */
#include <errno.h>
#include <sys/uio.h>

void nish_write(const nish_str *, int32_t, _Bool);

static size_t sec_write_max;   /* nonzero: no write takes more bytes than this */
static int sec_write_eintr;    /* writes left to fail with EINTR */
static int sec_pread_eintr;    /* preads left to fail with EINTR */
static int sec_watch;          /* record the descriptor flags of each call */
static int sec_cloexec = -1;   /* FD_CLOEXEC of the last descriptor recorded */

ssize_t write(int fd, const void *buf, size_t n) {
  if (sec_watch) sec_cloexec = fcntl(fd, F_GETFD) & FD_CLOEXEC;
  if (sec_write_eintr > 0) {
    sec_write_eintr--;
    errno = EINTR;
    return -1;
  }
  struct iovec v = {(void *)buf, sec_write_max && n > sec_write_max ? sec_write_max : n};
  return writev(fd, &v, 1);
}

ssize_t pread(int fd, void *buf, size_t n, off_t at) {
  if (sec_watch) sec_cloexec = fcntl(fd, F_GETFD) & FD_CLOEXEC;
  if (sec_pread_eintr > 0) {
    sec_pread_eintr--;
    errno = EINTR;
    return -1;
  }
  return lseek(fd, at, SEEK_SET) < 0 ? -1 : read(fd, buf, n);
}

/* RT-10: armed, the next `pipe2` lets a whole other first `signalFd()` run
   to completion before it returns, which is the interleaving two threads
   reach only by luck. Linux only, because that is where the runtime makes the
   pipe with `pipe2`. */
#ifdef __linux__
#ifndef O_CLOEXEC
#define O_CLOEXEC 02000000 /* <fcntl.h> spells it only above strict C11 */
#endif
static int sec_race;          /* armed for the next pipe2 */
static int sec_race_pipe[2];  /* the ends the interrupted call made */
static int32_t sec_race_first; /* what the call that ran in between answered */
int pipe2(int p[2], int flags) {
  if (pipe(p) != 0) return -1;
  for (int i = 0; i < 2; i++) {
    if (flags & O_CLOEXEC) fcntl(p[i], F_SETFD, FD_CLOEXEC);
    if (flags & O_NONBLOCK) fcntl(p[i], F_SETFL, O_NONBLOCK);
  }
  if (sec_race) {
    sec_race = 0;
    sec_race_pipe[0] = p[0];
    sec_race_pipe[1] = p[1];
    sec_race_first = nish_signal_fd();
  }
  return 0;
}
#endif

static int32_t sec_recv_from(int fd, nish_array *from) {
  static char into[16];
  nish_array buf = {16, 16, into};
  int32_t words[2];
  nish_array meta = {2, 2, (char *)words};
  return nish_udp_recv_from(fd, &buf, 0, 16, from, &meta);
}

#ifdef NISH_THREADS
static int64_t sec_par_calls;
static void sec_par_body(int64_t lo, int64_t hi, void *ctx) {
  (void)lo;
  (void)hi;
  (void)ctx;
  PAR_LOCK();
  sec_par_calls++;
  PAR_UNLOCK();
}
#endif

static void test_security(void) {
  const char *dir = "build/test/rt_sec";
  char path[256];
  mkdir("build", 0777);
  mkdir("build/test", 0777);
  mkdir(dir, 0777);

  /* RT-1: a file of 2^31 bytes (sparse, so it costs no disk) is unreadable:
     null from the two readers that answer null, and an exit from the one
     that exits. Under i32 mode its length would read back as -2^31. */
  snprintf(path, sizeof path, "%s/big.bin", dir);
  int big = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0644);
  sec_check(big >= 0 && ftruncate(big, 2147483648LL) == 0, "RT-1", "a sparse 2^31-byte file could not be made");
  close(big);
  pid_t child = fork();
  if (child == 0) _exit(nish_read_file_or_null(lit(path)) == NULL ? 0 : 3);
  sec_check(sec_status(child) == 0, "RT-1", "readFileSyncOrNull of a 2^31-byte file was not null");
  child = fork();
  if (child == 0) _exit(nish_read_file_bytes(lit(path)) == NULL ? 0 : 3);
  sec_check(sec_status(child) == 0, "RT-1", "readFileBytesSync of a 2^31-byte file was not null");
  child = fork();
  if (child == 0) {
    close(2);
    nish_read_file(lit(path));
    _exit(3);
  }
  sec_check(sec_status(child) == 1, "RT-1", "readFileSync of a 2^31-byte file did not exit 1");
  unlink(path);

  /* RT-2: no string past 2^31 - 1 bytes. The header says 2^31 - 1 and the
     bytes behind it are eight, so the old concatenation copied two gigabytes
     out of this file's static data; the check is made before anything is
     read. A small concatenation is the strings block's, in main. */
  static struct { uint64_t len; char data[8]; } longest = {2147483647u, ""};
  child = fork();
  if (child == 0) {
    close(2);
    nish_str_concat((const nish_str *)&longest, lit("x"));
    _exit(3);
  }
  sec_check(sec_status(child) == 1, "RT-2", "a + b past 2^31 - 1 bytes was not refused");

  /* RT-7 (native half): the host entry refuses a length an array cannot have,
     before `len * elem_size` can wrap: 2^61 eight-byte elements wrapped to an
     empty block behind a header claiming 2^61. */
  uint64_t lengths[2] = {2147483648u, (uint64_t)1 << 61};
  for (int i = 0; i < 2; i++) {
    child = fork();
    if (child == 0) {
      close(2);
      nish_alloc_array(8, lengths[i]);
      _exit(3);
    }
    sec_check(sec_status(child) == 1, "RT-7", "nish_alloc_array of a length past 2^31 - 1 was not refused");
  }

  /* RT-1, RT-2 and RT-7 at exactly 2^31 - 1, which each must still allow:
     the checks above would pass against a limit one too low. Each child
     points its arena at `sec_space`, so getting past the limit costs address
     space and not memory. */
  snprintf(path, sizeof path, "%s/space.bin", dir);
  sec_check(sec_reserve(path), "RT-1", "4 GiB of address space could not be reserved");

  /* A u8[] of 2^31 - 1 elements from the host entry: the header in the
     read-write page, the elements never touched. */
  child = fork();
  if (child == 0) {
    close(2);
    sec_arena_at(0, 0);
    nish_array *a = nish_alloc_array(1, SEC_MAX);
    _exit(a->len == SEC_MAX && a->cap == SEC_MAX && a->data == sec_space + SEC_HALF + 24 ? 0 : 3);
  }
  sec_check(sec_status(child) == 0, "RT-7", "nish_alloc_array of exactly 2^31 - 1 elements was refused");

  /* `a + b` of exactly 2^31 - 1 bytes: `a` is 2^31 - 2 bytes that start in
     the faulting pages of the first half, so the copy faults on its first
     read, after the limit and with the whole result allocated. */
  child = fork();
  if (child == 0) {
    close(2);
    nish_str *x = lit("x");
    nish_str *a = (nish_str *)(sec_space + SEC_PAGE - 8);
    a->len = SEC_MAX - 1;
    sec_arena_at(0, 8 + (uint64_t)SEC_MAX + 1);
    nish_str_concat(a, x);
    _exit(3);
  }
  sec_check(sec_status(child) == 42, "RT-2", "a + b of exactly 2^31 - 1 bytes was refused");

  /* A file of exactly 2^31 - 1 bytes, sparse. The arena starts eight bytes
     short of the faulting pages, so the header is written, `pread` answers
     EFAULT without a byte, and the NUL after the bytes read faults: after
     the limit, with the whole block allocated. Refused, the reader answers
     null and the child exits 0. */
  snprintf(path, sizeof path, "%s/longest.bin", dir);
  big = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0644);
  sec_check(big >= 0 && ftruncate(big, SEC_MAX) == 0, "RT-1", "a sparse (2^31 - 1)-byte file could not be made");
  close(big);
  child = fork();
  if (child == 0) {
    close(2);
    nish_str *name = lit(path);
    sec_arena_at(SEC_PAGE - 8, 8 + (uint64_t)SEC_MAX + 1);
    _exit(nish_read_file_or_null(name) == NULL ? 0 : 3);
  }
  sec_check(sec_status(child) == 42, "RT-1", "readFileSyncOrNull of exactly 2^31 - 1 bytes was refused");
  unlink(path);
  munmap(sec_space, 2 * SEC_HALF);

  /* RT-3: a NUL inside a path, a name or an argument is refused, never cut
     short at: every one of these names something real before its NUL. */
  snprintf(path, sizeof path, "%s/real.txt", dir);
  nish_write_file(lit(path), lit("real"));
  size_t n = strlen(path);
  memcpy(path + n, "\0.png", 6);
  nish_str *nul = nish_str_new(path, n + 5);
  sec_check(nish_read_file_or_null(nul) == NULL, "RT-3", "readFileSyncOrNull read the file before the NUL");
  sec_check(nish_read_file_bytes(nul) == NULL, "RT-3", "readFileBytesSync read the file before the NUL");
  sec_check(isnan(nish_stat_mtime(nul)), "RT-3", "statMtimeSync answered for the file before the NUL");
  nish_str *nul_dir = nish_str_new("build\0x", 7);
  sec_check(!nish_is_dir(nul_dir), "RT-3", "isDirectorySync answered for the directory before the NUL");
  sec_check(!nish_mkdir(nul_dir), "RT-3", "mkdirSync answered for the directory before the NUL");
  sec_check(nish_readdir(nul_dir) == NULL, "RT-3", "readdirSync listed the directory before the NUL");
  sec_check(nish_realpath(nul_dir) == NULL, "RT-3", "realpathSync resolved the path before the NUL");
  sec_check(nish_getenv(nish_str_new("PATH\0X", 6)) == NULL, "RT-3", "getenv read the variable before the NUL");
  nish_str *true_nul = nish_str_new("true\0x", 6);
  nish_array argv1 = {1, 1, (char *)&true_nul};
  sec_check(nish_spawn(&argv1) == -1, "RT-3", "spawnSync ran the command before the NUL");
  nish_str *args[2] = {lit("true"), nish_str_new("a\0b", 3)};
  nish_array argv2 = {2, 2, (char *)args};
  sec_check(nish_spawn(&argv2) == -1, "RT-3", "spawnSync ran an argument cut at its NUL");
  nish_str *true_only = lit("true");
  nish_array argv3 = {1, 1, (char *)&true_only};
  snprintf(path, sizeof path, "%s/captured", dir);
  unlink(path);
  n = strlen(path);
  memcpy(path + n, "\0.log", 6);
  sec_check(nish_spawn_to(&argv3, nish_str_new(path, n + 5), lit("")) == -1, "RT-3",
            "spawnSyncTo wrote stdout to the path before the NUL");
  sec_check(access(path, F_OK) != 0, "RT-3", "spawnSyncTo created the file before the NUL");
  child = fork();
  if (child == 0) {
    close(2);
    nish_write_file(nish_str_new(path, n + 5), lit("written"));
    _exit(3);
  }
  sec_check(sec_status(child) == 1 && access(path, F_OK) != 0, "RT-3", "writeFileSync wrote the file before the NUL");
  sec_check(nish_spawn(&argv3) == 0, "RT-3", "spawnSync of a plain `true` stopped working");
  sec_check(nish_lstat_owner_mode(nul) == -1 && !nish_is_executable(nish_str_new("/bin/sh\0x", 9)), "RT-3",
            "the RT-9 primitives answered for the path before the NUL");

  /* RT-4: a symbolic link as the last component is refused by both writers and
     by spawnSyncTo, and the file it names keeps its bytes. A link to a
     directory on the way is still followed. */
  char target[256], link_path[256];
  snprintf(target, sizeof target, "%s/target.txt", dir);
  snprintf(link_path, sizeof link_path, "%s/planted.ll", dir);
  nish_write_file(lit(target), lit("keep"));
  unlink(link_path);
  sec_check(symlink("target.txt", link_path) == 0, "RT-4", "the symbolic link could not be made");
  for (int append = 0; append < 2; append++) {
    child = fork();
    if (child == 0) {
      close(2);
      if (append) {
        nish_append_file(lit(link_path), lit(" and more"));
      } else {
        nish_write_file(lit(link_path), lit("overwritten"));
      }
      _exit(3);
    }
    sec_check(sec_status(child) == 1, "RT-4",
              append ? "appendFileSync followed a link" : "writeFileSync followed a link");
  }
  sec_check(nish_spawn_to(&argv3, lit(link_path), lit("")) == -1, "RT-4", "spawnSyncTo opened stdout through a link");
  sec_check(sec_file_is(target, "keep"), "RT-4", "the file behind the link was changed");
  sec_check(sec_file_is(link_path, "keep"), "RT-4", "reading through a link stopped working");
  snprintf(link_path, sizeof link_path, "%s/via", dir);
  unlink(link_path);
  sec_check(symlink(".", link_path) == 0, "RT-4", "the directory link could not be made");
  snprintf(path, sizeof path, "%s/via/through.txt", dir);
  nish_write_file(lit(path), lit("through"));
  snprintf(path, sizeof path, "%s/through.txt", dir);
  sec_check(sec_file_is(path, "through"), "RT-4", "a write through a linked directory did not land");

  /* RT-9: `lstat` answers for the link itself, owned by this user. */
  int64_t om = nish_lstat_owner_mode(lit(link_path));
  sec_check(om != -1 && S_ISLNK((mode_t)(om & 0xffffffff)) && (om >> 32) == nish_euid(), "RT-9",
            "nish_lstat_owner_mode did not describe the link");
  sec_check(nish_lstat_owner_mode(lit("build/test/rt_sec/missing")) == -1, "RT-9", "a missing path was not -1");
  sec_check(nish_is_executable(lit("/bin/sh")) && !nish_is_executable(lit(target)), "RT-9",
            "nish_is_executable gave the wrong answer");

  /* Creation modes, pinned: 0644 for a written file and a captured stream,
     0777 for a directory, both under the umask, as Node's defaults are or
     tighter. */
  mode_t old_mask = umask(022);
  snprintf(path, sizeof path, "%s/mode.txt", dir);
  unlink(path);
  nish_write_file(lit(path), lit("m"));
  struct stat st;
  sec_check(stat(path, &st) == 0 && (st.st_mode & 0777) == 0644, "modes", "writeFileSync did not create 0644");
  unlink(path);
  sec_check(nish_spawn_to(&argv3, lit(path), lit("")) == 0 && stat(path, &st) == 0 && (st.st_mode & 0777) == 0644,
            "modes", "spawnSyncTo did not create 0644");
  snprintf(path, sizeof path, "%s/sub", dir);
  rmdir(path);
  sec_check(nish_mkdir(lit(path)) && stat(path, &st) == 0 && (st.st_mode & 0777) == 0755, "modes",
            "mkdirSync did not create 0777 & ~umask");
  umask(old_mask);

  /* RT-5: listing 3,000 names takes at most 2 n (log2 n + 1) compares, under
     78,000 (60,266 measured), where the insertion sort took n^2 / 4, 2,229,361
     measured, for names in no order. The names are made in a scrambled order so that no file system's
     own order happens to be sorted. */
  enum { NAMES = 3000 };
  snprintf(path, sizeof path, "%s/many", dir);
  mkdir(path, 0777);
  for (int i = 0; i < NAMES; i++) {
    snprintf(path, sizeof path, "%s/many/f%05d", dir, (i * 7919) % NAMES);
    close(open(path, O_WRONLY | O_CREAT, 0644));
  }
  snprintf(path, sizeof path, "%s/many", dir);
  sec_compares = 0;
  sec_counting = 1;
  nish_array *names = nish_readdir(lit(path));
  sec_counting = 0;
  sec_check(names != NULL && names->len == NAMES, "RT-5", "readdirSync did not list every name");
  int sorted = names != NULL;
  for (uint64_t i = 0; sorted && i < names->len; i++) {
    char want[8];
    snprintf(want, sizeof want, "f%05d", (int)i);
    sorted = strcmp(((nish_str **)names->data)[i]->data, want) == 0;
  }
  sec_check(sorted, "RT-5", "readdirSync is not sorted by bytes");
  if (sec_compares > 2 * NAMES * 13) {
    fprintf(stderr, "runtime_test: RT-5: %llu compares to sort %d names\n", (unsigned long long)sec_compares, NAMES);
    sec_failed++;
  }
  for (int i = 0; i < NAMES; i++) {
    snprintf(path, sizeof path, "%s/many/f%05d", dir, i);
    unlink(path);
  }
  for (uint64_t k = 0; k < 4; k++) {
    /* The edges of the heap: no name, one, two and three. */
    snprintf(path, sizeof path, "%s/few", dir);
    mkdir(path, 0777);
    for (uint64_t i = 0; i < k; i++) {
      snprintf(path, sizeof path, "%s/few/%c", dir, (char)('c' - i));
      close(open(path, O_WRONLY | O_CREAT, 0644));
    }
    snprintf(path, sizeof path, "%s/few", dir);
    names = nish_readdir(lit(path));
    int ok = names != NULL && names->len == k;
    for (uint64_t i = 0; ok && i < k; i++) ok = ((nish_str **)names->data)[i]->data[0] == (char)('c' - k + 1 + i);
    sec_check(ok, "RT-5", "a listing of three names or fewer is not sorted");
    for (uint64_t i = 0; i < k; i++) {
      snprintf(path, sizeof path, "%s/few/%c", dir, (char)('c' - i));
      unlink(path);
    }
  }

  /* RT-6: a receive on a socket that reports no sender (here a Unix datagram
     pair) writes eighteen zeros, not the stack bytes the address was never
     given. */
  int pair[2];
  sec_check(socketpair(AF_UNIX, SOCK_DGRAM, 0, pair) == 0, "RT-6", "no socket pair");
  sec_check(write(pair[1], "hi", 2) == 2, "RT-6", "the datagram was not sent");
  unsigned char who[18];
  memset(who, 0xEE, sizeof who);
  nish_array from = {18, 18, (char *)who};
  sec_dirty_stack();
  int32_t got = sec_recv_from(pair[0], &from);
  static const unsigned char zeros[18];
  sec_check(got == 2, "RT-6", "the datagram was not received");
  sec_check(memcmp(who, zeros, sizeof who) == 0, "RT-6", "the sender's address is not all zeros");
  close(pair[0]);
  close(pair[1]);

  /* `crypto.getRandomValues`, pinned: the limit is 65,536 bytes, and a call
     at the limit fills every byte (a zero run of 64 bytes from the kernel's
     CSPRNG is not going to happen). */
  static unsigned char entropy[65537];
  nish_array pool = {65536, 65536, (char *)entropy};
  nish_random_fill(&pool);
  int zero_run = 0, longest_run = 0;
  for (int i = 0; i < 65536; i++) {
    zero_run = entropy[i] ? 0 : zero_run + 1;
    if (zero_run > longest_run) longest_run = zero_run;
  }
  sec_check(longest_run < 64, "entropy", "getRandomValues left a run of zeros");
  child = fork();
  if (child == 0) {
    close(2);
    pool.len = 65537;
    nish_random_fill(&pool);
    _exit(3);
  }
  sec_check(sec_status(child) == 1, "entropy", "getRandomValues of 65,537 bytes was not refused");

  /* The number formatters' buffers, pinned at their widest: 25 bytes for a
     double, 20 digits and a sign for an i64. */
  expect_f64(-1.7976931348623157e308, "-1.7976931348623157e+308");
  expect_f64(-2.2250738585072014e-308, "-2.2250738585072014e-308");
  expect_f64(-0.0000012345678901234567, "-0.0000012345678901234567");
  expect_f64(-123456789012345680000.0, "-123456789012345680000");
  expect_f64(-1.2345678901234567e21, "-1.2345678901234568e+21");

  /* RT-11: a write that takes three bytes at a time still delivers the
     whole line. One `write` that ignored the count sent "hel" and the
     newline. */
  int out[2];
  sec_check(pipe(out) == 0, "RT-11", "the pipe could not be made");
  sec_write_max = 3;
  nish_write(lit("hello, world"), out[1], 1);
  sec_write_max = 0;
  close(out[1]);
  char line[64];
  ssize_t have = 0, n_read;
  while ((n_read = read(out[0], line + have, sizeof line - (size_t)have)) > 0) have += n_read;
  close(out[0]);
  sec_check(have == 13 && memcmp(line, "hello, world\n", 13) == 0, "RT-11", "console.log lost the rest of a short write");

  /* RT-12: the descriptors the file reads and writes open are close-on-exec,
     so a child another thread spawns meanwhile does not inherit them. */
  snprintf(path, sizeof path, "%s/cloexec.txt", dir);
  sec_watch = 1;
  sec_cloexec = -1;
  nish_write_file(lit(path), lit("x"));
  sec_check(sec_cloexec == FD_CLOEXEC, "RT-12", "writeFileSync's descriptor is not close-on-exec");
  sec_cloexec = -1;
  nish_read_file_or_null(lit(path));
  sec_check(sec_cloexec == FD_CLOEXEC, "RT-12", "readFileSyncOrNull's descriptor is not close-on-exec");
  sec_watch = 0;

  /* RT-13: a `pread` or a `write` that a signal interrupts before it moves a
     byte is retried. The read stopped there and answered "" for the whole
     file; the write said `cannot write` and exited, so it runs in a child. */
  snprintf(path, sizeof path, "%s/eintr.txt", dir);
  nish_write_file(lit(path), lit("hello"));
  sec_pread_eintr = 1;
  nish_str *whole = nish_read_file_or_null(lit(path));
  sec_check(sec_pread_eintr == 0 && whole && whole->len == 5 && memcmp(whole->data, "hello", 5) == 0, "RT-13",
            "readFileSyncOrNull took an interrupted pread for the end of the file");
  sec_pread_eintr = 0;
  child = fork();
  if (child == 0) {
    close(2);
    sec_write_eintr = 1;
    sec_write_max = 2;
    nish_write_file(lit(path), lit("again"));
    sec_write_max = 0;
    _exit(sec_file_is(path, "again") ? 0 : 3);
  }
  sec_check(sec_status(child) == 0, "RT-13", "writeFileSync failed on an interrupted write");

#if defined(__linux__) && !defined(NISH_THREADS)
  /* RT-10: two first `signalFd()` calls that overlap answer one descriptor,
     the one the handler writes to, and the pipe that lost is closed. Before
     the compare-and-swap the call that finished last answered its own pipe,
     and the other caller's read end never heard a signal. Not in the threads
     build, whose `test_host_signal_threads` needs the first call to happen
     after its thread has started. */
  sec_race = 1;
  int32_t sig_fd = nish_signal_fd();
  sec_check(sec_race == 0 && sig_fd >= 0 && sig_fd == sec_race_first, "RT-10",
            "two overlapping first signalFd() calls answered different descriptors");
  sec_check(fcntl(sec_race_pipe[0], F_GETFD) < 0 && fcntl(sec_race_pipe[1], F_GETFD) < 0, "RT-10",
            "the pipe that lost the race was left open");
  sec_check(nish_signal_fd() == sig_fd, "RT-10", "a later signalFd() answered another descriptor");
  if (sig_fd >= 0 && sig_fd == sec_race_first) {
    raise(SIGINT);
    sec_check(nish_read_signal(sig_fd) == SIGINT, "RT-10", "the descriptor did not hear SIGINT");
  }
#endif

#ifdef NISH_THREADS
  /* RT-8: a range within `grain` of 2^63 is still divided, rather than
     overflowing the chunk count into a negative and running on one thread. */
  int64_t cpus = nish_cpu_count();
  int64_t want = cpus > NISH_PAR_TEST_MAX ? NISH_PAR_TEST_MAX : cpus;
  sec_par_calls = 0;
  nish_parallel_range(sec_par_body, NULL, INT64_MAX, 2);
  sec_check(sec_par_calls == want, "RT-8", "a range near 2^63 was not divided across the threads");
#endif

  if (sec_failed) {
    fprintf(stderr, "runtime_test: %d security check(s) failed\n", sec_failed);
  }
  assert(sec_failed == 0);
}

int main(void) {
  /* Bump allocation: consecutive, 8-byte rounded, 8-byte aligned. */
  char *a = nish_alloc_struct(12);
  char *b = nish_alloc_struct(1);
  char *c = nish_alloc_struct(8);
  assert(((uintptr_t)a & 7) == 0);
  assert(b - a == 16 && c - b == 8);
  size_t used = nish_arena.off;
  assert(used == 32);

  /* Reset recycles in place: the next allocation lands where `a` was. */
  nish_reset_arena();
  assert(nish_arena.off == 0);
  assert((char *)nish_alloc_struct(4) == a);

  /* Overflow grows into a new chunk and keeps working; reset keeps the newest. */
  char *big = nish_alloc_struct(1 << 20);
  assert(big != a);
  memset(big, 0xAB, 1 << 20);
  nish_reset_arena();
  assert(nish_arena.cap >= (1 << 20) && nish_arena.chunks != NULL);

  /* WP6 scopes: mark/release rewinds within a chunk, pops chunks pushed since
   * an older mark, and a mark of 0 (empty arena) behaves like a reset. */
  nish_free_arena();
  assert(nish_arena_mark() == 0 && nish_arena_used() == 0);
  char *base = nish_alloc_struct(16);
  uint64_t m = nish_arena_mark();
  assert(m == (uint64_t)(uintptr_t)(base + 16) && nish_arena_used() == 16);
  nish_alloc_struct(64);
  assert(nish_arena_used() == 80);
  nish_arena_release(m);
  assert(nish_arena_used() == 16 && (char *)nish_alloc_struct(8) == base + 16);
  void *before = nish_arena.chunks;
  char *huge = nish_alloc_struct(1 << 20); /* a second chunk */
  assert(nish_arena.chunks != before && huge != base);
  nish_arena_release(m);                    /* pops it, back to the first chunk */
  assert(nish_arena.chunks == before && nish_arena.buf == base && nish_arena_used() == 16);
  nish_arena_release(0);                    /* like a reset: keeps a chunk, offset 0 */
  assert(nish_arena_used() == 0 && nish_arena.chunks == before);
  for (int i = 0; i < 100000; i++) {       /* a scoped hot loop never grows the arena */
    uint64_t mk = nish_arena_mark();
    nish_alloc_struct(1000);
    nish_arena_release(mk);
  }
  assert(nish_arena_used() == 0 && nish_arena.chunks == before);

  /* WP9 call-site reclaim: `nish_arena_keep(mark, p)` releases back to `mark`
   * while preserving the newest block. Five behaviours, and the four refusals
   * matter more than the move, because each of them is a case where relocating
   * would corrupt live memory. */
  nish_free_arena();
  nish_alloc_struct(8); /* something below the mark, which must not move */
  uint64_t k = nish_arena_mark();
  char *garbage = nish_alloc_struct(400);
  nish_str *kept = nish_str_new("keepme", 6);
  nish_str *moved = nish_arena_keep(k, kept);
  assert((uint64_t)(uintptr_t)moved == k);                  /* moved down onto the mark */
  assert(moved->len == 6 && memcmp(moved->data, "keepme", 6) == 0 && moved->data[6] == 0);
  assert(nish_arena_used() == 8 + 16 && garbage != NULL);   /* the 400 bytes are gone */

  /* Across chunks, with room below the mark: the newer chunk is freed. */
  void *one = nish_arena.chunks;
  k = nish_arena_mark();
  nish_alloc_struct(1 << 20); /* pushes a second chunk */
  kept = nish_str_new("across", 6);
  assert(nish_arena.chunks != one);
  moved = nish_arena_keep(k, kept);
  assert((uint64_t)(uintptr_t)moved == k && nish_arena.chunks == one);
  assert(memcmp(moved->data, "across", 6) == 0);

  /* Across chunks with a *full* chunk below: `p` stays where it is and only the
   * chunks between it and the mark's chunk are freed. */
  nish_free_arena();
  nish_alloc_struct(1 << 20); /* chunk A, filled exactly, so the mark sits at its end */
  void *chunk_a = nish_arena.chunks;
  k = nish_arena_mark();
  nish_alloc_struct(1 << 20); /* chunk B: pure garbage */
  nish_alloc_struct(1 << 20); /* chunk C: pure garbage */
  kept = nish_str_new("stay", 4); /* chunk D */
  void *chunk_d = nish_arena.chunks;
  moved = nish_arena_keep(k, kept);
  assert(moved == kept && nish_arena.chunks == chunk_d); /* not relocated: A has no room */
  assert(memcmp(moved->data, "stay", 4) == 0);
  assert(*(void **)chunk_d == chunk_a); /* B and C were freed out of the middle */

  /* Refusals. A pointer that is not the newest arena block — a string literal
   * in read-only data, or anything older than the mark — is answered unchanged
   * and nothing is released. */
  nish_free_arena();
  nish_str *older = nish_str_new("old", 3);
  k = nish_arena_mark();
  nish_alloc_struct(64);
  size_t held = nish_arena_used();
  assert(nish_arena_keep(k, older) == older && nish_arena_used() == held);
  static const struct { uint64_t len; char data[4]; } literal = { 3, "lit" };
  assert(nish_arena_keep(k, (void *)&literal) == (void *)&literal);
  assert(nish_arena_used() == held);
  /* A stale mark (no live chunk holds it) is refused too. */
  kept = nish_str_new("fresh", 5);
  assert(nish_arena_keep(1, kept) == kept);

  /* Strings. */
  nish_str *hello = nish_str_new("hello", 5);
  nish_str *world = nish_str_new(", world", 7);
  nish_str *hw = nish_str_concat(hello, world);
  assert(nish_str_len(hw) == 12 && memcmp(hw->data, "hello, world", 12) == 0 && hw->data[12] == 0);
  assert(nish_str_eq(hw, nish_str_new("hello, world", 12)));
  assert(!nish_str_eq(hello, world));
  assert(((uintptr_t)hw & 7) == 0);

  /* Integers. */
  expect_str(nish_str_from_i32(-2147483647 - 1), "-2147483648", "i32 min");
  expect_str(nish_str_from_i32(0), "0", "i32 zero");
  expect_str(nish_str_from_i64(INT64_MIN), "-9223372036854775808", "i64 min");
  expect_str(nish_str_from_i64(INT64_MAX), "9223372036854775807", "i64 max");
  expect_str(nish_str_from_i64(10000000000LL), "10000000000", "i64 10^10");

  /* Doubles: JS Number.prototype.toString (expected text is `node -p "String(x)"`). */
  expect_f64(3.5, "3.5");
  expect_f64(0.1, "0.1");
  expect_f64(1.0 / 3.0, "0.3333333333333333");
  expect_f64(1e21, "1e+21");
  expect_f64(1e-7, "1e-7");
  expect_f64(0.000001, "0.000001");
  expect_f64(123456789012.0, "123456789012");
  expect_f64(-0.0, "0");
  expect_f64(NAN, "NaN");
  expect_f64(INFINITY, "Infinity");
  expect_f64(-INFINITY, "-Infinity");
  expect_f64(5e-324, "5e-324");
  expect_f64(1.7976931348623157e308, "1.7976931348623157e+308");
  expect_f64(100.0, "100");
  expect_f64(1.5, "1.5");
  expect_f64(-2.5, "-2.5");
  expect_f64(1e20, "100000000000000000000");
  expect_f64(123456789012345680000.0, "123456789012345680000");
  expect_f64(1.5e300, "1.5e+300");
  /* WP15: the shortest string that round-trips at this length is not the
     correctly-rounded one, so the old snprintf/strtod search printed all
     seventeen digits of each of these. Node prints sixteen. */
  /* `indexOf` moved into the runtime (WP15): the edge cases the inline loop
     used to define, and the repeated-first-byte case the memchr fallback
     walks. `tests/run.js` runs this file against both paths. */
  expect_i64(nish_str_index_of(lit("hello world"), lit("world")), 6, "indexOf hit");
  expect_i64(nish_str_index_of(lit("hello"), lit("")), 0, "indexOf empty needle");
  expect_i64(nish_str_index_of(lit("hi"), lit("longer")), -1, "indexOf needle longer than haystack");
  expect_i64(nish_str_index_of(lit(""), lit("")), 0, "indexOf both empty");
  expect_i64(nish_str_index_of(lit(""), lit("x")), -1, "indexOf empty haystack");
  expect_i64(nish_str_index_of(lit("abc"), lit("abc")), 0, "indexOf whole string");
  expect_i64(nish_str_index_of(lit("abc"), lit("c")), 2, "indexOf last byte");
  expect_i64(nish_str_index_of(lit("abc"), lit("d")), -1, "indexOf absent");
  expect_i64(nish_str_index_of(lit("aaaaab"), lit("aab")), 3, "indexOf repeated first byte");
  expect_i64(nish_str_index_of(lit("aaaa"), lit("aaaaa")), -1, "indexOf needle one longer");
  expect_i64(nish_str_index_of(lit("h\xc3\xa9llo"), lit("\xc3\xa9")), 1, "indexOf utf-8 byte offset");

  expect_f64(7.120236347223045e-307, "7.120236347223045e-307");
  expect_f64(7.291122019556398e-304, "7.291122019556398e-304");
  expect_f64(8.209073602596753e-289, "8.209073602596753e-289");
  expect_f64(5.641232424577593e-278, "5.641232424577593e-278");
  expect_f64(-1e-7, "-1e-7");
  expect_f64(2.5e-7, "2.5e-7");
  expect_f64(9007199254740992.0, "9007199254740992");
  expect_f64(4.35, "4.35");
  expect_f64(-0.49999999999999994, "-0.49999999999999994");
  expect_f64(0.000001234, "0.000001234");
  expect_f64(123e-20, "1.23e-18");
  expect_f64(1234.5678, "1234.5678");

  /* Math.random: doubles in [0, 1) that are not all equal. */
  double first = nish_random(), r;
  int distinct = 0;
  for (int i = 0; i < 1000; i++) {
    r = nish_random();
    assert(r >= 0.0 && r < 1.0);
    if (r != first) distinct++;
  }
  assert(distinct > 990);

  /* Files: write, append, read back. */
  nish_str *path = nish_str_new("build/test/runtime_test.txt", 27);
  nish_write_file(path, nish_str_new("alpha\n", 6));
  nish_append_file(path, nish_str_new("beta\n", 5));
  expect_str(nish_read_file(path), "alpha\nbeta\n", "read back");
  nish_write_file(path, nish_str_new("", 0));
  expect_str(nish_read_file(path), "", "empty file");
  unlink(path->data);

  /* WP4 arrays: grow doubles cap (4 from empty), keeps len and the elements, 8-aligned. */
  nish_array arr = { 0, 0, 0 };
  nish_array_grow(&arr, sizeof(int32_t));
  assert(arr.cap == 4 && arr.len == 0 && arr.data != NULL && ((uintptr_t)arr.data & 7) == 0);
  for (int i = 0; i < 4; i++) ((int32_t *)arr.data)[i] = i * 10;
  arr.len = 4;
  char *old = arr.data;
  nish_array_grow(&arr, sizeof(int32_t));
  assert(arr.cap == 8 && arr.len == 4 && arr.data != old);
  for (int i = 0; i < 4; i++) assert(((int32_t *)arr.data)[i] == i * 10);
  /* K1-6 (docs/security/codegen.md): the capacity stops at 2^31 - 1 elements,
     and a full array of that length refuses to grow rather than let `length`
     wrap. Each runs in a child, so the 2 GiB chunk the first one reserves (and
     never touches) is not left in this process's arena. */
  for (int full = 0; full < 2; full++) {
    pid_t child = fork();
    if (child == 0) {
      nish_array big = { full ? 2147483647u : 0, full ? 2147483647u : 1u << 30, 0 };
      nish_array_grow(&big, 1);
      _exit(big.cap == 2147483647u ? 0 : 2);
    }
    int status = 0;
    waitpid(child, &status, 0);
    assert(WIFEXITED(status) && WEXITSTATUS(status) == full);
  }

  /* WP8 host entry: len == cap, 8-aligned data, elements writable; a zero length allocates only the header. */
  nish_array *fresh = nish_alloc_array(sizeof(double), 3);
  assert(fresh->len == 3 && fresh->cap == 3 && ((uintptr_t)fresh->data & 7) == 0);
  ((double *)fresh->data)[2] = 2.5;
  assert(((double *)fresh->data)[2] == 2.5);
  assert(nish_alloc_array(sizeof(int32_t), 0)->len == 0);
  /* WP7 process.argv: a string array outside the arena (a reset must not touch it). */
  char *argv[] = { "./app", "", "héllo", "42" };
  nish_argv_init(4, argv);
  assert(nish_argv->len == 4 && nish_argv->cap == 4);
  nish_reset_arena();
  expect_str(((nish_str **)nish_argv->data)[0], "./app", "argv[0]");
  expect_str(((nish_str **)nish_argv->data)[1], "", "argv[1]");
  expect_str(((nish_str **)nish_argv->data)[2], "héllo", "argv[2]");
  assert(((nish_str **)nish_argv->data)[2]->len == 6); /* bytes, not code points */
  expect_str(((nish_str **)nish_argv->data)[3], "42", "argv[3]");
  nish_argv_init(0, argv);
  assert(nish_argv->len == 0);

  /* WP7 parsing. mode 0 = parseFloat, 1 = Number, 2 = parseInt (before the i32 saturation). */
  expect_parse("3.14xyz", 0, "3.14");
  expect_parse("  .5", 0, "0.5");
  expect_parse("-1e3", 0, "-1000");
  expect_parse("1e", 0, "1");
  expect_parse("1.5e+", 0, "1.5");
  expect_parse("+Infinity!", 0, "Infinity");
  expect_parse("-Infinity", 0, "-Infinity");
  expect_parse("Infinit", 0, "NaN");
  expect_parse("inf", 0, "NaN");
  expect_parse("nan", 0, "NaN");
  expect_parse("", 0, "NaN");
  expect_parse(".", 0, "NaN");
  expect_parse("+", 0, "NaN");
  expect_parse("abc", 0, "NaN");
  expect_parse("0.1", 0, "0.1");
  expect_parse("1e400", 0, "Infinity");
  expect_parse("0x1A", 0, "26"); /* documented: strtod reads hex, JS parseFloat would stop at the x */
  expect_parse("42", 1, "42");
  expect_parse("", 1, "0");
  expect_parse(" \t\n", 1, "0");
  expect_parse("  7.5  ", 1, "7.5");
  expect_parse("12px", 1, "NaN");
  expect_parse("1e3", 1, "1000");
  expect_parse("-.5", 1, "-0.5");
  expect_parse("0x1A", 1, "26");
  expect_parse("Infinity", 1, "Infinity");
  expect_parse("-Infinity ", 1, "-Infinity");
  expect_parse("Infinityx", 1, "NaN");
  expect_parse("infinity", 1, "NaN");
  expect_parse("NaN", 1, "NaN");
  expect_parse("1e", 1, "NaN");
  expect_parse("1 2", 1, "NaN");
  expect_parse("42", 2, "42");
  expect_parse("  -17abc", 2, "-17");
  expect_parse("+3.99", 2, "3");
  expect_parse("1e5", 2, "1");
  expect_parse("0x10", 2, "0");
  expect_parse("abc", 2, "0");
  expect_parse("", 2, "0");
  expect_parse("99999999999", 2, "99999999999"); /* the compiler saturates this into an i32 */
  { /* an embedded NUL ends the number for Number, like any other non-space byte */
    nish_str *nul = nish_str_new("5\0", 2);
    expect_str(nish_str_from_f64(nish_parse_number(nul, 1)), "NaN", "Number(\"5\\0\")");
    expect_str(nish_str_from_f64(nish_parse_number(nul, 0)), "5", "parseFloat(\"5\\0\")");
  }

  nish_free_arena();
  assert(nish_arena.chunks == NULL && nish_arena.cap == 0);
  /* The partition's contract holds in both configurations, so it is asserted in
     both; only the threaded build can check that it actually divided. */
  test_parallel_common();
  nish_free_arena();
  test_net();
  test_udp();
  test_poll();
  nish_free_arena();
  test_security();
  nish_free_arena();
#ifdef NISH_THREADS
  test_threads();
  test_parallel_threads();
  test_host_signal_threads();
  puts("runtime_test: ok (threads)");
#else
  puts("runtime_test: ok");
#endif
  return 0;
}
