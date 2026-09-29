/* Nish runtime, the network half: addresses and non-blocking TCP (WP34 N5),
 * the `nish:net` builtin module. Every socket it makes is non-blocking and
 * close-on-exec, so a program owns the loop that waits on it, and a child
 * `spawnSync` starts inherits none of them.
 *
 * A translation unit of its own for the reason runtime-host.c is one: each
 * file carries its own measured `.text*` ceiling in tests/run.js, and sockets
 * are a surface that grows (UDP and the readiness loop follow), which would
 * push another unit past its ceiling rather than into a new one. Section GC
 * means a program that calls none of these pays for none of them, and
 * scripts/build.sh pairs this file with runtime.c like the other halves, so a
 * link line still names one runtime.
 *
 * The error convention is the one `signalFd` set: an `i32`, `>= 0` for
 * success (a descriptor, a byte count, 0), and a negative errno otherwise.
 * The codes a loop branches on are Linux's numbers on every platform (-11
 * would block, -95 unsupported, -32 the peer is gone, -104 reset, -98 the
 * address is in use, -22 a bad argument), so `nish_net_err` translates
 * Darwin's; any other failure is the host's own `-errno`. Nothing here
 * allocates: the addresses a call reads or writes are the caller's `u8[]`.
 *
 * An address is 18 bytes of that array: the 16 bytes of an IPv6 address, an
 * IPv4 one as `::ffff:a.b.c.d`, then the port, big-endian. An IPv4 address is
 * an `AF_INET` socket; any other is `AF_INET6` with `IPV6_V6ONLY` off, so
 * `::` hears both families, and when the kernel has no IPv6 at all
 * (`EAFNOSUPPORT`, as in many containers) `::` falls back to IPv4's
 * `0.0.0.0`.
 *
 * Linux and Darwin differ in three places: `SOCK_NONBLOCK | SOCK_CLOEXEC` and
 * `accept4` against a `socket` or `accept` followed by `fcntl`, `MSG_NOSIGNAL`
 * against the `SO_NOSIGPIPE` socket option (a write to a gone peer is -32 on
 * both, never SIGPIPE), and the errno numbers. The Darwin branch is compiled
 * by CI's Darwin bootstrap rows and run by nothing. A WASI build has none of
 * this (the checker refuses every `nish:net` call under a wasm target), so
 * there the file is empty.
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
#include <stdint.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

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
#endif
  return -e;
}

/* The same for a call that has just failed. */
static int32_t nish_net_fail(void) { return nish_net_err(errno); }

/* A numeric host into the 16 address bytes: an IPv4 dotted quad as its mapped
   form, or an IPv6 literal. No name resolution. 1 when it parsed. */
static int nish_net_parse(const char *host, unsigned char a[16]) {
  if (inet_pton(AF_INET, host, a + 12) == 1) {
    memcpy(a, nish_mapped_prefix, 12);
    return 1;
  }
  return inet_pton(AF_INET6, host, a) == 1;
}

/* `a` and `port` as a socket address of the family `v4` names. */
static socklen_t nish_net_sockaddr(nish_sockaddr *s, const unsigned char a[16], int32_t port, int v4) {
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

static int nish_net_socket(int family, int type) {
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
  if (out->len < NISH_ADDR_BYTES || (uint32_t)port > 65535 || !nish_net_parse(host->data, a)) return -22;
  memcpy(out->data, a, 16);
  out->data[16] = (char)(port >> 8);
  out->data[17] = (char)port;
  return 0;
}

/* `netLocalPort(fd)`: the port the socket is bound to, which is how a
   program that listened on port 0 learns the one the kernel chose. */
int32_t nish_net_local_port(int32_t fd) {
  nish_sockaddr s;
  socklen_t n = sizeof s;
  if (getsockname(fd, &s.sa, &n) != 0) return nish_net_fail();
  return ntohs(s.sa.sa_family == AF_INET ? s.v4.sin_port : s.v6.sin6_port);
}

/* `tcpListen(host, port, backlog)`: a listening socket with `SO_REUSEADDR`,
   so a restarted server rebinds a port whose old connections are still in
   TIME_WAIT. */
int32_t nish_tcp_listen(const nish_str *host, int32_t port, int32_t backlog) {
  unsigned char a[16];
  if ((uint32_t)port > 65535 || !nish_net_parse(host->data, a)) return -22;
  int v4 = memcmp(a, nish_mapped_prefix, 12) == 0;
  int fd = nish_net_socket(v4 ? AF_INET : AF_INET6, SOCK_STREAM);
  /* `::` on a kernel without IPv6: the same wildcard in the family there is.
     All sixteen bytes are zero, so the last four are already `0.0.0.0`. */
  static const unsigned char any[16];
  if (fd < 0 && errno == EAFNOSUPPORT && memcmp(a, any, 16) == 0) {
    v4 = 1;
    fd = nish_net_socket(AF_INET, SOCK_STREAM);
  }
  if (fd < 0) return nish_net_fail();
  int one = 1;
  int zero = 0;
  setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
  if (!v4) setsockopt(fd, IPPROTO_IPV6, IPV6_V6ONLY, &zero, sizeof zero);
  nish_sockaddr s;
  socklen_t n = nish_net_sockaddr(&s, a, port, v4);
  if (bind(fd, &s.sa, n) != 0 || listen(fd, backlog) != 0) {
    int e = errno;
    close(fd);
    return nish_net_err(e);
  }
  return fd;
}

/* `tcpAccept(fd, peer)`: the next connection as a descriptor of its own,
   non-blocking and close-on-exec, with the peer's address written into
   `peer`; -11 when none is waiting. A `peer` shorter than 18 bytes is -22
   before anything is accepted, so no connection is taken and lost. */
int32_t nish_tcp_accept(int32_t fd, nish_array *peer) {
  if (peer->len < NISH_ADDR_BYTES) return -22;
  nish_sockaddr s;
  socklen_t n = sizeof s;
#if defined(__linux__)
  int c = accept4(fd, &s.sa, &n, SOCK_NONBLOCK | SOCK_CLOEXEC);
#else
  int c = nish_net_setup(accept(fd, &s.sa, &n));
#endif
  if (c < 0) return nish_net_fail();
  unsigned char *p = (unsigned char *)peer->data;
  uint16_t port = s.v6.sin6_port;
  if (s.sa.sa_family == AF_INET) {
    memcpy(p, nish_mapped_prefix, 12);
    memcpy(p + 12, &s.v4.sin_addr, 4);
    port = s.v4.sin_port;
  } else {
    memcpy(p, &s.v6.sin6_addr, 16);
  }
  /* Already in network order, which is the form's big-endian. */
  memcpy(p + 16, &port, 2);
  return c;
}

/* `netRead(fd, buf, off, len)`: at most `len` bytes into `buf` from `off`.
   The compiled call has already checked `0 <= off <= off + len <=
   buf.length`, unless the program was built with `--unchecked-indexing`. */
int32_t nish_net_read(int32_t fd, nish_array *buf, int64_t off, int64_t len) {
  ssize_t n = recv(fd, buf->data + off, (size_t)len, 0);
  return n < 0 ? nish_net_fail() : (int32_t)n;
}

/* `netWrite(fd, buf, off, len)`: at most `len` bytes of `buf` from `off`,
   with a peer that has gone answering -32 rather than raising SIGPIPE. */
int32_t nish_net_write(int32_t fd, const nish_array *buf, int64_t off, int64_t len) {
  ssize_t n = send(fd, buf->data + off, (size_t)len, NISH_NOSIGNAL);
  return n < 0 ? nish_net_fail() : (int32_t)n;
}

/* `netShutdown(fd, how)`: 0 the read side, 1 the write side, 2 both, which
   are `SHUT_RD`, `SHUT_WR` and `SHUT_RDWR` on both platforms. */
int32_t nish_net_shutdown(int32_t fd, int32_t how) {
  if ((uint32_t)how > 2) return -22;
  return shutdown(fd, how) != 0 ? nish_net_fail() : 0;
}

/* `netClose(fd)`. The descriptor is gone whatever this answers, as `close`
   promises on Linux, so a failure is information rather than a retry. */
int32_t nish_net_close(int32_t fd) { return close(fd) != 0 ? nish_net_fail() : 0; }
#endif
