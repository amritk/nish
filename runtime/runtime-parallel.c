/* Nish runtime, the parallel half: how one range of work becomes several
 * threads, and nothing else.
 *
 * A third translation unit rather than a third of `runtime-os.c`, for the
 * reason that file's header gives for being a second one: a budget should mean
 * one thing. `runtime-os.c` is the syscall wrappers and it had 29 bytes of its
 * ceiling left; `pthread_create` plus a partitioner does not fit in 29 bytes,
 * and raising the syscall half's ceiling to make room would move the number a
 * reader sees for "the operating-system surface" for a reason that has nothing
 * to do with the operating-system surface. So this file carries its own
 * measured ceiling in tests/runtime-budgets.js beside the other two,
 * and a program that runs nothing in parallel pays nothing for it:
 * `-ffunction-sections -Wl,--gc-sections` drops every function no program
 * calls, whichever translation unit defined it.
 *
 * It compiles in both configurations on purpose. With `-DNISH_THREADS` it
 * spawns; without it, and on WASI where there are no threads to spawn, the same
 * entry point runs the whole range on the calling thread. That is what keeps it
 * linkable beside a default build and keeps the caller from needing two
 * spellings -- the flag decides whether the work is divided, never whether the
 * function exists. The thread-local arena the divided case needs is WP20 T0 and
 * arrives with the same macro.
 *
 * docs/wp29-thread-surface.md is the surface this is the stage under: P1's
 * `parallelMapInto` and `parallelReduce` divide a range here, P2's scopes
 * run their tasks here (`nish_scope_spawn`, `nish_scope_join`), P3's lock
 * waits here when it finds its word held (`nish_mutex_wait`), and P3's
 * channels keep their buffers here (`nish_channel_send`, `nish_channel_count`,
 * `nish_channel_receive`).
 *
 * Since the pool (docs/wp20-threads.md, section 8e) a divided region or a
 * joined scope no longer creates a thread per chunk or task: it hands them to
 * workers that are started once, on the first region or join that divides, and
 * park between calls.
 */
#if defined(__linux__) && !defined(_GNU_SOURCE)
#define _GNU_SOURCE /* `sched_getaffinity` and `CPU_COUNT`, for `nish_cpu_count` */
#endif
#include "nish.h"

#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#if defined(NISH_THREADS) && !defined(__wasi__) && !defined(__wasm__)
#define NISH_PAR_REAL 1
#include <fcntl.h>
#include <pthread.h>
#include <sched.h>
#endif

/* The ceiling on how many threads one region may use. A fixed bound keeps the
 * job array on the stack -- 64 jobs is 3.5 KB -- so a region never allocates
 * to divide itself, which matters because the arena it would allocate from is
 * the very thing being made per-thread. */
#define NISH_PAR_MAX 64

/* Cached, because the answer is not a cheap read: `sysconf` alone was 3.7 us
 * measured here (glibc parses /sys/devices/system/cpu/online), and the affinity
 * mask and the cgroup quota below are more system calls on top -- which
 * `nish_parallel_range` would otherwise pay on every region, including the ones
 * too small to divide, where it was the entire cost. The race between two
 * threads filling it is benign (both compute the same number) but it is still a
 * race, so the word is read and written with relaxed atomic builtins (a plain
 * `int64_t`, since `__atomic_*` does not take an `_Atomic`-qualified pointer):
 * on x86-64 that is a plain load and store and costs nothing, and it is
 * defined behaviour.
 *
 * A machine whose CPU count changes under a running process therefore keeps
 * the count it started with, which is the right trade for a number that
 * decides how many threads a loop is divided into. */
static int64_t nish_cpu_cached = 0;

#if defined(NISH_PAR_REAL) && defined(__linux__)
/* Reads up to `cap - 1` bytes of a small file into `buf`, terminated; 0 bytes
 * when it cannot be opened. */
static void nish_read_small(const char *path, char *buf, size_t cap) {
  ssize_t got = -1;
  int fd = open(path, O_RDONLY | O_CLOEXEC);
  if (fd >= 0) {
    got = read(fd, buf, cap - 1);
    close(fd);
  }
  buf[got > 0 ? got : 0] = 0;
}

/* The cgroup v2 CPU quota of this process and of every cgroup above it, as a
 * whole number of CPUs rounded up, and `n` when it is lower or there is none.
 * A container limited to 1.5 CPUs on a 64-core host is what this is for: its
 * affinity mask still names all 64, and 63 workers time-sliced into a budget
 * of 1.5 cores is the slowest way there is to run a loop. `cpu.max` reads
 * `<quota> <period>`, or `max <period>` when there is no limit, which the
 * digit test leaves out. The path is the `0::` line of /proc/self/cgroup under
 * /sys/fs/cgroup, where a v2-only system and a container mount the hierarchy;
 * a v1 system has no `cpu.max` there and keeps `n`. */
static int64_t nish_cgroup_cpus(int64_t n) {
  char text[512];
  char path[512] = "/sys/fs/cgroup";
  nish_read_small("/proc/self/cgroup", text, sizeof text);
  char *at = strstr(text, "0::/");
  if (!at || (at != text && at[-1] != '\n')) return n;
  size_t len = strcspn(at + 3, "\n");
  if (len > sizeof path - 24) return n;
  memcpy(path + 14, at + 3, len);
  for (;;) {
    memcpy(path + 14 + len, "/cpu.max", 9);
    nish_read_small(path, text, sizeof text);
    if (text[0] >= '1' && text[0] <= '9') {
      char *rest;
      int64_t quota = strtoll(text, &rest, 10);
      int64_t period = strtoll(rest, 0, 10);
      if (period > 0) {
        int64_t cpus = quota / period + (quota % period != 0);
        if (cpus < n) n = cpus;
      }
    }
    /* Up one level, by dropping the last component, until the root is read. */
    if (len <= 1) return n;
    while (len > 1 && path[14 + len - 1] != '/') len--;
    if (len > 1) len--;
  }
}
#endif

/* The CPUs a region may use: the smallest of the CPUs online, the ones this
 * thread may run on (`taskset`, a container's cpuset), the cgroup quota, and
 * `NISH_NUM_THREADS` when it is a positive number. The variable can lower the
 * count and never raise it, so it caps a program's threads (a CI job sharing
 * its machine, a benchmark pinned to one core) without ever putting more of
 * them on the machine than it has. */
int64_t nish_cpu_count(void) {
  int64_t n = __atomic_load_n(&nish_cpu_cached, __ATOMIC_RELAXED);
  if (n != 0) return n;
#ifdef NISH_PAR_REAL
  long got = sysconf(_SC_NPROCESSORS_ONLN);
  n = got > 0 ? (int64_t)got : 1;
#ifdef __linux__
  cpu_set_t set;
  if (sched_getaffinity(0, sizeof set, &set) == 0) {
    int mine = CPU_COUNT(&set);
    if (mine > 0 && mine < n) n = mine;
  }
  n = nish_cgroup_cpus(n);
#endif
  const char *env = getenv("NISH_NUM_THREADS");
  if (env) {
    char *end;
    long long want = strtoll(env, &end, 10);
    if (end != env && *end == 0 && want > 0 && want < n) n = (int64_t)want;
  }
#else
  n = 1;
#endif
  __atomic_store_n(&nish_cpu_cached, n, __ATOMIC_RELAXED);
  return n;
}

#ifdef NISH_PAR_REAL
/* Non-zero inside a region, so a body that itself calls `nish_parallel_range`
 * runs its range on one thread instead of multiplying the thread count by the
 * nesting depth. Thread-local, so the guard is per worker rather than a lock.
 * Sequential nesting is the conservative answer and the only one that needs no
 * scheduler: work stealing is what a library would do here and it is not what
 * this file is for. */
static NISH_TLS int nish_par_depth = 0;

/* ---- The worker pool (docs/wp20-threads.md, section 8e) ----
 *
 * One unit of work for another thread: a region's chunk or a scope's task,
 * each of which embeds one of these as its first member. `pending` is the
 * count its caller waits on, and lives in the caller's frame until the last
 * job is done; the unpooled path waits on the job's own thread, `th`, instead. */
typedef struct nish_job {
  struct nish_job *next;
  void (*run)(struct nish_job *);
  union {
    int64_t *pending; /* pooled */
    pthread_t th;     /* unpooled */
  };
} nish_job;

/* The workers, started once and parked between calls, and the one queue they
 * take jobs from. It is strictly first in, first out, and the thread that
 * hands jobs in takes them off the same front until the queue is empty, which
 * is what keeps channels deadlock-free with any number of workers, none
 * included: a receiving task is spawned after every task that sends to it
 * (wp29 C6, docs/wp29-thread-surface.md section 4.4), so by the time any
 * thread takes the receiver off the queue, every sender has already been
 * taken by a thread that is running it. A work-stealing deque, which takes
 * the newest job first, would break that, and is declined for that reason.
 *
 * `state` is 0 until the first divided region or join starts the workers, 1
 * once it has, and -1 when `nish_pool_disable` keeps the runtime unpooled. It
 * changes only under the lock, and is read without it once it is not 0. */
static struct {
  pthread_mutex_t mu;
  pthread_cond_t work; /* a worker waits here for a job */
  pthread_cond_t done; /* a caller waits here for its count to reach 0 */
  nish_job *head, *tail;
  int state;
} nish_pool = {PTHREAD_MUTEX_INITIALIZER, PTHREAD_COND_INITIALIZER, PTHREAD_COND_INITIALIZER, 0, 0, 0};

/* The front of the queue, or 0 when it is empty. The lock is held. `head` is
 * also read without it, by a thread spinning before it parks, so it is
 * written with an atomic store (relaxed: the lock still orders the job's
 * contents, since nothing takes a job without it). */
static nish_job *nish_job_take(void) {
  nish_job *j = nish_pool.head;
  if (j) {
    __atomic_store_n(&nish_pool.head, j->next, __ATOMIC_RELAXED);
    if (!j->next) nish_pool.tail = 0;
  }
  return j;
}

/* One job finished, with the lock held. Nothing may touch `j` after the count
 * reaches 0, since its caller is then free to return and take its frame. The
 * count is read without the lock by a caller spinning, as `head` is. */
static void nish_job_done(nish_job *j) {
  if (__atomic_sub_fetch(j->pending, 1, __ATOMIC_RELAXED) == 0) pthread_cond_broadcast(&nish_pool.done);
}

/* How long a thread that finds nothing to do looks again before it sleeps:
 * 2,048 pauses, measured at 18 us on the four-core Xeon of docs/wp20-threads.md
 * section 8e. A program that divides one region usually divides the next one
 * straight after it, and a worker still spinning picks that up without the
 * futex wake that costs more than the spin; a caller still spinning sees its
 * last job finish without one either. The look is a relaxed load and a pause,
 * which leaves the core to its hyperthread sibling meanwhile. */
#define NISH_POOL_SPIN 2048

static void nish_cpu_relax(void) {
#if defined(__x86_64__) || defined(__i386__)
  __builtin_ia32_pause();
#elif defined(__aarch64__)
  __asm__ __volatile__("yield");
#endif
}

/* Takes jobs off the front of the queue and runs them until `*pending` is 0,
 * spinning and then sleeping on `cv` while the queue is empty and the count is
 * not. A worker passes a count that never reaches 0 and sleeps on `work`; a
 * caller passes its own count and sleeps on `done`. The count is read under
 * the lock before the caller returns, which orders every job's writes before
 * it. A worker's arena is its own, not a caller's: the storage class is what
 * makes the two disjoint (WP20 T0). Nothing a job leaves in it outlives the
 * job -- the language keeps a chunk's or a task's results out of its arena --
 * so it is rewound for the next one rather than freed, and kept only when it
 * is one ordinary chunk, so a job that allocated a large block does not leave
 * a parked worker holding it. */
static void nish_pool_drain(int64_t *pending, pthread_cond_t *cv, int worker) {
  pthread_mutex_lock(&nish_pool.mu);
  for (;;) {
    nish_job *j = nish_job_take();
    if (j) {
      pthread_mutex_unlock(&nish_pool.mu);
      j->run(j);
      if (worker) {
        nish_reset_arena();
        if (nish_arena.cap > 65536) nish_free_arena();
      }
      pthread_mutex_lock(&nish_pool.mu);
      nish_job_done(j);
    } else if (*pending == 0) {
      break;
    } else {
      pthread_mutex_unlock(&nish_pool.mu);
      for (int i = 0; i < NISH_POOL_SPIN && __atomic_load_n(pending, __ATOMIC_RELAXED) &&
                      !__atomic_load_n(&nish_pool.head, __ATOMIC_RELAXED);
           i++)
        nish_cpu_relax();
      pthread_mutex_lock(&nish_pool.mu);
      if (*pending != 0 && !nish_pool.head) pthread_cond_wait(cv, &nish_pool.mu);
    }
  }
  pthread_mutex_unlock(&nish_pool.mu);
}

static void *nish_pool_worker(void *unused) {
  (void)unused;
  nish_par_depth = 1;
  int64_t never = 1;
  nish_pool_drain(&never, &nish_pool.work, 1);
  return 0;
}

/* A forked child has only the thread that forked, so it starts with an empty
 * queue and no workers, and starts its own on its first divided call. It takes
 * fresh copies of the lock and the condition variables rather than the ones
 * the parent's workers may have held or been waiting on, so nothing has to be
 * held across the fork. */
static void nish_pool_child(void) {
  nish_pool.head = nish_pool.tail = 0;
  if (nish_pool.state > 0) nish_pool.state = 0;
  pthread_mutex_init(&nish_pool.mu, 0);
  pthread_cond_init(&nish_pool.work, 0);
  pthread_cond_init(&nish_pool.done, 0);
}

/* Whether jobs go to the pool, starting it on the first call: one worker per
 * CPU but the caller's, up to `NISH_PAR_MAX`. A worker that cannot be created
 * leaves fewer, and none is a pool that works, because the caller drains the
 * queue itself. Detached, since nothing joins a worker: it parks until the
 * process exits. */
static int nish_pool_ready(void) {
  int state = __atomic_load_n(&nish_pool.state, __ATOMIC_ACQUIRE);
  if (state != 0) return state > 0;
  pthread_mutex_lock(&nish_pool.mu);
  if (nish_pool.state == 0) {
    int64_t n = nish_cpu_count() - 1;
    if (n > NISH_PAR_MAX - 1) n = NISH_PAR_MAX - 1; /* a region queues at most this many */
    for (int64_t i = 0; i < n; i++) {
      pthread_t th;
      if (pthread_create(&th, 0, nish_pool_worker, 0) != 0) break;
      pthread_detach(th);
    }
    pthread_atfork(0, 0, nish_pool_child);
    __atomic_store_n(&nish_pool.state, 1, __ATOMIC_RELEASE);
  }
  state = nish_pool.state;
  pthread_mutex_unlock(&nish_pool.mu);
  return state > 0;
}

/* The unpooled path's thread: one job, then the arena freed, since nothing
 * else has a pointer to it once the thread exits. */
static void *nish_job_thread(void *p) {
  nish_job *j = (nish_job *)p;
  nish_par_depth = 1;
  j->run(j);
  nish_free_arena();
  return 0;
}

/* Runs `lead` on this thread and the list `rest` elsewhere, oldest first, and
 * returns once every one of them has finished. The caller runs `lead` itself,
 * so N jobs keep N-1 other threads busy and this one is not idle, and then
 * takes queued jobs off the front until the queue is empty: a job no worker is
 * free for runs here, in order, so running short of threads costs speed and
 * never an answer, and a region never waits for a worker to wake when it
 * could be doing the work. A job taken here runs in this thread's arena, as
 * `lead` does.
 *
 * The queue is shared, so a caller can take a job another caller queued. That
 * is safe for the same reason the order is: a job only ever waits on jobs
 * queued before it, and those have all been taken by a thread already. */
static void nish_jobs_run(nish_job *lead, nish_job *rest) {
  int64_t pending = 0;
  int pooled = rest && nish_par_depth == 0 && nish_pool_ready();
  nish_job *last = 0, *inline_from = 0;
  if (pooled) {
    for (nish_job *j = rest; j; j = j->next) {
      j->pending = &pending;
      pending++;
      last = j;
    }
    pthread_mutex_lock(&nish_pool.mu);
    if (nish_pool.tail) nish_pool.tail->next = rest;
    else __atomic_store_n(&nish_pool.head, rest, __ATOMIC_RELAXED);
    nish_pool.tail = last;
    /* One wake per job, rather than every parked worker for a job or two. */
    for (int64_t i = 0; i < pending; i++) pthread_cond_signal(&nish_pool.work);
    pthread_mutex_unlock(&nish_pool.mu);
  } else {
    /* Unpooled, a thread per job, and every job from the first thread that
     * cannot be created on runs here. Inside a job there is no thread at all:
     * a region or a scope in a chunk or a task runs on that one thread, in
     * order, rather than multiplying the threads by the nesting depth. */
    for (inline_from = rest; inline_from && nish_par_depth == 0; inline_from = inline_from->next)
      if (pthread_create(&inline_from->th, 0, nish_job_thread, inline_from) != 0) break;
  }
  nish_par_depth++;
  lead->run(lead);
  if (pooled) {
    nish_pool_drain(&pending, &nish_pool.done, 0);
  } else {
    for (nish_job *j = inline_from; j; j = j->next) j->run(j);
    for (nish_job *j = rest; j != inline_from; j = j->next) pthread_join(j->th, 0);
  }
  nish_par_depth--;
}

/* One chunk of the range, and where to run it. It lives in the caller's frame
 * until every chunk has run. */
typedef struct {
  nish_job job;
  nish_par_body body;
  void *ctx;
  int64_t lo;
  int64_t hi;
} nish_par_job;

static void nish_par_run(nish_job *j) {
  nish_par_job *p = (nish_par_job *)j;
  p->body(p->lo, p->hi, p->ctx);
}
#endif

/* Without the pool every later region and join creates its threads and joins
 * them, as before it existed. For a library that can be unloaded, a Node addon
 * above all: a parked worker would outlive the code it runs. nish.h calls this
 * from a constructor in the shim, before any call can start the pool. */
void nish_pool_disable(void) {
#ifdef NISH_PAR_REAL
  pthread_mutex_lock(&nish_pool.mu);
  if (nish_pool.state == 0) __atomic_store_n(&nish_pool.state, -1, __ATOMIC_RELAXED);
  pthread_mutex_unlock(&nish_pool.mu);
#endif
}

void nish_parallel_range(nish_par_body body, void *ctx, int64_t len, int64_t grain) {
  if (len <= 0) return;
#ifdef NISH_PAR_REAL
  if (grain < 1) grain = 1;
  /* Never more threads than there is work for at the requested granularity,
   * and never more than the machine has. */
  /* Rounded up without `len + grain - 1`, which overflows -- undefined
     behaviour, and in practice a negative count that ran the whole range on
     one thread -- once `len` is within `grain` of 2^63
     (docs/security/runtime.md, RT-8). */
  int64_t chunks = len / grain + (len % grain != 0);
  int64_t n = nish_cpu_count();
  if (n > NISH_PAR_MAX) n = NISH_PAR_MAX;
  if (chunks < n) n = chunks;
  if (n <= 1 || nish_par_depth != 0) {
    body(0, len, ctx);
    return;
  }

  nish_par_job jobs[NISH_PAR_MAX];
  /* Contiguous chunks, the remainder spread one element at a time over the
   * first `len % n` of them, so the longest chunk is never more than one
   * element longer than the shortest. Contiguous rather than strided because
   * two workers then never write the same cache line except at one boundary. */
  int64_t base = len / n;
  int64_t rem = len % n;
  int64_t at = 0;
  for (int64_t i = 0; i < n; i++) {
    int64_t take = base + (i < rem ? 1 : 0);
    jobs[i].job.next = &jobs[i + 1].job;
    jobs[i].job.run = nish_par_run;
    jobs[i].body = body;
    jobs[i].ctx = ctx;
    jobs[i].lo = at;
    jobs[i].hi = at + take;
    at += take;
  }

  /* The caller runs chunk 0 itself, in its own arena, which means chunk 0
   * behaves exactly as a sequential call would -- the asymmetry is deliberate
   * and is why a body whose result is allocated is the surface's error rather
   * than this file's. */
  jobs[n - 1].job.next = 0;
  nish_jobs_run(&jobs[0].job, jobs[0].job.next);
#else
  (void)grain;
  body(0, len, ctx);
#endif
}

/* ---- A scope's tasks (wp29 P2) ----
 *
 * A task is filed when it is spawned and run when its scope joins, which is
 * what keeps a scope race-free without a borrow checker: while the tasks run,
 * the thread that opened the scope is inside the join and runs nothing else,
 * the tasks write nothing but their own payloads (the language's rule), and
 * every store into the caller's memory is a `finish` made on the caller's
 * thread after the last task has finished.
 *
 * The filed tasks are one list per thread, newest first, and each carries the
 * scope it belongs to. Only the thread that opened a scope files into it or
 * joins it, so the list needs no lock, and scopes may nest: a join takes its
 * own scope's tasks out of the list and leaves the rest. */
typedef struct nish_task {
#ifdef NISH_PAR_REAL
  nish_job job;
#endif
  struct nish_task *next;
  void *scope;
  nish_task_fn run;
  nish_task_fn finish;
  /* The copied payload, aligned for any field it holds. */
  uint64_t payload[];
} nish_task;

static NISH_TLS nish_task *nish_tasks = 0;

#ifdef NISH_PAR_REAL
static void nish_task_run(nish_job *j) {
  nish_task *t = (nish_task *)j;
  t->run(t->payload);
}
#endif

/* The end of the program when an allocation of this file's fails: the scope's
 * task list and a channel's buffer are the two, and neither has a way to go on
 * without the memory. */
static void nish_par_oom(void) {
  (void)!write(2, "nish: out of memory\n", 20);
  _exit(1);
}

void nish_scope_spawn(void *scope, nish_task_fn run, nish_task_fn finish, const void *payload, int64_t size) {
  nish_task *t = (nish_task *)malloc(sizeof(nish_task) + (size_t)size);
  /* Out of memory is the end of the program, as it is for every other
   * allocation the runtime makes: running the task here instead would store
   * its answer ahead of tasks filed before it, and a later spawn into the same
   * slot has to be the one that stays. */
  if (!t) nish_par_oom();
  t->scope = scope;
  t->run = run;
  t->finish = finish;
#ifdef NISH_PAR_REAL
  t->job.run = nish_task_run;
#endif
  memcpy(t->payload, payload, (size_t)size);
  t->next = nish_tasks;
  nish_tasks = t;
}

void nish_scope_join(void *scope) {
  /* This scope's tasks, oldest first: the list is newest first, and moving each
   * one to the front of `mine` reverses it. */
  nish_task *mine = 0;
  nish_task **link = &nish_tasks;
  while (*link) {
    nish_task *t = *link;
    if (t->scope == scope) {
      *link = t->next;
      t->next = mine;
#ifdef NISH_PAR_REAL
      t->job.next = (nish_job *)mine;
#endif
      mine = t;
    } else {
      link = &t->next;
    }
  }
  if (!mine) return;
#ifdef NISH_PAR_REAL
  /* The first task on this thread and the rest on the pool, in the order they
   * were spawned, which is the order a task no worker is free for runs in here,
   * and the order every task runs in when the scope is joined inside another
   * job (`nish_jobs_run`). */
  nish_jobs_run(&mine->job, mine->job.next);
#else
  for (nish_task *t = mine; t; t = t->next) t->run(t->payload);
#endif
  /* The stores, in the order the tasks were spawned, so two tasks with one
   * destination leave the later one's answer there, as they would in sequence. */
  while (mine) {
    nish_task *t = mine;
    mine = t->next;
    t->finish(t->payload);
    free(t);
  }
}

/* ---- A lock's contended path (wp29 P3) ----
 *
 * The compiler takes a free lock inline, so this runs only when the word was
 * held: another task is inside its critical section, which the language keeps
 * short -- one lock at a time, nothing waited on while it is held -- so a few
 * relaxed reads usually see it free again. Past that the holder may have been
 * descheduled, and spinning would only keep it off the core, so each further
 * try first yields. The swap that takes the word is the acquire the inline
 * path would have made. */
void nish_mutex_wait(int32_t *word) {
#ifdef NISH_PAR_REAL
  int spins = 0;
#endif
  for (;;) {
    int32_t free_word = 0;
    if (__atomic_load_n(word, __ATOMIC_RELAXED) == 0 &&
        __atomic_compare_exchange_n(word, &free_word, 1, 0, __ATOMIC_ACQUIRE, __ATOMIC_RELAXED))
      return;
#ifdef NISH_PAR_REAL
    if (spins < 64) spins++;
    else sched_yield();
#endif
  }
}

/* ---- A channel of scalars (wp29 P3, section 4.4) ----
 *
 * The `Channel` object lives in the arena of the thread that declared it, and
 * holds one 64-bit word, `state`, that this file owns: 0 before the channel is
 * first used, the address of its `nish_channel` after that, and
 * `NISH_CHANNEL_DRAINED` once its receiver has drained it closed and it has
 * been given back. Every function here takes the address of that word.
 *
 * The buffer is outside every arena, because the senders' arenas are freed
 * when their scope joins and a value sent has to outlive its sender. Each slot
 * is 8 bytes: the compiler widens a scalar into one and narrows it back
 * (src/emit-parallel.ts). The channel is unbounded, so `send` never waits.
 *
 * `pending` is what keeps the channel open: 1 for the scope that has not yet
 * started to join, plus 1 for each task filed that may send on it. The
 * compiler adds a sender at its spawn and takes it away when the task returns,
 * and takes the scope's 1 away just before the join (`nish_channel_count`,
 * -1), so the channel closes when the join has started and every sender has
 * returned -- at once, when no task may send on it. All three happen on the
 * thread that declared the channel until the join, so the word is made there,
 * before any task can touch it, and never by two threads at once.
 *
 * One receiver, the language's rule, takes values off the front. When it
 * finds the channel closed and empty it gives the buffer back and records
 * that, so a second loop over the channel ends at once. Nothing is left to
 * touch it then: every sender has returned, and the parent sends only before
 * the scope's block (docs/LANGUAGE.md, "Channels"). */
#define NISH_CHANNEL_DRAINED 1

typedef struct {
  int64_t *slots;
  int64_t head, tail, cap;
  int64_t pending;
#ifdef NISH_PAR_REAL
  pthread_mutex_t mu;
  pthread_cond_t cv;
#endif
} nish_channel;

static nish_channel *nish_channel_of(int64_t *state) {
  nish_channel *c = (nish_channel *)(intptr_t)*state;
  if (!c) {
    c = (nish_channel *)calloc(1, sizeof(nish_channel));
    if (!c) nish_par_oom();
    c->pending = 1;
#ifdef NISH_PAR_REAL
    pthread_mutex_init(&c->mu, 0);
    pthread_cond_init(&c->cv, 0);
#endif
    *state = (int64_t)(intptr_t)c;
  }
#ifdef NISH_PAR_REAL
  pthread_mutex_lock(&c->mu);
#endif
  return c;
}

/* Every path out of `nish_channel_of` holds the lock; this gives it back,
 * waking the receiver first, since whatever changed may be what it waits on. */
static void nish_channel_done(nish_channel *c) {
#ifdef NISH_PAR_REAL
  pthread_cond_broadcast(&c->cv);
  pthread_mutex_unlock(&c->mu);
#else
  (void)c;
#endif
}

void nish_channel_send(int64_t *state, int64_t value) {
  /* The checker keeps a send off a drained channel (every sender has returned
   * before it closes, and the parent sends only before its scope); this keeps
   * the sentinel from being read as an address if that ever slips. */
  if (*state == NISH_CHANNEL_DRAINED) return;
  nish_channel *c = nish_channel_of(state);
  if (c->tail == c->cap) {
    c->cap = c->cap ? c->cap * 2 : 64;
    c->slots = (int64_t *)realloc(c->slots, (size_t)c->cap * sizeof(int64_t));
    if (!c->slots) nish_par_oom();
  }
  c->slots[c->tail++] = value;
  nish_channel_done(c);
}

void nish_channel_count(int64_t *state, int64_t delta) {
  if (*state == NISH_CHANNEL_DRAINED) return; /* as in `nish_channel_send` */
  nish_channel *c = nish_channel_of(state);
  c->pending += delta;
  nish_channel_done(c);
}

int32_t nish_channel_receive(int64_t *state, int64_t *out) {
  if (*state == NISH_CHANNEL_DRAINED) return 0;
  nish_channel *c = nish_channel_of(state);
#ifdef NISH_PAR_REAL
  while (c->head == c->tail && c->pending != 0) pthread_cond_wait(&c->cv, &c->mu);
#endif
  if (c->head != c->tail) {
    *out = c->slots[c->head++];
    /* Emptied: the next value goes back to the front, so a buffer only grows
     * while the senders are ahead of the receiver. */
    if (c->head == c->tail) c->head = c->tail = 0;
    nish_channel_done(c);
    return 1;
  }
  /* Without threads every sender has returned by the time a receiver runs:
   * the tasks run one after another in spawn order, and every sender is
   * spawned before the one receiver (C6). An empty channel that is still open
   * here is a broken invariant, not a wait. */
  if (c->pending != 0) __builtin_trap();
#ifdef NISH_PAR_REAL
  pthread_mutex_unlock(&c->mu);
  pthread_mutex_destroy(&c->mu);
  pthread_cond_destroy(&c->cv);
#endif
  free(c->slots);
  free(c);
  *state = NISH_CHANNEL_DRAINED;
  return 0;
}
