// Runs a program and prints its peak resident set to stderr, as
// `peak <kilobytes>`: wait4's ru_maxrss for that one child. run.mjs uses it
// because node's spawnSync does not report a child's resource usage.
//
//   peak <program> [args...]
#include <stdio.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <unistd.h>

int main(int argc, char **argv) {
  if (argc < 2) {
    fprintf(stderr, "usage: peak <program> [args...]\n");
    return 2;
  }
  pid_t pid = fork();
  if (pid < 0) {
    perror("fork");
    return 2;
  }
  if (pid == 0) {
    execv(argv[1], argv + 1);
    perror("execv");
    _exit(127);
  }
  int status = 0;
  struct rusage usage;
  if (wait4(pid, &status, 0, &usage) < 0) {
    perror("wait4");
    return 2;
  }
  fprintf(stderr, "peak %ld\n", usage.ru_maxrss);
  return WIFEXITED(status) ? WEXITSTATUS(status) : 1;
}
