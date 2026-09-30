/* Driver for net_udp_bounds: `test()` in range, then each out-of-range call in
   a child whose stderr is this process's stdout, so the panic message and the
   exit status land in the .out file. */
#include <stdint.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int32_t test(void);
int32_t pastEnd(void);
int32_t negativeOffset(void);
int32_t negativeLength(void);

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
  expectPanic("pastEnd", pastEnd);
  expectPanic("negativeOffset", negativeOffset);
  expectPanic("negativeLength", negativeLength);
  return 0;
}
