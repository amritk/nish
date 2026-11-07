/* Driver for net_write2_bounds: `test()` in range, then each out-of-range call
   in a child whose stderr is this process's stdout, so the panic message and
   the exit status land in the .out file. Then the runtime's own half: this
   file's `sendmsg` stands in for libc's, and for descriptor SEEN it prints the
   message `nish_net_write2` built instead of sending it, so the iovec, the
   MSG_NOSIGNAL flag and the clamp of a sum past INT32_MAX are pinned without a
   2 GiB array. Every other descriptor goes to the kernel. */
#include <stdint.h>
#include <stdio.h>
#include <sys/socket.h>
#include <sys/syscall.h>
#include <sys/uio.h>
#include <sys/wait.h>
#include <unistd.h>

typedef struct {
  int64_t len, cap;
  char *data;
} nish_array;

int32_t nish_net_write2(int32_t fd, const nish_array *a, int64_t aoff, int64_t alen,
                        const nish_array *b, int64_t boff, int64_t blen);

enum { SEEN = 1000 };
static char bytes_a[8], bytes_b[8];

ssize_t sendmsg(int fd, const struct msghdr *msg, int flags) {
  if (fd != SEEN) return syscall(SYS_sendmsg, fd, msg, flags);
  ssize_t sum = 0;
  printf("sendmsg: %d iovecs, nosignal %d", (int)msg->msg_iovlen, (flags & MSG_NOSIGNAL) != 0);
  for (size_t i = 0; i < (size_t)msg->msg_iovlen; i++) {
    const struct iovec *v = &msg->msg_iov[i];
    const char *base = i == 0 ? bytes_a : bytes_b;
    printf(", [+%td, %zu)", (const char *)v->iov_base - base, v->iov_len);
    sum += (ssize_t)v->iov_len;
  }
  printf("\n");
  return sum;
}

int32_t test(void);
int32_t firstPastEnd(void);
int32_t secondPastEnd(void);
int32_t secondNegative(void);

static void expectPanic(const char *name, int32_t (*run)(void)) {
  fflush(stdout);
  pid_t pid = fork();
  if (pid == 0) {
    dup2(1, 2);
    printf("%s returned %d\n", name, run());
    fflush(stdout);
    _exit(0);
  }
  int status = 0;
  waitpid(pid, &status, 0);
  printf("%s exit %d\n", name, WIFEXITED(status) ? WEXITSTATUS(status) : -1);
}

int main(void) {
  printf("%d\n", test());
  expectPanic("firstPastEnd", firstPastEnd);
  expectPanic("secondPastEnd", secondPastEnd);
  expectPanic("secondNegative", secondNegative);
  nish_array a = {8, 8, bytes_a}, b = {8, 8, bytes_b};
  printf("answer %d\n", nish_net_write2(SEEN, &a, 1, 4, &b, 2, 3));
  /* Lengths a real call could pass (each at most INT32_MAX, as an array is),
     whose sum is past it: the second is offered only up to INT32_MAX. */
  printf("answer %d\n", nish_net_write2(SEEN, &a, 0, INT32_MAX - 5, &b, 0, 100));
  printf("answer %d\n", nish_net_write2(SEEN, &a, 0, INT32_MAX, &b, 0, INT32_MAX));
  return 0;
}
