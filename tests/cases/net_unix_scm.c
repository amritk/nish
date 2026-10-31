/* Driver for net_unix_scm: the number of open descriptors before and after
   each call, printed as the call's answer and the change, which must be 0.
   The count asks `fcntl` of every descriptor below 1024, so it needs no
   `/proc` and answers the same on Darwin. The file is unlinked once open and
   the TCP socket is never bound, so nothing is left on disk or on a port.

   Then each kind of descriptor `carry` takes is read for `FD_CLOEXEC`, which
   it must hold, `O_NONBLOCK`, which it keeps from the sender's descriptor, and
   whether it is the file or socket that was sent, by device and inode. Then
   this driver sends descriptors itself, three in one message and then twelve,
   past `recvFd`'s room for eight: each must leave one descriptor open, the
   first sent, and the byte still read. Last, `peer` reads each Unix kind's
   credentials, which must be this process's own. */
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <unistd.h>

int32_t attempts(void);
int32_t attempt(int32_t k, int32_t file, int32_t tcp, int32_t a, int32_t b);
int32_t carry(int32_t a, int32_t b, int32_t fd);
/* `nish_array` in `runtime/nish.h`: an `i32[]` of `len` elements at `data`. */
typedef struct {
  uint64_t len, cap;
  char *data;
} array;
int32_t gather(int32_t b, array *kept);
int32_t peer(int32_t fd, int32_t k);
int32_t connected(int32_t k, int32_t listener, int32_t pid);
int32_t release(int32_t pid);

static int open_fds(void) {
  int n = 0;
  for (int fd = 0; fd < 1024; fd++) {
    if (fcntl(fd, F_GETFD) != -1) {
      n++;
    }
  }
  return n;
}

static int same(int x, int y) {
  struct stat p, q;
  return fstat(x, &p) == 0 && fstat(y, &q) == 0 && p.st_dev == q.st_dev && p.st_ino == q.st_ino;
}

static void flags(const char *what, int sent, int fd) {
  printf("%s %d: cloexec %d nonblock %d same %d\n", what, fd >= 0, (fcntl(fd, F_GETFD) & FD_CLOEXEC) != 0,
         (fcntl(fd, F_GETFL) & O_NONBLOCK) != 0, same(sent, fd));
  close(fd);
}

/* `n` copies of `fd` in one message of one byte over `sock`, the copies closed here once sent. */
static int send_many(int sock, int fd, int n) {
  int copies[16];
  for (int i = 0; i < n; i++) {
    copies[i] = fcntl(fd, F_DUPFD_CLOEXEC, 0);
  }
  union {
    struct cmsghdr h;
    char room[CMSG_SPACE(sizeof copies)];
  } u;
  memset(&u, 0, sizeof u);
  char byte = 9;
  struct iovec io = {.iov_base = &byte, .iov_len = 1};
  struct msghdr m = {.msg_iov = &io, .msg_iovlen = 1, .msg_control = u.room, .msg_controllen = CMSG_SPACE(n * sizeof(int))};
  struct cmsghdr *c = CMSG_FIRSTHDR(&m);
  c->cmsg_level = SOL_SOCKET;
  c->cmsg_type = SCM_RIGHTS;
  c->cmsg_len = CMSG_LEN(n * sizeof(int));
  memcpy(CMSG_DATA(c), copies, n * sizeof(int));
  int sent = (int)sendmsg(sock, &m, 0);
  for (int i = 0; i < n; i++) {
    close(copies[i]);
  }
  return sent;
}

int main(void) {
  char path[64];
  snprintf(path, sizeof path, "build/test/nus-%d", (int)getpid());
  int file = open(path, O_RDWR | O_CREAT | O_TRUNC | O_CLOEXEC, 0600);
  unlink(path);
  int tcp = socket(AF_INET, SOCK_STREAM, 0);
  int pair[2];
  if (file < 0 || tcp < 0 || socketpair(AF_UNIX, SOCK_STREAM, 0, pair) != 0) {
    printf("set up failed\n");
    return 1;
  }
  /* Non-blocking, as `unixSocketPair` makes them, so an empty read is -11. */
  fcntl(pair[0], F_SETFL, O_NONBLOCK);
  fcntl(pair[1], F_SETFL, O_NONBLOCK);
  for (int32_t k = 0; k < attempts(); k++) {
    int before = open_fds();
    int32_t answer = attempt(k, file, tcp, pair[0], pair[1]);
    printf("attempt %d: %d, descriptors %+d\n", k, answer, open_fds() - before);
  }

  flags("file", file, carry(pair[0], pair[1], file));
  int blocking[2];
  socketpair(AF_UNIX, SOCK_STREAM, 0, blocking);
  fcntl(blocking[1], F_SETFL, O_NONBLOCK);
  flags("non-blocking socket", blocking[1], carry(pair[0], pair[1], blocking[1]));
  flags("blocking socket", blocking[0], carry(pair[0], pair[1], blocking[0]));
  close(blocking[0]);
  close(blocking[1]);

  for (int n = 3; n <= 12; n += 9) {
    int before = open_fds();
    int sent = send_many(pair[0], file, n);
    int32_t kept_fd = -7;
    array kept = {1, 1, (char *)&kept_fd};
    int32_t got = gather(pair[1], &kept);
    printf("%d sent (%d): read %d, kept %d, descriptors %+d\n", n, sent, got, kept_fd >= 0 && same(file, kept_fd),
           open_fds() - before);
    close(kept_fd);
  }

  int32_t socks[3];
  const char *kinds[] = {"listen", "connect", "accept"};
  for (int32_t k = 0; k < 3; k++) {
    socks[k] = connected(k, k > 0 ? socks[0] : -1, (int32_t)getpid());
  }
  printf("pair: pid %d uid %d gid %d\n", peer(pair[0], 0) == (int32_t)getpid(), peer(pair[0], 1) == (int32_t)getuid(),
         peer(pair[0], 2) == (int32_t)getgid());
  for (int32_t k = 1; k < 3; k++) {
    printf("%s: pid %d uid %d gid %d\n", kinds[k], peer(socks[k], 0) == (int32_t)getpid(),
           peer(socks[k], 1) == (int32_t)getuid(), peer(socks[k], 2) == (int32_t)getgid());
  }
  /* A listener has no peer, and both platforms refuse it with ENOTCONN
   * rather than answer the listener's own credentials. */
  printf("listen: refused %d\n", peer(socks[0], 0) == -ENOTCONN);
  for (int32_t k = 0; k < 3; k++) {
    close(socks[k]);
  }
  printf("release %d\n", release((int32_t)getpid()));
  return 0;
}
