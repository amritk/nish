// Go twin of par-compute.ts: the same 64 square roots per element, the array
// cut into one contiguous chunk per core, each chunk a goroutine joined by a
// sync.WaitGroup and the first run on the calling goroutine. The checksum is
// the sum of the results in index order, on one goroutine.
package main

import (
	"fmt"
	"math"
	"runtime"
	"sync"
)

const N = 2097152 // bench:n

func settle(x float64) float64 {
	v := x
	for k := 0; k < 64; k++ {
		v = math.Sqrt(v*v+1.0) - 0.5*v
	}
	return v
}

func mapChunk(src, dst []float64) {
	for i, v := range src {
		dst[i] = settle(v)
	}
}

func main() {
	src := make([]float64, N)
	x := 0.0
	for i := range src {
		src[i] = x
		x += 0.000001
	}
	dst := make([]float64, N)
	threads := runtime.NumCPU()
	chunk := (N + threads - 1) / threads
	var wg sync.WaitGroup
	for lo := chunk; lo < N; lo += chunk {
		hi := min(lo+chunk, N)
		wg.Add(1)
		go func() {
			defer wg.Done()
			mapChunk(src[lo:hi], dst[lo:hi])
		}()
	}
	mapChunk(src[:min(chunk, N)], dst[:min(chunk, N)])
	wg.Wait()
	sum := 0.0
	for _, d := range dst {
		sum += d
	}
	fmt.Println(sum)
}
