/* WP45's option prototypes: the session cache of `sessions.ts` (a table of
   sessions keyed by client id, a payload of 16 to 255 bytes each, the oldest
   evicted once `live` are held, ids drawn from `spread` times that many
   clients: 10 by default, so nine requests in ten make a session)
   with each candidate's memory management written out by hand, linked against
   runtime/runtime.c so that the arena is Nish's own. Every request builds a
   64-byte response in a buffer made once, except under `g`, where it is a
   counted value of its own.

     a   today: sessions bumped from the process arena, never given back
     a2  `a` again: the same functions compiled a second time under other
         names and picked at run time, timed beside `a` for the noise band
     r   regions: each session in a region of its own, entered by swapping
         the thread's `nish_arena`, freed whole on eviction (64 KiB chunks,
         nish_arena_grow's policy)
     rs  regions as `r`, with a region's first chunk sized to its first
         request (a runtime change: the minimum chunk becomes per region),
         allocated without the swap; neither `r` nor `rs` models the handle
         table's lookup and generation check, a load and a compare per enter
     s   safe reset: sessions in one of two arenas; once the current one has
         bumped 2x the live bytes since the last flip, the live sessions are
         copied into the other and the old one is freed
     c   opt-in Rc<T>: a malloc'd box with a count, its payload inside; one
         retain and one release per request for the handle the handler holds
     ca  as `c`, with the count atomic (a box shared across threads)
     g   counts on every heap value: the session and its payload counted
         apart, the request's response malloc'd and released rather than
         bumped, and one retain/release per reference the request path loads
         (the session from the table, the payload from the session): a lower
         bound, since a compiler that cannot prove a field read safe counts
         that too

   Only `r` and `rs` carry a region's arena, in an `rsession` around the
   session, so every other variant's session is the 40 bytes it needs.

   Prints the time per request, under `s` the flips and the longest one in
   nanoseconds, the anonymous resident set and the address space at exit
   (statm's resident less shared, and its size), the peak resident set
   (status's VmHWM), and a checksum folded from every response, which every
   variant must agree on.

     cc -O2 options.c runtime.o -o options && ./options <variant> <requests> <live> [spread] */
#include <stdatomic.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

struct nish_chunk { struct nish_chunk *next; uint64_t cap; };
struct nish_arena { char *buf; uint64_t off; uint64_t cap; struct nish_chunk *chunks; };
extern struct nish_arena nish_arena;
void *nish_alloc_struct(uint64_t size);
void nish_free_arena(void);

typedef struct session {
  int64_t id;
  int64_t hits;
  int64_t rc;
  uint32_t len;
  uint8_t *payload;
} session;
/* `r` and `rs`: the session first, so a session pointer is the rsession's */
typedef struct rsession {
  session s;
  struct nish_arena region;
} rsession;

static session **table;
static uint64_t mask;
static int64_t *order;
static int64_t live, head, held;

static uint64_t slot_of(int64_t id) {
  uint64_t h = (uint64_t)id * 0x9e3779b97f4a7c15ull;
  uint64_t i = h >> 20 & mask;
  while (table[i] && table[i]->id != id) i = (i + 1) & mask;
  return i;
}
/* Removes the entry at `i`, moving later ones of its run back (no tombstones). */
static void table_remove(uint64_t i) {
  table[i] = 0;
  for (uint64_t j = (i + 1) & mask; table[j]; j = (j + 1) & mask) {
    session *s = table[j];
    table[j] = 0;
    table[slot_of(s->id)] = s;
  }
}
static uint32_t size_of(int64_t id) { return 16 + (uint32_t)((((uint64_t)id * 2654435761u) >> 7) & 239); }
static void fill(session *s, int64_t id) {
  s->id = id;
  s->hits = 0;
  s->rc = 1;
  for (uint32_t k = 0; k < s->len; k++) s->payload[k] = (uint8_t)(id + k);
}
static uint64_t answer(const session *s, uint8_t *out) {
  /* the response: a status line's worth of bytes and the payload's first 48 */
  memset(out, 'H', 16);
  uint32_t n = s->len < 48 ? s->len : 48;
  memcpy(out + 16, s->payload, n);
  uint64_t sum = 0;
  for (uint32_t k = 0; k < 16 + n; k++) sum = sum * 31 + out[k];
  return sum + s->len;
}

/* ---- a, a2: the process arena */
#define BUMP_VARIANT(NAME)                                                     \
  static session *NAME##_make(int64_t id) {                                    \
    session *s = nish_alloc_struct(sizeof *s);                                 \
    s->len = size_of(id);                                                      \
    s->payload = nish_alloc_struct(s->len);                                    \
    fill(s, id);                                                               \
    return s;                                                                  \
  }                                                                            \
  static void NAME##_drop(session *s) { (void)s; }
BUMP_VARIANT(a)
BUMP_VARIANT(a2)

/* ---- r, rs: a region per session */
static uint64_t region_first;
static void *region_alloc(struct nish_arena *r, uint64_t size) {
  size = (size + 7) & ~(uint64_t)7;
  if (!region_first) {
    /* entered: the thread's arena is the region's for the allocation */
    struct nish_arena saved = nish_arena;
    nish_arena = *r;
    void *p = nish_alloc_struct(size);
    *r = nish_arena;
    nish_arena = saved;
    return p;
  }
  if (r->off + size <= r->cap) { void *p = r->buf + r->off; r->off += size; return p; }
  uint64_t cap = r->chunks ? r->cap * 2 : region_first;
  if (cap < size) cap = size;
  struct nish_chunk *c = malloc(sizeof *c + cap);
  if (!c) abort();
  c->next = r->chunks;
  c->cap = cap;
  r->chunks = c;
  r->buf = (char *)(c + 1);
  r->off = size;
  r->cap = cap;
  return r->buf;
}
static session *r_make(int64_t id) {
  struct nish_arena r = { 0, 0, 0, 0 };
  uint32_t len = size_of(id);
  if (region_first) region_first = (sizeof(rsession) + len + 7) & ~(uint64_t)7;
  rsession *rs = region_alloc(&r, sizeof *rs);
  session *s = &rs->s;
  s->len = len;
  s->payload = region_alloc(&r, len);
  rs->region = r;
  fill(s, id);
  return s;
}
static void r_drop(session *s) {
  /* the arena lives in its own region: the chunk list is read before freeing */
  struct nish_chunk *c = ((rsession *)s)->region.chunks;
  while (c) { struct nish_chunk *n = c->next; free(c); c = n; }
}

/* ---- s: two arenas, the live set copied across at a flip */
static struct nish_arena other;
static uint64_t since_flip, live_bytes, flips;
static double longest_flip; /* ns: the request a flip lands in waits this long */
static session *s_copy(const session *from) {
  session *s = nish_alloc_struct(sizeof *s);
  *s = *from;
  s->payload = nish_alloc_struct(s->len);
  memcpy(s->payload, from->payload, s->len);
  return s;
}
static double now_ns(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return (double)t.tv_sec * 1e9 + (double)t.tv_nsec;
}
static void s_flip(void) {
  double t0 = now_ns();
  struct nish_arena old = nish_arena;
  nish_arena = other;
  for (uint64_t i = 0; i <= mask; i++)
    if (table[i]) table[i] = s_copy(table[i]);
  other = nish_arena;
  nish_arena = old;
  nish_free_arena(); /* the old arena, whole */
  nish_arena = other;
  other = (struct nish_arena){ 0, 0, 0, 0 };
  since_flip = 0;
  flips++;
  double t = now_ns() - t0;
  if (t > longest_flip) longest_flip = t;
}
static session *s_make(int64_t id) {
  uint32_t len = size_of(id);
  uint64_t bytes = sizeof(session) + ((len + 7) & ~7u);
  if (since_flip > 2 * live_bytes + 65536) s_flip();
  session *s = nish_alloc_struct(sizeof *s);
  s->len = len;
  s->payload = nish_alloc_struct(len);
  fill(s, id);
  since_flip += bytes;
  live_bytes += bytes;
  return s;
}
static void s_drop(session *s) { live_bytes -= sizeof(session) + ((s->len + 7) & ~7u); }

/* ---- c, ca: an Rc<Session> box, payload inside */
static session *c_make(int64_t id) {
  uint32_t len = size_of(id);
  session *s = malloc(sizeof *s + len);
  if (!s) abort();
  s->len = len;
  s->payload = (uint8_t *)(s + 1);
  fill(s, id);
  return s;
}
static inline void c_release(session *s) { if (--s->rc == 0) free(s); }
static inline void ca_release(session *s) {
  if (atomic_fetch_sub_explicit((_Atomic int64_t *)&s->rc, 1, memory_order_acq_rel) == 1) free(s);
}

/* ---- g: counts everywhere; the payload is a counted array of its own */
typedef struct counted { int64_t rc; uint8_t bytes[]; } counted;
static session *g_make(int64_t id) {
  session *s = malloc(sizeof *s);
  if (!s) abort();
  s->len = size_of(id);
  counted *p = malloc(sizeof *p + s->len);
  if (!p) abort();
  p->rc = 1;
  s->payload = p->bytes;
  fill(s, id);
  return s;
}
static inline counted *g_box(uint8_t *payload) { return (counted *)(payload - sizeof(counted)); }
static void g_release(session *s) {
  if (--s->rc == 0) {
    counted *p = g_box(s->payload);
    if (--p->rc == 0) free(p);
    free(s);
  }
}

static long statm[3];
static void read_statm(void) {
  FILE *f = fopen("/proc/self/statm", "r");
  if (!f || fscanf(f, "%ld %ld %ld", &statm[0], &statm[1], &statm[2]) != 3) statm[0] = statm[1] = statm[2] = -1;
  if (f) fclose(f);
}
/* The peak resident set in bytes, from /proc/self/status's VmHWM (kB). */
static long read_peak(void) {
  FILE *f = fopen("/proc/self/status", "r");
  char line[256];
  long kb = -1;
  while (f && fgets(line, sizeof line, f))
    if (!strncmp(line, "VmHWM:", 6)) kb = atol(line + 6);
  if (f) fclose(f);
  return kb < 0 ? -1 : kb * 1024;
}

int main(int argc, char **argv) {
  if (argc < 4) { fprintf(stderr, "usage: options <variant> <requests> <live> [spread]\n"); return 2; }
  const char *v = argv[1];
  int64_t requests = atoll(argv[2]);
  live = atoll(argv[3]);
  int64_t spread = argc > 4 ? atoll(argv[4]) : 10;
  uint64_t cap = 1;
  while (cap < (uint64_t)live * 2) cap <<= 1;
  mask = cap - 1;
  table = calloc(cap, sizeof *table);
  order = calloc((size_t)live, sizeof *order);
  char kind = v[0];
  int copy = !strcmp(v, "a2"), small = !strcmp(v, "rs"), atomic = !strcmp(v, "ca");
  if (kind == 'r') region_first = small ? 1 : 0;
  static uint8_t response[64];
  uint64_t x = 2463534242u, checksum = 0;
  struct timespec t0, t1;
  clock_gettime(CLOCK_MONOTONIC, &t0);
  for (int64_t q = 0; q < requests; q++) {
    x ^= x << 13; x ^= x >> 7; x ^= x << 17;
    int64_t id = (int64_t)((x >> 1) % (uint64_t)(live * spread));
    uint8_t *out = kind == 'g' ? malloc(64) : response;
    uint64_t i = slot_of(id);
    session *s = table[i];
    if (!s) {
      if (held == live) {
        uint64_t old = slot_of(order[head]);
        session *e = table[old];
        table_remove(old);
        switch (kind) {
        case 'a': if (copy) a2_drop(e); else a_drop(e); break;
        case 'r': r_drop(e); break;
        case 's': s_drop(e); break;
        case 'c': if (atomic) ca_release(e); else c_release(e); break;
        case 'g': g_release(e); break;
        }
        held--;
        i = slot_of(id);
      }
      switch (kind) {
      case 'a': s = copy ? a2_make(id) : a_make(id); break;
      case 'r': s = r_make(id); break;
      case 's': s = s_make(id); break;
      case 'c': s = c_make(id); break;
      case 'g': s = g_make(id); break;
      default: return 2;
      }
      if (kind == 's') i = slot_of(id); /* a flip moved the table's sessions */
      table[i] = s;
      order[head] = id;
      head = (head + 1) % live;
      held++;
    }
    /* the handler holds the session for the request */
    if (kind == 'c' && !atomic) s->rc++;
    if (kind == 'g') { s->rc++; g_box(s->payload)->rc++; }
    if (atomic) atomic_fetch_add_explicit((_Atomic int64_t *)&s->rc, 1, memory_order_relaxed);
    s->hits++;
    checksum = (checksum * 1000003 + answer(s, out)) & 0xffffffffffffull;
    if (kind == 'g') {
      counted *p = g_box(s->payload);
      if (--p->rc == 0) free(p);
      g_release(s);
      free(out);
    }
    if (kind == 'c' && !atomic) c_release(s);
    if (atomic) ca_release(s);
  }
  clock_gettime(CLOCK_MONOTONIC, &t1);
  double ns = ((double)(t1.tv_sec - t0.tv_sec) * 1e9 + (double)(t1.tv_nsec - t0.tv_nsec)) / (double)requests;
  read_statm();
  printf("%s ns/request %.1f anon %ld size %ld peak %ld", v, ns, (statm[1] - statm[2]) * 4096, statm[0] * 4096,
         read_peak());
  if (kind == 's') printf(" flips %llu longest %.0f", (unsigned long long)flips, longest_flip);
  printf(" checksum %llu\n", (unsigned long long)checksum);
  return 0;
}
