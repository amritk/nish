// Go twin of par-nbody.ts: 1024 bodies, 16 steps, each step one map over 3n
// probes (one per body and axis) cut into one contiguous chunk per core, each
// chunk a goroutine joined by a sync.WaitGroup and the first run on the
// calling goroutine. The bodies are read and never written inside the map;
// the step that moves them runs on one goroutine afterwards. Every sum is
// taken in the order the Nish program takes it, so the energies agree.
package main

import (
	"fmt"
	"math"
	"runtime"
	"sync"
)

const n = 1024 // bench:n
const steps = 16
const softening = 0.01

type body struct {
	x, y, z, vx, vy, vz, mass float64
}

// accel is body k / 3's acceleration along axis k % 3.
func accel(bodies []body, k int) float64 {
	bi := &bodies[k/3]
	axis := k % 3
	a := 0.0
	for j := range bodies {
		bj := &bodies[j]
		dx := bj.x - bi.x
		dy := bj.y - bi.y
		dz := bj.z - bi.z
		d2 := dx*dx + dy*dy + dz*dz + softening
		inv := bj.mass / (d2 * math.Sqrt(d2))
		d := dz
		if axis == 0 {
			d = dx
		} else if axis == 1 {
			d = dy
		}
		a = a + d*inv
	}
	return a
}

func energy(bodies []body) float64 {
	e := 0.0
	for i := range bodies {
		bi := &bodies[i]
		e = e + 0.5*bi.mass*(bi.vx*bi.vx+bi.vy*bi.vy+bi.vz*bi.vz)
		for j := i + 1; j < len(bodies); j++ {
			bj := &bodies[j]
			dx := bi.x - bj.x
			dy := bi.y - bj.y
			dz := bi.z - bj.z
			e = e - (bi.mass*bj.mass)/math.Sqrt(dx*dx+dy*dy+dz*dz+softening)
		}
	}
	return e
}

func mapChunk(bodies []body, acc []float64, lo int) {
	for o := range acc {
		acc[o] = accel(bodies, lo+o)
	}
}

func main() {
	dt := 0.001
	bodies := make([]body, 0, n)
	seed := 0.5
	for i := 0; i < n; i++ {
		// A fixed pseudo-random cloud, the same on every run and in every language.
		seed = seed * 3.9 * (1.0 - seed)
		x := seed * 10.0
		seed = seed * 3.9 * (1.0 - seed)
		y := seed * 10.0
		seed = seed * 3.9 * (1.0 - seed)
		z := seed * 10.0
		bodies = append(bodies, body{x: x, y: y, z: z, mass: 1.0 + seed})
	}
	acc := make([]float64, 3*n)
	// GOMAXPROCS, which bench/run.mjs sets to the count Nish divides over.
	threads := runtime.GOMAXPROCS(0)
	chunk := (len(acc) + threads - 1) / threads
	fmt.Println(energy(bodies))
	var wg sync.WaitGroup
	for s := 0; s < steps; s++ {
		for lo := chunk; lo < len(acc); lo += chunk {
			hi := min(lo+chunk, len(acc))
			wg.Add(1)
			go func() {
				defer wg.Done()
				mapChunk(bodies, acc[lo:hi], lo)
			}()
		}
		mapChunk(bodies, acc[:min(chunk, len(acc))], 0)
		wg.Wait()
		for i := range bodies {
			b := &bodies[i]
			b.vx = b.vx + dt*acc[3*i]
			b.vy = b.vy + dt*acc[3*i+1]
			b.vz = b.vz + dt*acc[3*i+2]
		}
		for i := range bodies {
			b := &bodies[i]
			b.x = b.x + dt*b.vx
			b.y = b.y + dt*b.vy
			b.z = b.z + dt*b.vz
		}
	}
	fmt.Println(energy(bodies))
}
