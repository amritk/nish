/* Driver for cg_sec_compound_grow: `test()` and `bitwise()`, then the store a
   shrinking right side would put past the new length, in a child whose stderr
   is this process's stdout, so the panic and its exit status land in .out. */
#include <stdint.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int32_t test(void);
int32_t bitwise(void);
int32_t shrunk(void);

int main(void) {
  printf("%d\n", test());
  printf("%d\n", bitwise());
  fflush(stdout);
  pid_t pid = fork();
  if (pid == 0) {
    dup2(1, 2);
    printf("shrunk returned %d\n", shrunk());
    fflush(stdout);
    _exit(0);
  }
  int status = 0;
  waitpid(pid, &status, 0);
  printf("shrunk exit %d\n", WIFEXITED(status) ? WEXITSTATUS(status) : -1);
  return 0;
}
