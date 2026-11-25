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
enum mix_kind { MIX_A, MIX_B };
typedef float mix_wide __attribute__((aligned(16)));
typedef float *mix_wide_ptr __attribute__((aligned(16)));
int mix_enum(enum mix_kind *out, size_t n);
int mix_aligned(mix_wide *out, size_t n);
int mix_aligned_ptr(mix_wide_ptr out, size_t n);
