/* Driver for cg_sec_compound_element_order: `test()`, then the store whose
   right side shrank the array in a child whose stderr is this process's
   stdout, so the panic message and the exit status land in the .out file. */
#include <stdint.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int32_t test(void);
int32_t shrinkPastEnd(void);

int main(void) {
  printf("%d\n", test());
  fflush(stdout);
  pid_t pid = fork();
  if (pid == 0) {
    dup2(1, 2);
    printf("shrinkPastEnd returned %d\n", shrinkPastEnd());
    fflush(stdout);
    _exit(0);
  }
  int status = 0;
  waitpid(pid, &status, 0);
  printf("shrinkPastEnd exit %d\n", WIFEXITED(status) ? WEXITSTATUS(status) : -1);
  return 0;
}
