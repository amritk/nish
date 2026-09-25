/* Adapted from the Computer Language Benchmarks Game n-body program (Node.js #6,
   contributed by Isaac Gouy, modified by Andrey Filatkin),
   https://benchmarksgame-team.pages.debian.net/benchmarksgame/.
   Copyright (c) 2004-2008 Brent Fulgham, 2005-2025 Isaac Gouy.
   Revised BSD licence; see bench/LICENSE-benchmarksgame.md. */
/* C twin of nbody.ts: same struct, same expression order, bodies in a heap array. */
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#define N 20000000 /* bench:n */

typedef struct {
  double x, y, z, vx, vy, vz, mass;
} Body;

static void advance(Body **bodies, int32_t n, double dt) {
  for (int32_t i = 0; i < n; i++) {
    Body *bi = bodies[i];
    for (int32_t j = i + 1; j < n; j++) {
      Body *bj = bodies[j];
      double dx = bi->x - bj->x;
      double dy = bi->y - bj->y;
      double dz = bi->z - bj->z;
      double d2 = dx * dx + dy * dy + dz * dz;
      double mag = dt / (d2 * sqrt(d2));
      bi->vx = bi->vx - dx * bj->mass * mag;
      bi->vy = bi->vy - dy * bj->mass * mag;
      bi->vz = bi->vz - dz * bj->mass * mag;
      bj->vx = bj->vx + dx * bi->mass * mag;
      bj->vy = bj->vy + dy * bi->mass * mag;
      bj->vz = bj->vz + dz * bi->mass * mag;
    }
  }
  for (int32_t i = 0; i < n; i++) {
    Body *b = bodies[i];
    b->x = b->x + dt * b->vx;
    b->y = b->y + dt * b->vy;
    b->z = b->z + dt * b->vz;
  }
}

static double energy(Body **bodies, int32_t n) {
  double e = 0;
  for (int32_t i = 0; i < n; i++) {
    Body *bi = bodies[i];
    e = e + 0.5 * bi->mass * (bi->vx * bi->vx + bi->vy * bi->vy + bi->vz * bi->vz);
    for (int32_t j = i + 1; j < n; j++) {
      Body *bj = bodies[j];
      double dx = bi->x - bj->x;
      double dy = bi->y - bj->y;
      double dz = bi->z - bj->z;
      e = e - (bi->mass * bj->mass) / sqrt(dx * dx + dy * dy + dz * dz);
    }
  }
  return e;
}

static Body *body(double x, double y, double z, double vx, double vy, double vz, double mass) {
  Body *b = malloc(sizeof *b);
  b->x = x; b->y = y; b->z = z; b->vx = vx; b->vy = vy; b->vz = vz; b->mass = mass;
  return b;
}

int main(void) {
  const double PI = 3.141592653589793;
  const double SOLAR_MASS = 4 * PI * PI;
  const double DAYS = 365.24;
  Body *bodies[5] = {
    body(0, 0, 0, 0, 0, 0, SOLAR_MASS),
    body(4.8414314424647209, -1.16032004402742839, -0.103622044471123109, 0.00166007664274403694 * DAYS, 0.00769901118419740425 * DAYS, -0.0000690460016972063023 * DAYS, 0.000954791938424326609 * SOLAR_MASS),
    body(8.34336671824457987, 4.12479856412430479, -0.403523417114321381, -0.00276742510726862411 * DAYS, 0.00499852801234917238 * DAYS, 0.0000230417297573763929 * DAYS, 0.000285885980666130812 * SOLAR_MASS),
    body(12.894369562139131, -15.1111514016986312, -0.223307578892655734, 0.00296460137564761618 * DAYS, 0.0023784717395948095 * DAYS, -0.0000296589568540237556 * DAYS, 0.0000436624404335156298 * SOLAR_MASS),
    body(15.3796971148509165, -25.9193146099879641, 0.179258772950371181, 0.00268067772490389322 * DAYS, 0.00162824170038242295 * DAYS, -0.000095159225451971587 * DAYS, 0.0000515138902046611451 * SOLAR_MASS),
  };
  const int32_t n = 5;
  double px = 0, py = 0, pz = 0;
  for (int32_t i = 0; i < n; i++) {
    px = px + bodies[i]->vx * bodies[i]->mass;
    py = py + bodies[i]->vy * bodies[i]->mass;
    pz = pz + bodies[i]->vz * bodies[i]->mass;
  }
  bodies[0]->vx = -px / SOLAR_MASS;
  bodies[0]->vy = -py / SOLAR_MASS;
  bodies[0]->vz = -pz / SOLAR_MASS;
  printf("%.17g\n", energy(bodies, n));
  for (int32_t k = 0; k < N; k++) {
    advance(bodies, n, 0.01);
  }
  printf("%.17g\n", energy(bodies, n));
  return 0;
}
