/* Driver for spawn_fds_child. Run plain, it marks every descriptor from 3 up that
   it inherited close-on-exec, so none of the test runner's reaches a child,
   puts the files holding "a", "b" and "c" on 3, 4 and 5 (close-on-exec, as
   anything the program opens is), and prints each attempt's answer and the
   change in its own descriptor count, which must be 0: a refusal and a spawn
   alike close every copy they made. Then it reads 3, 4 and 5 for
   close-on-exec, which `spawnWithFds` must not have cleared here, and runs
   the round trip `pass` drives.

   Run as "child", it prints the descriptors from 3 up it holds, as the letter
   read at offset 0 ("-" when the read fails, as on a socket), "!" when one is
   close-on-exec, which no descriptor handed over may be, and "~" when it is
   non-blocking. Run as "pass", it is the far end of the round trip: it waits
   for the message on descriptor 3, takes the descriptor that came with it,
   prints the letter there, whether it is close-on-exec, and whether the peer's
   pid, uid and gid are its parent's, its own and its own, then starts a
   "child", which must print no descriptor. Every count asks `fcntl` of every
   descriptor below 1024, so it needs no `/proc` and answers the same on
   Darwin. */
#include <fcntl.h>
#include <poll.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

int32_t attempts(void);
int32_t attempt(int32_t k);
int32_t pass(int32_t file);
int32_t take(int32_t sock);
int32_t peer(int32_t sock, int32_t k);
int32_t report(void);

static int open_fds(void) {
  int n = 0;
  for (int fd = 0; fd < 1024; fd++) {
    if (fcntl(fd, F_GETFD) != -1) {
      n++;
    }
  }
  return n;
}

static int cloexec(int fd) { return (fcntl(fd, F_GETFD) & FD_CLOEXEC) != 0; }

static void seal(void) {
  for (int fd = 3; fd < 1024; fd++) {
    int flags = fcntl(fd, F_GETFD);
    if (flags != -1) {
      fcntl(fd, F_SETFD, flags | FD_CLOEXEC);
    }
  }
}

static int child(void) {
  printf("child:");
  for (int fd = 3; fd < 1024; fd++) {
    if (fcntl(fd, F_GETFD) == -1) {
      continue;
    }
    char c = '-';
    if (pread(fd, &c, 1, 0) != 1) {
      c = '-';
    }
    printf(" %d:%c%s%s", fd, c, cloexec(fd) ? "!" : "", (fcntl(fd, F_GETFL) & O_NONBLOCK) ? "~" : "");
  }
  printf("\n");
  return 0;
}

static int far_end(void) {
  seal();
  struct pollfd p = {.fd = 3, .events = POLLIN};
  int ready = poll(&p, 1, 10000);
  int32_t fd = take(3);
  char c = '?';
  if (fd >= 0 && pread(fd, &c, 1, 0) != 1) {
    c = '?';
  }
  printf("far end: ready %d, letter %c, cloexec %d\n", ready, c, fd >= 0 && cloexec(fd));
  printf("far end: peer pid %d uid %d gid %d\n", peer(3, 0) == (int32_t)getppid(), peer(3, 1) == (int32_t)getuid(),
         peer(3, 2) == (int32_t)getgid());
  fflush(stdout);
  int32_t status = report();
  printf("far end: report %d\n", status);
  return 0;
}

int main(int argc, char **argv) {
  setenv("SPAWN_FDS_SELF", argv[0], 1);
  if (argc > 1 && strcmp(argv[1], "child") == 0) {
    return child();
  }
  if (argc > 1 && strcmp(argv[1], "pass") == 0) {
    return far_end();
  }
  seal();
  char path[64];
  for (int i = 0; i < 3; i++) {
    snprintf(path, sizeof path, "build/test/sfd-%d-%c", (int)getpid(), 'a' + i);
    int fd = open(path, O_RDWR | O_CREAT | O_TRUNC | O_CLOEXEC, 0600);
    char c = (char)('a' + i);
    if (fd < 0 || write(fd, &c, 1) != 1) {
      printf("cannot make %s\n", path);
      return 1;
    }
    unlink(path);
    if (fd != 3 + i) {
      dup2(fd, 3 + i);
      fcntl(3 + i, F_SETFD, FD_CLOEXEC);
      close(fd);
    }
  }
  for (int32_t k = 0; k < attempts(); k++) {
    fflush(stdout);
    int before = open_fds();
    int32_t answer = attempt(k);
    printf("attempt %d: %d, descriptors %+d\n", k, answer, open_fds() - before);
  }
  printf("cloexec here: %d %d %d\n", cloexec(3), cloexec(4), cloexec(5));
  fflush(stdout);
  int before = open_fds();
  int32_t status = pass(3);
  printf("pass: %d, descriptors %+d\n", status, open_fds() - before);
  return 0;
}
