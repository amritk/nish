/* WP89 S2: pointers to the numeric scalars a declared function borrows as
 * typed buffers, each counted in elements. */
#include <stddef.h>
#include <stdint.h>
int upload_f32(const float *verts, size_t n);
int fill_f32(float *out, size_t n);
int upload_u16(const uint16_t *indices, size_t n);
int fill_u32(uint32_t *out, size_t n);
int fill_i32(int32_t *out, size_t n);
int upload_counted(size_t n, const float *verts);
int read_counted(float *out, uint32_t *got);
int mix_f64(double *out, size_t n);
int mix_i16(int16_t *out, size_t n);
int mix_i64(int64_t *out, size_t n);
