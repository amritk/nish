/* Driver for str_from_bytes_order: `test()` copies through an end that grew
   the array, then `shrunk` runs in a child whose stderr is this process's
   stdout, so the panic message and the exit status land in the .out file. */
#include <stdint.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int32_t test(void);
int32_t shrunk(void);

int main(void) {
  printf("%d\n", test());
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
