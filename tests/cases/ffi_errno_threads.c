/* Driver for ffi_errno_threads: two threads each call `stage` with their own
 * errno, wait at a barrier until both have, then read `readErrno`. A shared
 * slot would give both threads the value written last. */
#include <errno.h>
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
int32_t stage(int32_t e);
int32_t readErrno(void);
int32_t set_errno_to(int32_t e) {
  errno = e;
  return e;
}
static pthread_barrier_t both_staged;
static int32_t seen[2];
static void *worker(void *arg) {
  int32_t i = (int32_t)(intptr_t)arg;
  stage(i == 0 ? EDOM : ERANGE);
  pthread_barrier_wait(&both_staged);
  seen[i] = readErrno();
  return NULL;
}
int main(void) {
  pthread_t t[2];
  pthread_barrier_init(&both_staged, NULL, 2);
  for (intptr_t i = 0; i < 2; i++) pthread_create(&t[i], NULL, worker, (void *)i);
  for (int i = 0; i < 2; i++) pthread_join(t[i], NULL);
  printf("thread 0: %d\nthread 1: %d\nmain: %d\n", seen[0], seen[1], readErrno());
  return 0;
}
