// Adapted from the Computer Language Benchmarks Game spectral-norm program
// (Node.js #1, contributed by Ian Osgood, modified by Isaac Gouy),
// https://benchmarksgame-team.pages.debian.net/benchmarksgame/.
// Copyright (c) 2004-2008 Brent Fulgham, 2005-2025 Isaac Gouy.
// Revised BSD licence; see bench/LICENSE-benchmarksgame.md.
// Go twin of spectral.ts: same loops and evaluation order, []float64 indexed
// by an int32 (bounds-checked, as in Nish).
package main

import (
	"fmt"
	"math"
)

const N = 3000 // bench:n

func a(i int32, j int32) float64 {
	ij := i + j
	return 1 / float64(ij*(ij+1)/2+i+1)
}

func mulAv(n int32, v []float64, av []float64) {
	for i := int32(0); i < n; i++ {
		s := 0.0
		for j := int32(0); j < n; j++ {
			s = s + a(i, j)*v[j]
		}
		av[i] = s
	}
}

func mulAtv(n int32, v []float64, atv []float64) {
	for i := int32(0); i < n; i++ {
		s := 0.0
		for j := int32(0); j < n; j++ {
			s = s + a(j, i)*v[j]
		}
		atv[i] = s
	}
}

func mulAtAv(n int32, v []float64, out []float64, tmp []float64) {
	mulAv(n, v, tmp)
	mulAtv(n, tmp, out)
}

func main() {
	n := int32(N)
	u := make([]float64, n)
	v := make([]float64, n)
	tmp := make([]float64, n)
	for i := int32(0); i < n; i++ {
		u[i] = 1
	}
	for k := 0; k < 10; k++ {
		mulAtAv(n, u, v, tmp)
		mulAtAv(n, v, u, tmp)
	}
	vBv := 0.0
	vv := 0.0
	for i := int32(0); i < n; i++ {
		vBv = vBv + u[i]*v[i]
		vv = vv + v[i]*v[i]
	}
	fmt.Println(math.Sqrt(vBv / vv))
}
