/*
 * main.ts's loop written against libpq in pipeline mode, so run.mjs can set
 * nish/net/postgres's cost beside libpq's on the same server:
 *
 *   twin <pk|list|insert> <port> <user> <password> <database> <count>
 *
 * It prints the line main.ts prints for the same arguments:
 * `rows R checksum S failed F count N ns T user U sys K`, T the timed loop's
 * wall time in nanoseconds, U and K the process's user and system CPU time
 * over it (getrusage), in microseconds.
 *
 * The connection is non-blocking and in pipeline mode. Each query is
 * PQsendQueryPrepared then PQsendPipelineSync, its own group as main.ts's
 * are, up to `depth` in flight (16; 1 for insert); a refill is flushed once
 * with PQflush, the loop then waits in poll() for input, reads it with
 * PQconsumeInput, and drains every result PQgetResult has without blocking.
 * The values are folded as main.ts folds them: text in place from PQgetvalue,
 * the timestamps decoded to the same 24 bytes and the tag array walked to the
 * same elements, so the two checksums agree.
 *
 * PK_SQL, LIST_SQL and INSERT_SQL are the queries of the challenge's SPEC.md
 * (https://github.com/arjaythedev/multicore-server-challenge).
 * Copyright (c) 2026 arjaythedev and the challenge contributors. MIT License;
 * see bench/postgres/LICENSE.md.
 */
#include <poll.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/resource.h>
#include <time.h>

#include <libpq-fe.h>

#define PK_SQL "SELECT id, username, email, bio, image FROM users WHERE id = $1"
#define LIST_SQL                                                                                               \
  "SELECT a.id, a.slug, a.title, a.description, a.created_at, a.updated_at, "                                  \
  "ARRAY(SELECT t.name FROM article_tags at JOIN tags t ON t.id = at.tag_id "                                  \
  "WHERE at.article_id = a.id ORDER BY t.name) AS tag_list, "                                                  \
  "(SELECT count(*) FROM favorites f WHERE f.article_id = a.id) AS favorites_count, "                          \
  "EXISTS (SELECT 1 FROM favorites f WHERE f.article_id = a.id AND f.user_id = $1) AS favorited, "             \
  "u.username, u.bio, u.image, "                                                                               \
  "EXISTS (SELECT 1 FROM follows fo WHERE fo.follower_id = $1 AND fo.followee_id = a.author_id) AS following " \
  "FROM articles a JOIN users u ON u.id = a.author_id "                                                        \
  "ORDER BY a.id DESC LIMIT $2 OFFSET $3"
#define INSERT_SQL "INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
#define RESET_SQL "DELETE FROM follows WHERE follower_id = followee_id"

enum { PK, LIST, INSERT };
#define USERS 100000
#define INT8 20
#define NULL_FOLD 0xFFFFFFFFu

static uint32_t sum = 0;
static long long rows = 0;
static int failed = 0;
static uint32_t x = 0;

static inline void add(uint32_t v) { sum = sum * 31 + v; }

static void bytes(const char *b, int n) {
  uint32_t s = sum * 31 + (uint32_t)n;
  for (int k = 0; k < n; k++) s = s * 31 + (uint8_t)b[k];
  sum = s;
}

static void text(const PGresult *r, int row, int c) {
  if (PQgetisnull(r, row, c)) {
    add(NULL_FOLD);
    return;
  }
  bytes(PQgetvalue(r, row, c), PQgetlength(r, row, c));
}

static int digit(char c) { return c >= '0' && c <= '9'; }

/*
 * main.ts's text.timestamp: `YYYY-MM-DD HH:MM:SS[.f{1,6}][+00]` to
 * `YYYY-MM-DDTHH:MM:SS.mmmZ`; NULL_FOLD and a failure for anything else.
 */
static void timestamp(const PGresult *r, int row, int c) {
  const char *b = PQgetvalue(r, row, c);
  int n = PQgetisnull(r, row, c) ? -1 : PQgetlength(r, row, c);
  char out[24];
  int ok = n >= 19;
  for (int i = 0; ok && i < 19; i++) {
    if (i == 4 || i == 7) ok = b[i] == '-';
    else if (i == 10) ok = b[i] == ' ';
    else if (i == 13 || i == 16) ok = b[i] == ':';
    else ok = digit(b[i]);
  }
  int p = 19, millis = 0;
  if (ok && p < n && b[p] == '.') {
    int digits = 0;
    for (p++; p < n && digit(b[p]); p++, digits++) {
      if (digits < 3) millis = millis * 10 + b[p] - '0';
    }
    ok = digits >= 1 && digits <= 6;
    for (; digits < 3; digits++) millis *= 10;
  }
  if (ok && p + 3 == n && b[p] == '+' && b[p + 1] == '0' && b[p + 2] == '0') p = n;
  if (!ok || p != n || memcmp(b, "0000", 4) == 0) {
    add(NULL_FOLD);
    failed++;
    return;
  }
  memcpy(out, b, 19);
  out[10] = 'T';
  out[19] = '.';
  out[20] = (char)('0' + millis / 100);
  out[21] = (char)('0' + millis / 10 % 10);
  out[22] = (char)('0' + millis % 10);
  out[23] = 'Z';
  bytes(out, 24);
}

/*
 * main.ts's walk with PgArrayWalker over a one-dimensional text[]: each
 * element unescaped, an unquoted NULL as NULL_FOLD, then the count.
 */
static void array(const PGresult *r, int row, int c) {
  const char *b = PQgetvalue(r, row, c);
  int n = PQgetlength(r, row, c);
  char buf[1024];
  uint32_t count = 0;
  if (PQgetisnull(r, row, c) || n < 2 || b[0] != '{' || b[n - 1] != '}') {
    failed++;
    add(count);
    return;
  }
  int p = 1, end = n - 1;
  while (p < end) {
    int m = 0;
    if (b[p] == '"') {
      for (p++; p < end && b[p] != '"'; p++) {
        if (b[p] == '\\') p++;
        if (p >= end || m == (int)sizeof buf) {
          failed++;
          add(count);
          return;
        }
        buf[m++] = b[p];
      }
      if (p >= end) break;
      p++;
      bytes(buf, m);
    } else {
      int start = p;
      while (p < end && b[p] != ',') p++;
      if (p - start == 4 && strncasecmp(b + start, "NULL", 4) == 0) add(NULL_FOLD);
      else bytes(b + start, p - start);
    }
    count++;
    if (p < end) {
      if (b[p] != ',') break;
      p++;
    }
  }
  if (p != end) failed++;
  add(count);
}

static void integer(const PGresult *r, int row, int c) { add((uint32_t)strtoll(PQgetvalue(r, row, c), NULL, 10)); }
static void boolean(const PGresult *r, int row, int c) { add(PQgetvalue(r, row, c)[0] == 't' ? 1 : 0); }

static void fold(const PGresult *r, int mode) {
  int n = PQntuples(r);
  for (int row = 0; row < n; row++) {
    if (mode == PK) {
      integer(r, row, 0);
      for (int c = 1; c < 5; c++) text(r, row, c);
    } else {
      integer(r, row, 0);
      text(r, row, 1);
      text(r, row, 2);
      text(r, row, 3);
      timestamp(r, row, 4);
      timestamp(r, row, 5);
      array(r, row, 6);
      integer(r, row, 7);
      boolean(r, row, 8);
      text(r, row, 9);
      text(r, row, 10);
      text(r, row, 11);
      boolean(r, row, 12);
    }
    rows++;
  }
}

static long long id(void) {
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return (long long)(x % USERS) + 1;
}

/* Sends query `i` of `mode` and its Sync; 0 when libpq refused it. */
static int send_query(PGconn *conn, int mode, int i) {
  char a[24], b[24], c[24];
  const char *values[3] = {a, b, c};
  if (mode == PK) {
    snprintf(a, sizeof a, "%lld", id());
    if (!PQsendQueryPrepared(conn, "pk", 1, values, NULL, NULL, 0)) return 0;
  } else if (mode == LIST) {
    snprintf(a, sizeof a, "%lld", id());
    snprintf(b, sizeof b, "%d", 20);
    snprintf(c, sizeof c, "%d", i % 10 * 20);
    if (!PQsendQueryPrepared(conn, "list", 3, values, NULL, NULL, 0)) return 0;
  } else {
    snprintf(a, sizeof a, "%d", 1 + i % USERS);
    values[1] = a;
    if (!PQsendQueryPrepared(conn, "insert", 2, values, NULL, NULL, 0)) return 0;
  }
  return PQsendPipelineSync(conn);
}

/* Runs `n` queries of `mode`, up to `depth` in flight, folding their results when `folding`; 0 on a failure. */
static int run(PGconn *conn, int mode, int n, int depth, int folding) {
  int sent = 0, done = 0;
  x = 2463534242u;
  while (done < n) {
    while (sent < n && sent - done < depth) {
      if (!send_query(conn, mode, sent)) {
        fprintf(stderr, "send: %s", PQerrorMessage(conn));
        return 0;
      }
      sent++;
    }
    int pending = PQflush(conn);
    if (pending < 0) {
      fprintf(stderr, "flush: %s", PQerrorMessage(conn));
      return 0;
    }
    struct pollfd p = {PQsocket(conn), POLLIN | (pending ? POLLOUT : 0), 0};
    if (poll(&p, 1, 10000) <= 0) {
      fprintf(stderr, "timed out\n");
      return 0;
    }
    if ((p.revents & (POLLIN | POLLERR | POLLHUP)) && !PQconsumeInput(conn)) {
      fprintf(stderr, "read: %s", PQerrorMessage(conn));
      return 0;
    }
    while (done < sent && !PQisBusy(conn)) {
      PGresult *r = PQgetResult(conn);
      if (r == NULL) continue;
      ExecStatusType status = PQresultStatus(r);
      if (status == PGRES_PIPELINE_SYNC) {
        done++;
      } else if (!folding) {
      } else if (status == PGRES_TUPLES_OK) {
        fold(r, mode);
      } else if (status == PGRES_COMMAND_OK) {
        long long k = strtoll(PQcmdTuples(r), NULL, 10);
        rows += k;
        add((uint32_t)k);
      } else {
        failed++;
      }
      PQclear(r);
    }
  }
  return 1;
}

static void cpu_micros(long long *user, long long *sys) {
  struct rusage u;
  getrusage(RUSAGE_SELF, &u);
  *user = (long long)u.ru_utime.tv_sec * 1000000 + u.ru_utime.tv_usec;
  *sys = (long long)u.ru_stime.tv_sec * 1000000 + u.ru_stime.tv_usec;
}

static long long now_ns(void) {
  struct timespec t;
  clock_gettime(CLOCK_MONOTONIC, &t);
  return (long long)t.tv_sec * 1000000000 + t.tv_nsec;
}

static int reset(PGconn *conn) {
  PGresult *r = PQexec(conn, RESET_SQL);
  int ok = PQresultStatus(r) == PGRES_COMMAND_OK;
  if (!ok) fprintf(stderr, "reset: %s", PQerrorMessage(conn));
  PQclear(r);
  return ok;
}

int main(int argc, char **argv) {
  if (argc < 7) {
    fprintf(stderr, "usage: twin <pk|list|insert> <port> <user> <password> <database> <count>\n");
    return 2;
  }
  int mode = strcmp(argv[1], "pk") == 0 ? PK : strcmp(argv[1], "list") == 0 ? LIST : strcmp(argv[1], "insert") == 0 ? INSERT : -1;
  if (mode < 0) {
    fprintf(stderr, "unknown mode %s\n", argv[1]);
    return 2;
  }
  int count = atoi(argv[6]);
  int depth = mode == INSERT ? 1 : 16;
  /* Plain TCP whatever PGSSLMODE, PGGSSENCMODE or the cluster's ssl say, as main.ts's. */
  const char *keys[] = {"host", "port", "user", "password", "dbname", "sslmode", "gssencmode", NULL};
  const char *values[] = {"127.0.0.1", argv[2], argv[3], argv[4], argv[5], "disable", "disable", NULL};
  PGconn *conn = PQconnectdbParams(keys, values, 0);
  if (PQstatus(conn) != CONNECTION_OK) {
    fprintf(stderr, "connect: %s", PQerrorMessage(conn));
    return 1;
  }
  Oid types[3] = {INT8, INT8, INT8};
  const char *name = mode == PK ? "pk" : mode == LIST ? "list" : "insert";
  const char *sql = mode == PK ? PK_SQL : mode == LIST ? LIST_SQL : INSERT_SQL;
  int params = mode == PK ? 1 : mode == LIST ? 3 : 2;
  PGresult *r = PQprepare(conn, name, sql, params, types);
  if (PQresultStatus(r) != PGRES_COMMAND_OK) {
    fprintf(stderr, "prepare: %s", PQerrorMessage(conn));
    return 1;
  }
  PQclear(r);
  if (PQsetnonblocking(conn, 1) != 0 || !PQenterPipelineMode(conn)) {
    fprintf(stderr, "pipeline: %s", PQerrorMessage(conn));
    return 1;
  }
  if (!run(conn, mode, depth, depth, 0)) return 1;
  if (mode == INSERT) {
    PQexitPipelineMode(conn);
    PQsetnonblocking(conn, 0);
    if (!reset(conn)) return 1;
    PQsetnonblocking(conn, 1);
    PQenterPipelineMode(conn);
  }
  long long user0, sys0, user, sys;
  cpu_micros(&user0, &sys0);
  long long t0 = now_ns();
  int ok = run(conn, mode, count, depth, 1);
  long long ns = now_ns() - t0;
  cpu_micros(&user, &sys);
  if (!ok) return 1;
  if (mode == INSERT) {
    PQexitPipelineMode(conn);
    PQsetnonblocking(conn, 0);
    if (!reset(conn)) return 1;
  }
  printf("rows %lld checksum %u failed %d count %d ns %lld user %lld sys %lld\n", rows, sum, failed, count, ns,
         user - user0, sys - sys0);
  PQfinish(conn);
  return 0;
}
