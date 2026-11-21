/* Driver and callees for ffi_buffer_counted_by_panic: each callee prints when
 * it runs, and each over-long call runs in a child whose stderr is this
 * process's stdout, so the panic message, the missing callee line and the exit
 * status all land in the .out file. */
#include <stdint.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

uint32_t c_narrow(unsigned short n, const unsigned char *src) {
  (void)src;
  printf("c_narrow ran with %u\n", (unsigned)n);
  return 0;
}
int32_t c_wide(unsigned char *dst, uint32_t n) {
  (void)dst;
  printf("c_wide ran with %u\n", n);
  return 0;
}
int32_t c_out(unsigned char *dest, uint64_t *destLen) {
  (void)dest;
  printf("c_out ran with %llu\n", (unsigned long long)*destLen);
  return 0;
}

int32_t narrow(void);
int32_t narrowHigh(void);
int32_t wide(void);
int32_t out(void);

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
  expectPanic("narrow", narrow);
  expectPanic("narrowHigh", narrowHigh);
  expectPanic("wide", wide);
  expectPanic("out", out);
  return 0;
}
