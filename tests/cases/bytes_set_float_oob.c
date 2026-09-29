/* Driver for bytes_set_float_oob: `test()` with a NaN offset, which is 0, then
   each offset that saturates out of range in a child whose stderr is this
   process's stdout, so the panic message and the exit status land in the .out
   file. */
#include <stdint.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int32_t test(void);
int32_t huge(void);
int32_t infinite(void);
int32_t negativeInfinite(void);

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
  expectPanic("huge", huge);
  expectPanic("infinite", infinite);
  expectPanic("negativeInfinite", negativeInfinite);
  return 0;
}
