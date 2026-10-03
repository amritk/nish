/* Driver for cg_sec_new_array_negative: `test()` in range, then each negative
   length in a child whose stderr is this process's stdout, so the message and
   the exit status (or the signal, which is the bug) land in the .out file. */
#include <stdint.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int32_t test(void);
int32_t bytes(void);
int32_t doubles(void);

static void expectRefusal(const char *name, int32_t (*run)(void)) {
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
  if (WIFEXITED(status)) {
    printf("%s exit %d\n", name, WEXITSTATUS(status));
  } else {
    printf("%s signal %d\n", name, WIFSIGNALED(status) ? WTERMSIG(status) : -1);
  }
}

int main(void) {
  printf("%d\n", test());
  expectRefusal("bytes", bytes);
  expectRefusal("doubles", doubles);
  return 0;
}
