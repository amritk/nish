/* Driver for cg_sec_recursion_willreturn: `test()`, then each recursion that
   never ends in a child process with a two-second alarm. A call that is kept
   recurses until the stack runs out (or spins until the alarm), so the child
   dies of a signal; a call `opt` deleted lets the child return at once. */
#include <stdint.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int32_t test(void);
int32_t selfSpin(void);
int32_t mutualSpin(void);

static void expectNoReturn(const char *name, int32_t (*run)(void)) {
  fflush(stdout);
  pid_t pid = fork();
  if (pid == 0) {
    alarm(2);
    printf("%s returned %d\n", name, run());
    fflush(stdout);
    _exit(0);
  }
  int status = 0;
  waitpid(pid, &status, 0);
  printf("%s %s\n", name, WIFSIGNALED(status) ? "did not return" : "exited");
}

int main(void) {
  printf("%d\n", test());
  expectNoReturn("selfSpin", selfSpin);
  expectNoReturn("mutualSpin", mutualSpin);
  return 0;
}
