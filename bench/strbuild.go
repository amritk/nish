// Go twin of strbuild.ts: the same 32-way join tree over immutable strings.
// Go strings are immutable, so `s = s + piece(i)` allocates a fresh one per
// concatenation and drops its inputs, the same work as strbuild_naive.c and
// the Rust twin; the garbage collector, not an arena, reclaims them.
// (`strings.Builder` would grow one buffer in place instead and is O(n).)
// `strconv.Itoa(i) + ","` is the direct transliteration of the `${i},`
// template literal; `fmt.Sprintf` would time the formatter instead.
package main

import (
	"fmt"
	"strconv"
)

const N = 131072 // bench:n
const FANOUT = 32

func piece(i int32) string {
	return strconv.Itoa(int(i)) + ","
}

func join(lo int32, hi int32) string {
	count := hi - lo
	if count <= FANOUT {
		s := ""
		for i := lo; i < hi; i++ {
			s = s + piece(i)
		}
		return s
	}
	step := (count + FANOUT - 1) / FANOUT
	s := ""
	for start := lo; start < hi; start += step {
		end := hi
		if start+step < hi {
			end = start + step
		}
		s = s + join(start, end)
	}
	return s
}

func main() {
	s := join(0, N)
	fmt.Println(len(s))
}
