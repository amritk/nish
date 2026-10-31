/* Driver for net_unix_fds: the number of open descriptors before and after
   each call, printed as the call's answer and the change, which must be 0.
   The count asks `fcntl` of every descriptor below 1024, so it needs no
   `/proc` and answers the same on Darwin. `chmod` here takes the runtime's
   place: it fails with EPERM for `nuf-chmodfail.sock`, so the post-bind
   failure branch runs, and is `fchmodat` for any other path. Once every
   attempt has run, each path an attempt named and must not have left behind
   is checked with `lstat`, the 107-byte one among them: the 108-byte path
   cut short by one byte, which a truncating bind would have made. Last, the
   descriptors `hold` makes, one of each Unix-domain kind, are kept open and
   read for `FD_CLOEXEC` and `O_NONBLOCK`, which each must hold from creation,
   then closed. */
#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

int32_t setUp(void);
int32_t attempts(void);
int32_t attempt(int32_t k);
int32_t tearDown(int32_t live);
int32_t hold(int32_t k, int32_t listener);
int32_t release(void);

int chmod(const char *path, mode_t mode) {
  size_t n = strlen(path);
  const char *fail = "nuf-chmodfail.sock";
  if (n >= strlen(fail) && strcmp(path + n - strlen(fail), fail) == 0) {
    errno = EPERM;
    return -1;
  }
  return fchmodat(AT_FDCWD, path, mode, 0);
}

static int open_fds(void) {
  int n = 0;
  for (int fd = 0; fd < 1024; fd++) {
    if (fcntl(fd, F_GETFD) != -1) {
      n++;
    }
  }
  return n;
}

int main(void) {
  int32_t live = setUp();
  printf("setUp %d\n", live >= 0);
  for (int32_t k = 0; k < attempts(); k++) {
    int before = open_fds();
    int32_t answer = attempt(k);
    printf("attempt %d: %d, descriptors %+d\n", k, answer, open_fds() - before);
  }
  char cut[108] = "build/test/";
  memset(cut + 11, 'p', 96);
  cut[107] = 0;
  const char *gone[] = {"build/test/nuf-mode.sock", "build/test/nuf-flags.sock", "build/test/nuf-chmodfail.sock",
                        "build/test/nuf-cycle.sock", "build/test/nuf-idle.sock", "build/test/nuf-missing.sock",
                        "build/test/nuf-held.sock", cut};
  const char *kinds[] = {"listen", "connect", "accept", "pair 0", "pair 1", "seqpacket 0", "seqpacket 1"};
  int32_t fds[7];
  for (int32_t k = 0; k < 7; k++) {
    fds[k] = hold(k, k > 0 ? fds[0] : -1);
    printf("%s %d: cloexec %d nonblock %d\n", kinds[k], fds[k] >= 0, (fcntl(fds[k], F_GETFD) & FD_CLOEXEC) != 0,
           (fcntl(fds[k], F_GETFL) & O_NONBLOCK) != 0);
  }
  for (int32_t k = 0; k < 7; k++) {
    close(fds[k]);
  }
  printf("release %d\n", release());
  int left = 0;
  struct stat st;
  for (size_t i = 0; i < sizeof gone / sizeof gone[0]; i++) {
    if (lstat(gone[i], &st) == 0) {
      printf("left behind: %s\n", gone[i]);
      left++;
    }
  }
  printf("left behind %d\n", left);
  printf("tearDown %d\n", tearDown(live));
  return 0;
}
