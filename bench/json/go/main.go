// Go, two ways, chosen by the second argument:
//
//	std    — encoding/json into a struct of the three fields, the standard
//	         library's answer: every other field is skipped without being built.
//	gjson  — github.com/tidwall/gjson, which reads a path out of the bytes
//	         without building anything: the same kind of reader as std/json.
//
// Same fields and checksum as bench/json/json.ts.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/tidwall/gjson"
)

const mask = 1073741823

type diagnostic struct {
	Code    string `json:"code"`
	Line    int64  `json:"line"`
	Message string `json:"message"`
}

func main() {
	data, err := os.ReadFile(os.Args[1])
	if err != nil {
		panic(err)
	}
	mode := "std"
	if len(os.Args) > 2 {
		mode = os.Args[2]
	}
	var lines []string
	for _, l := range strings.Split(string(data), "\n") {
		if l != "" {
			lines = append(lines, l)
		}
	}
	start := time.Now()
	var sum int32
	for _, line := range lines {
		var code, message int
		var at int64
		if mode == "gjson" {
			code = len(gjson.Get(line, "code").String())
			at = gjson.Get(line, "line").Int()
			message = len(gjson.Get(line, "message").String())
		} else {
			var d diagnostic
			if err := json.Unmarshal([]byte(line), &d); err != nil {
				panic(err)
			}
			code, at, message = len(d.Code), d.Line, len(d.Message)
		}
		sum = (sum + int32(code) + int32(at) + int32(message)) & mask
	}
	elapsed := time.Since(start).Nanoseconds()
	fmt.Printf("%d\n%d\n", sum, elapsed)
}
