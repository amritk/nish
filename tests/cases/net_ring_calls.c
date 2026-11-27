/* Driver for net_ring_calls: the ring bit is 8 and the wide bit 16, the
   state is 0 until a ring listen decides it, flags up to 15 listen, 16
   without 8 is -22, 24 and 31 listen and 32 is -22, an empty ring
   accept is -11, and a slot handle no listener issued is -9 to every call
   that takes one. Darwin has no io_uring, so its state answers -95 from the
   start; the driver prints Linux's lines for it only when it does. */
#include <stdint.h>
#include <stdio.h>

int32_t state(void);
int32_t ringBit(void);
int32_t wideBit(void);
int32_t listenWith(int32_t flags);
int32_t emptyAccept(void);
int32_t readOf(int32_t h);
int32_t writeOf(int32_t h);
int32_t closeOf(int32_t h);
int32_t pollOf(int32_t h);
int32_t sendOf(int32_t h);

static int decided(int32_t s) {
#if defined(__linux__)
  return s == 1 || s < 0;
#else
  return s == -95;
#endif
}

int main(void) {
  printf("ring bit: %d\n", ringBit());
  printf("wide bit: %d\n", wideBit());
#if defined(__linux__)
  printf("before a listen: %d\n", state());
#else
  printf("before a listen: %d\n", state() == -95 ? 0 : state());
#endif
  printf("flags 8: %d\n", listenWith(8));
  printf("decided after: %s\n", decided(state()) ? "yes" : "no");
  printf("flags 15: %d\n", listenWith(15));
  printf("flags 16: %d\n", listenWith(16));
  printf("flags 24: %d\n", listenWith(24));
  printf("flags 31: %d\n", listenWith(31));
  printf("flags 32: %d\n", listenWith(32));
  printf("flags -1: %d\n", listenWith(-1));
  printf("empty accept: %d\n", emptyAccept());
  /* 2^20 is the first slot handle; 2^30 + 5 and INT32_MAX lie past every
     listener this process has made. */
  int32_t hs[] = {1 << 20, (1 << 30) + 5, INT32_MAX};
  for (int i = 0; i < 3; i++) {
    int32_t h = hs[i];
    printf("handle %d: read %d write %d poll %d send %d close %d\n", h, readOf(h), writeOf(h), pollOf(h), sendOf(h),
           closeOf(h));
  }
  return 0;
}
