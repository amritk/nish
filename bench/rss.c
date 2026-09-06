/* Peak resident set size of one program run, for bench/run.mjs.
 *
 *   rss <exe> [args...]      runs the program with stdout discarded and prints
 *                            its ru_maxrss in KB; exits with the program's status
 *
 * A dedicated helper because `/usr/bin/time` is not installed everywhere and
 * an interpreter's fork carries the interpreter's own pages into the child's
 * accounting. Linux reports ru_maxrss in KB, macOS in bytes. */
#include <stdio.h>
#include <stdlib.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <unistd.h>

int main(int argc, char **argv) {
  if (argc < 2) {
    fprintf(stderr, "usage: rss <exe> [args...]\n");
    return 2;
  }
  pid_t pid = fork();
  if (pid < 0) return 1;
  if (pid == 0) {
    if (!freopen("/dev/null", "w", stdout)) _exit(127);
    execvp(argv[1], argv + 1);
    _exit(127);
  }
  int status;
  struct rusage ru;
  if (wait4(pid, &status, 0, &ru) < 0) return 1;
#ifdef __APPLE__
  long kb = ru.ru_maxrss / 1024;
#else
  long kb = ru.ru_maxrss;
#endif
  printf("%ld\n", kb);
  return WIFEXITED(status) ? WEXITSTATUS(status) : 1;
}
