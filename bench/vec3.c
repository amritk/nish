/* C twin of vec3.ts: the same methods as static functions over a heap struct. */
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#define N 50000000 /* bench:n */

typedef struct {
  double x, y, z;
} Vec3;

static Vec3 *vec3(double x, double y, double z) {
  Vec3 *v = malloc(sizeof *v);
  v->x = x; v->y = y; v->z = z;
  return v;
}
static void add(Vec3 *t, const Vec3 *o) {
  t->x = t->x + o->x;
  t->y = t->y + o->y;
  t->z = t->z + o->z;
}
static void addScaled(Vec3 *t, const Vec3 *o, double s) {
  t->x = t->x + o->x * s;
  t->y = t->y + o->y * s;
  t->z = t->z + o->z * s;
}
static double dot(const Vec3 *t, const Vec3 *o) { return t->x * o->x + t->y * o->y + t->z * o->z; }
static void crossInto(const Vec3 *t, const Vec3 *o, Vec3 *out) {
  out->x = t->y * o->z - t->z * o->y;
  out->y = t->z * o->x - t->x * o->z;
  out->z = t->x * o->y - t->y * o->x;
}
static double norm(const Vec3 *t) { return sqrt(dot(t, t)); }

int main(void) {
  const double DT = 0.0000001;
  Vec3 *p = vec3(0, 0, 0);
  Vec3 *v = vec3(1, 2, 3);
  Vec3 *g = vec3(0, -0.0000001, 0);
  Vec3 *kick = vec3(0, 0, 0);
  double energy = 0;
  for (int32_t i = 0; i < N; i++) {
    add(v, g);
    crossInto(v, g, kick);
    addScaled(v, kick, 0.001);
    addScaled(p, v, DT);
    energy = energy + 0.5 * dot(v, v) + norm(p) * DT;
  }
  printf("%.17g\n%.17g\n%.17g\n%.17g\n", p->x, p->y, p->z, energy);
  return 0;
}
