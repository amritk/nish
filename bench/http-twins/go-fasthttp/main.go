// The valyala/fasthttp twin of bench/http1-server.ts. GOMAXPROCS is BENCH_CORES, the
// cores bench/http.mjs gives the server (1 when it is unset), so the Go
// scheduler runs goroutines on as many threads as the Nish server gets cores.
//
//	serve <port> [ignored...]
package main

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync/atomic"

	"github.com/valyala/fasthttp"
)

var requests atomic.Int64

type message struct {
	Message string `json:"message"`
	N       int64  `json:"n"`
}

// plain answers status with a text/plain body. ctx.Error would add
// "; charset=utf-8", which no other twin sends.
func plain(ctx *fasthttp.RequestCtx, status int, body string) {
	ctx.SetStatusCode(status)
	ctx.SetContentType("text/plain")
	ctx.SetBodyString(body)
}

func answer(ctx *fasthttp.RequestCtx) {
	n := requests.Add(1)
	path := string(ctx.Path())
	id, isQuery := strings.CutPrefix(path, "/id/")
	isQuery = isQuery && id != "" && !strings.Contains(id, "/")
	switch {
	case ctx.IsGet() && path == "/plaintext":
		ctx.SetContentType("text/plain")
		ctx.SetBodyString("Hello, World!")
	case ctx.IsGet() && path == "/json":
		body, _ := json.Marshal(message{"Hello, World!", n})
		ctx.SetContentType("application/json")
		ctx.SetBody(body)
	case ctx.IsPost() && path == "/json-echo":
		// A pointer, so that a body of `null` leaves it nil and is refused.
		var order *Order
		if err := json.Unmarshal(ctx.PostBody(), &order); err != nil || order == nil {
			plain(ctx, fasthttp.StatusBadRequest, "bad request")
			return
		}
		order.Revision++
		body, _ := json.Marshal(order)
		ctx.SetContentType("application/json")
		ctx.SetBody(body)
	case ctx.IsPost() && path == "/json":
		// Any JSON value is re-serialized compactly; encoding/json writes an
		// object's keys sorted.
		var value any
		if err := json.Unmarshal(ctx.PostBody(), &value); err != nil {
			plain(ctx, fasthttp.StatusBadRequest, "bad request")
			return
		}
		body, _ := json.Marshal(value)
		ctx.SetContentType("application/json")
		ctx.SetBody(body)
	case ctx.IsGet() && path == "/":
		plain(ctx, fasthttp.StatusOK, "Hi")
	case ctx.IsGet() && isQuery:
		ctx.Response.Header.Set("x-powered-by", "benchmark")
		plain(ctx, fasthttp.StatusOK, id+" "+string(ctx.QueryArgs().Peek("name")))
	case extra(string(ctx.Method()), path):
		plain(ctx, fasthttp.StatusOK, "ok")
	default:
		plain(ctx, fasthttp.StatusNotFound, "not found")
	}
}

// benchCores is BENCH_CORES, or 1 when it is unset or not a positive count.
func benchCores() int {
	n, err := strconv.Atoi(os.Getenv("BENCH_CORES"))
	if err != nil || n < 1 {
		return 1
	}
	return n
}

func main() {
	runtime.GOMAXPROCS(benchCores())
	port := "8080"
	if len(os.Args) > 1 {
		port = os.Args[1]
	}
	ln, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println("listening", port)
	err = fasthttp.Serve(ln, answer)
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
