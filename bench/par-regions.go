// Go twin of par-regions.ts: a 2^17-element map called a thousand times, each
// call fed by the last. Every call starts one goroutine per core but the
// first, whose chunk the calling goroutine maps, and waits on a
// sync.WaitGroup; goroutines are cheap to start, so this is Go's idiom for a
// region rather than a pool.
package main

import (
	"fmt"
	"runtime"
	"sync"
)

const rounds = 1000 // bench:n
const n = 131072

func scramble(x int32) int32 {
	h := x
	for k := int32(0); k < 8; k++ {
		h ^= h << 5
		h ^= h >> 3
		h ^= k
	}
	return h
}

func mapChunk(src, dst []int32) {
	for i, v := range src {
		dst[i] = scramble(v)
	}
}

func main() {
	src := make([]int32, n)
	for i := range src {
		src[i] = int32(i)
	}
	dst := make([]int32, n)
	// GOMAXPROCS, which bench/run.mjs sets to the count Nish divides over.
	threads := runtime.GOMAXPROCS(0)
	chunk := (n + threads - 1) / threads
	check := int32(0)
	var wg sync.WaitGroup
	for r := 0; r < rounds; r++ {
		for lo := chunk; lo < n; lo += chunk {
			hi := min(lo+chunk, n)
			wg.Add(1)
			go func() {
				defer wg.Done()
				mapChunk(src[lo:hi], dst[lo:hi])
			}()
		}
		mapChunk(src[:min(chunk, n)], dst[:min(chunk, n)])
		wg.Wait()
		at := (r * 7919) % n
		check ^= dst[at]
		src[at] = dst[at]
	}
	sum := int32(0)
	for _, d := range dst {
		sum ^= d
	}
	fmt.Println(sum, check)
}
