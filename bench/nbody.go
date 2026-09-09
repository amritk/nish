// Go twin of nbody.ts: the same struct, the same expression order, the bodies
// in a heap-allocated []*Body as they are in nbody.c and in the AmritScript
// arena. math.Sqrt is an intrinsic, so it is the same sqrtsd instruction.
package main

import (
	"fmt"
	"math"
)

const N = 20000000 // bench:n

type Body struct {
	x, y, z, vx, vy, vz, mass float64
}

func advance(bodies []*Body, n int32, dt float64) {
	for i := int32(0); i < n; i++ {
		bi := bodies[i]
		for j := i + 1; j < n; j++ {
			bj := bodies[j]
			dx := bi.x - bj.x
			dy := bi.y - bj.y
			dz := bi.z - bj.z
			d2 := dx*dx + dy*dy + dz*dz
			mag := dt / (d2 * math.Sqrt(d2))
			bi.vx = bi.vx - dx*bj.mass*mag
			bi.vy = bi.vy - dy*bj.mass*mag
			bi.vz = bi.vz - dz*bj.mass*mag
			bj.vx = bj.vx + dx*bi.mass*mag
			bj.vy = bj.vy + dy*bi.mass*mag
			bj.vz = bj.vz + dz*bi.mass*mag
		}
	}
	for i := int32(0); i < n; i++ {
		b := bodies[i]
		b.x = b.x + dt*b.vx
		b.y = b.y + dt*b.vy
		b.z = b.z + dt*b.vz
	}
}

func energy(bodies []*Body, n int32) float64 {
	e := 0.0
	for i := int32(0); i < n; i++ {
		bi := bodies[i]
		e = e + 0.5*bi.mass*(bi.vx*bi.vx+bi.vy*bi.vy+bi.vz*bi.vz)
		for j := i + 1; j < n; j++ {
			bj := bodies[j]
			dx := bi.x - bj.x
			dy := bi.y - bj.y
			dz := bi.z - bj.z
			e = e - (bi.mass*bj.mass)/math.Sqrt(dx*dx+dy*dy+dz*dz)
		}
	}
	return e
}

func body(x, y, z, vx, vy, vz, mass float64) *Body {
	return &Body{x: x, y: y, z: z, vx: vx, vy: vy, vz: vz, mass: mass}
}

func main() {
	// Typed variables, not Go constants: an untyped constant expression would
	// be folded in arbitrary precision and rounded once, where C, Rust and
	// AmritScript round every step to f64. One ULP here moves the last digits
	// of the final energy, the system being chaotic.
	pi := 3.141592653589793
	solarMass := 4 * pi * pi
	days := 365.24
	bodies := []*Body{
		body(0, 0, 0, 0, 0, 0, solarMass),
		body(4.8414314424647209, -1.16032004402742839, -0.103622044471123109, 0.00166007664274403694*days, 0.00769901118419740425*days, -0.0000690460016972063023*days, 0.000954791938424326609*solarMass),
		body(8.34336671824457987, 4.12479856412430479, -0.403523417114321381, -0.00276742510726862411*days, 0.00499852801234917238*days, 0.0000230417297573763929*days, 0.000285885980666130812*solarMass),
		body(12.894369562139131, -15.1111514016986312, -0.223307578892655734, 0.00296460137564761618*days, 0.0023784717395948095*days, -0.0000296589568540237556*days, 0.0000436624404335156298*solarMass),
		body(15.3796971148509165, -25.9193146099879641, 0.179258772950371181, 0.00268067772490389322*days, 0.00162824170038242295*days, -0.000095159225451971587*days, 0.0000515138902046611451*solarMass),
	}
	n := int32(5)
	px, py, pz := 0.0, 0.0, 0.0
	for i := int32(0); i < n; i++ {
		px = px + bodies[i].vx*bodies[i].mass
		py = py + bodies[i].vy*bodies[i].mass
		pz = pz + bodies[i].vz*bodies[i].mass
	}
	bodies[0].vx = -px / solarMass
	bodies[0].vy = -py / solarMass
	bodies[0].vz = -pz / solarMass
	fmt.Println(energy(bodies, n))
	for k := int32(0); k < N; k++ {
		advance(bodies, n, 0.01)
	}
	fmt.Println(energy(bodies, n))
}
