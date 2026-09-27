/* The host half of interop_rng_host: a C caller the compiler cannot see. It
   keeps to each range first, then leaves one in a child whose stderr is this
   process's stdout, so the panic message and the exit status land in the .out
   file. C has no exception to catch, so the exported function's own check on
   entry is the one that fires (WP31 §9). */
#include <stdint.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int32_t pick(int32_t base, int32_t day);
int32_t low(int32_t x);
int32_t lastDigit(int32_t n);

static int32_t pickEight(void) { return pick(5, 8); }
static int32_t lowPastTop(void) { return low(128); }

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
  printf("%d %d %d %d\n", pick(5, 3), low(-128), low(127), lastDigit(-7));
  expectPanic("pick(5, 8)", pickEight);
  expectPanic("low(128)", lowPastTop);
  return 0;
}
