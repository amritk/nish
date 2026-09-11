// Go twin of vec3.ts: the same methods on a heap-allocated *Vec3 (like the
// arena objects in Nish and the Box<Vec3> in the Rust twin), the same
// expression order. Nothing is allocated inside the loop.
package main

import (
	"fmt"
	"math"
)

const N = 50000000 // bench:n

type Vec3 struct {
	x, y, z float64
}

func vec3(x, y, z float64) *Vec3 {
	return &Vec3{x: x, y: y, z: z}
}

func (t *Vec3) add(o *Vec3) {
	t.x = t.x + o.x
	t.y = t.y + o.y
	t.z = t.z + o.z
}

func (t *Vec3) addScaled(o *Vec3, s float64) {
	t.x = t.x + o.x*s
	t.y = t.y + o.y*s
	t.z = t.z + o.z*s
}

func (t *Vec3) dot(o *Vec3) float64 {
	return t.x*o.x + t.y*o.y + t.z*o.z
}

func (t *Vec3) crossInto(o *Vec3, out *Vec3) {
	out.x = t.y*o.z - t.z*o.y
	out.y = t.z*o.x - t.x*o.z
	out.z = t.x*o.y - t.y*o.x
}

func (t *Vec3) norm() float64 {
	return math.Sqrt(t.dot(t))
}

func main() {
	const dt = 0.0000001
	p := vec3(0, 0, 0)
	v := vec3(1, 2, 3)
	g := vec3(0, -0.0000001, 0)
	kick := vec3(0, 0, 0)
	energy := 0.0
	for i := int32(0); i < N; i++ {
		v.add(g)
		v.crossInto(g, kick)
		v.addScaled(kick, 0.001)
		p.addScaled(v, dt)
		energy = energy + 0.5*v.dot(v) + p.norm()*dt
	}
	fmt.Println(p.x)
	fmt.Println(p.y)
	fmt.Println(p.z)
	fmt.Println(energy)
}
