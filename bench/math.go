// Go twin of math.ts: the same tables, the same loops, the same lines.
// math.Min and math.Max already answer NaN for a NaN operand and order -0
// below +0, as JavaScript's do; math.Round rounds half away from zero, so
// jsRound spells out JavaScript's round-half-up with the input's sign.
// Go's tan, atan2 and hypot are its own, not libm's; every result is folded
// through float32, which is where the four twins agree.
package main

import (
	"fmt"
	"math"
	"os"
)

const N = 20000000 // bench:n
const SIZE = 4096

var specials = [16]float64{
	math.NaN(), 0, math.Copysign(0, -1), 0.5, -0.5, 2.5, -2.5, math.Inf(1), math.Inf(-1),
	0.49999999999999994, -0.49999999999999994, 4503599627370497, 1e300, -1e-300, 3, -7,
}

func mix(h, b int32) int32 { return int32(uint32(h^b) * 16777619) }

func bits(r float64) int32 {
	if r != r {
		return 2143289344
	}
	return int32(math.Float32bits(float32(r)))
}

func jsRound(x float64) float64 {
	r := math.Floor(x)
	if x-r >= 0.5 {
		r = r + 1
	}
	return math.Copysign(r, x)
}

func jsSign(x float64) float64 {
	if x > 0 {
		return 1
	}
	if x < 0 {
		return -1
	}
	return x
}

func intSign(x int32) int32 {
	if x > 0 {
		return 1
	}
	if x < 0 {
		return -1
	}
	return 0
}

var xs [SIZE]float64
var is [SIZE]int32

func main() {
	only := ""
	if len(os.Args) > 1 {
		only = os.Args[1]
	}
	wanted := func(name string) bool { return only == "" || only == name }
	s := uint32(1013904223)
	for j := int32(0); j < SIZE; j++ {
		s = s ^ (s << 13)
		s = s ^ (s >> 17)
		s = s ^ (s << 5)
		is[j] = int32(s)
		if j&15 == 0 {
			xs[j] = specials[(j>>4)&15]
		} else {
			xs[j] = float64(int32(s)) / 65536
		}
	}

	if wanted("atan2") {
		h := int32(-2128831035)
		for i := int32(0); i < N; i++ {
			h = mix(h, bits(math.Atan2(xs[i&4095], xs[(i+1237)&4095])))
		}
		fmt.Printf("atan2 %d\n", h)
	}
	if wanted("tan") {
		h := int32(-2128831035)
		for i := int32(0); i < N; i++ {
			h = mix(h, bits(math.Tan(xs[i&4095])))
		}
		fmt.Printf("tan %d\n", h)
	}
	if wanted("hypot") {
		h := int32(-2128831035)
		for i := int32(0); i < N; i++ {
			h = mix(h, bits(math.Hypot(xs[i&4095], xs[(i+1237)&4095])))
		}
		fmt.Printf("hypot %d\n", h)
	}
	if wanted("sign-int") {
		h := int32(-2128831035)
		for i := int32(0); i < 8*N; i++ {
			h = mix(h, intSign(is[i&4095]))
		}
		fmt.Printf("sign-int %d\n", h)
	}
	if wanted("sign-float") {
		h := int32(-2128831035)
		for i := int32(0); i < 8*N; i++ {
			h = mix(h, bits(jsSign(xs[i&4095])))
		}
		fmt.Printf("sign-float %d\n", h)
	}
	if wanted("imul") {
		h := int32(-2128831035)
		for i := int32(0); i < 8*N; i++ {
			h = mix(h, is[i&4095]*is[(i+1237)&4095])
		}
		fmt.Printf("imul %d\n", h)
	}
	if wanted("round") {
		h := int32(-2128831035)
		for i := int32(0); i < 8*N; i++ {
			h = mix(h, bits(jsRound(xs[i&4095])))
		}
		fmt.Printf("round %d\n", h)
	}
	if wanted("min") {
		h := int32(-2128831035)
		for i := int32(0); i < 8*N; i++ {
			h = mix(h, bits(math.Min(xs[i&4095], xs[(i+1237)&4095])))
		}
		fmt.Printf("min %d\n", h)
	}
	if wanted("max") {
		h := int32(-2128831035)
		for i := int32(0); i < 8*N; i++ {
			h = mix(h, bits(math.Max(xs[i&4095], xs[(i+1237)&4095])))
		}
		fmt.Printf("max %d\n", h)
	}
	if wanted("f32-to-bits") {
		h := int32(-2128831035)
		for i := int32(0); i < 8*N; i++ {
			h = mix(h, int32(math.Float32bits(float32(xs[i&4095]))))
		}
		fmt.Printf("f32-to-bits %d\n", h)
	}
}
