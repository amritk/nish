/* Named buffer pairs: the override file names each buffer's count. */
#include <stddef.h>
#include <stdint.h>
int put_u32(const void *data, uint32_t len);
int put_u16(uint16_t len, const void *data);
int put_u8(const char *data, uint8_t n);
int get_into(void *into, uint32_t *got);
int get_uchar(void *into, unsigned char *got);
int two_bufs(const void *a, const void *b, size_t n);
int positional(const void *data, size_t len);
