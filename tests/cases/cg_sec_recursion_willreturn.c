/* Driver for cg_sec_recursion_willreturn: `test()`, then each call that must
   never return in a child with a one-second alarm. The child dying of SIGALRM
   is the right answer; "returned" is the call LLVM deleted. */
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int32_t test(void);
int32_t selfCall(void);
int32_t mutualCall(void);

static void expectHang(const char *name, int32_t (*run)(void)) {
  fflush(stdout);
  pid_t pid = fork();
  if (pid == 0) {
    alarm(1);
    printf("%s returned %d\n", name, run());
    fflush(stdout);
    _exit(0);
  }
  int status = 0;
  waitpid(pid, &status, 0);
  if (WIFSIGNALED(status)) {
    printf("%s killed by signal %d\n", name, WTERMSIG(status));
  } else {
    printf("%s exit %d\n", name, WIFEXITED(status) ? WEXITSTATUS(status) : -1);
  }
}

int main(void) {
  printf("%d\n", test());
  expectHang("selfCall", selfCall);
  expectHang("mutualCall", mutualCall);
  return 0;
}
