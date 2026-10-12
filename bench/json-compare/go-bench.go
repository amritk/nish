// bench/json-compare's Go comparator, on the standard library's encoding/json,
// for all three workloads:
//
//	tokenize   json.Decoder.Token over the document, numbers as float64
//	typed      json.Unmarshal of citm_catalog's `performances` into the structs
//	           below, a fresh value per iteration
//	serialize  the structs written back with a json.Encoder that does not
//	           escape HTML, into one reused buffer, without the newline the
//	           encoder appends
//
// The folds and the mutation of the input are bench/json-compare/run.mjs's.
//
//	go-bench <workload> <file> <iterations> <at>
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
	"time"
)

func fold(h, v uint64) uint64 { return h*31 + v }

type Price struct {
	Amount                int64 `json:"amount"`
	AudienceSubCategoryID int64 `json:"audienceSubCategoryId"`
	SeatCategoryID        int64 `json:"seatCategoryId"`
}

type Area struct {
	AreaID   int64   `json:"areaId"`
	BlockIDs []int64 `json:"blockIds"`
}

type SeatCategory struct {
	Areas          []Area `json:"areas"`
	SeatCategoryID int64  `json:"seatCategoryId"`
}

type Performance struct {
	EventID        int64          `json:"eventId"`
	ID             int64          `json:"id"`
	Logo           *string        `json:"logo"`
	Name           *string        `json:"name"`
	Prices         []Price        `json:"prices"`
	SeatCategories []SeatCategory `json:"seatCategories"`
	SeatMapImage   *string        `json:"seatMapImage"`
	Start          int64          `json:"start"`
	VenueCode      string         `json:"venueCode"`
}

type Catalog struct {
	Performances []Performance `json:"performances"`
}

type sums struct {
	h       uint64
	tokens  int
	numbers float64
}

func (s *sums) kind(k uint64) {
	s.h = fold(s.h, k)
	s.tokens++
}

func (s *sums) text(k uint64, str string) {
	s.kind(k)
	var last uint64
	if len(str) > 0 {
		last = uint64(str[len(str)-1])
	}
	s.h = fold(fold(s.h, uint64(len(str))), last)
}

// tokenizeOnce tells keys from strings, which Token does not, with a stack
// of open containers: 'a' for an array, 'k' for an object whose next string
// is a key, 'v' for an object whose next token is a member's value.
func tokenizeOnce(doc []byte, s *sums) {
	dec := json.NewDecoder(bytes.NewReader(doc))
	var stack []byte
	// A value has ended: the object holding it, if any, wants a key next.
	valueDone := func() {
		if len(stack) > 0 && stack[len(stack)-1] == 'v' {
			stack[len(stack)-1] = 'k'
		}
	}
	for {
		t, err := dec.Token()
		if err == io.EOF {
			return
		}
		if err != nil {
			fmt.Fprintln(os.Stderr, "tokenize: the document is not JSON:", err)
			os.Exit(1)
		}
		switch v := t.(type) {
		case json.Delim:
			switch v {
			case '{':
				s.kind(1)
				stack = append(stack, 'k')
			case '}':
				s.kind(2)
				stack = stack[:len(stack)-1]
				valueDone()
			case '[':
				s.kind(3)
				stack = append(stack, 'a')
			case ']':
				s.kind(4)
				stack = stack[:len(stack)-1]
				valueDone()
			}
		case string:
			if len(stack) > 0 && stack[len(stack)-1] == 'k' {
				s.text(5, v)
				stack[len(stack)-1] = 'v'
			} else {
				s.text(6, v)
				valueDone()
			}
		case float64:
			s.kind(7)
			s.numbers += v
			valueDone()
		case bool:
			if v {
				s.kind(8)
			} else {
				s.kind(9)
			}
			valueDone()
		case nil:
			s.kind(10)
			valueDone()
		}
	}
}

func foldOptional(h uint64, s *string) uint64 {
	if s == nil {
		return fold(h, 0)
	}
	return fold(h, uint64(len(*s))+1)
}

func foldCatalog(c *Catalog) uint64 {
	var h uint64
	for i := range c.Performances {
		p := &c.Performances[i]
		h = fold(fold(h, uint64(p.EventID)), uint64(p.ID))
		h = foldOptional(foldOptional(h, p.Logo), p.Name)
		h = fold(h, uint64(len(p.Prices)))
		for _, price := range p.Prices {
			h = fold(fold(fold(h, uint64(price.Amount)), uint64(price.AudienceSubCategoryID)), uint64(price.SeatCategoryID))
		}
		h = fold(h, uint64(len(p.SeatCategories)))
		for _, sc := range p.SeatCategories {
			h = fold(h, uint64(len(sc.Areas)))
			for _, area := range sc.Areas {
				h = fold(fold(h, uint64(area.AreaID)), uint64(len(area.BlockIDs)))
				for _, b := range area.BlockIDs {
					h = fold(h, uint64(b))
				}
			}
			h = fold(h, uint64(sc.SeatCategoryID))
		}
		h = foldOptional(h, p.SeatMapImage)
		h = fold(fold(h, uint64(p.Start)), uint64(len(p.VenueCode)))
	}
	return h
}

func decode(doc []byte) Catalog {
	var c Catalog
	if err := json.Unmarshal(doc, &c); err != nil {
		fmt.Fprintln(os.Stderr, "typed: decoding failed:", err)
		os.Exit(1)
	}
	return c
}

func main() {
	if len(os.Args) < 5 {
		fmt.Fprintln(os.Stderr, "usage: go-bench <tokenize|typed|serialize> <file> <iterations> <at>")
		os.Exit(2)
	}
	workload := os.Args[1]
	doc, err := os.ReadFile(os.Args[2])
	if err != nil {
		fmt.Fprintln(os.Stderr, "cannot read", os.Args[2])
		os.Exit(1)
	}
	iterations, _ := strconv.Atoi(os.Args[3])
	at, _ := strconv.Atoi(os.Args[4])
	mutate := func(r int) {
		if at >= 0 && at < len(doc) {
			doc[at] = byte('0' + r%10)
		}
	}
	var elapsed time.Duration
	switch workload {
	case "tokenize":
		var h uint64
		var numbers float64
		var s sums
		t0 := time.Now()
		for r := 0; r < iterations; r++ {
			mutate(r)
			s = sums{}
			tokenizeOnce(doc, &s)
			h = fold(h, s.h)
			numbers += s.numbers
		}
		elapsed = time.Since(t0)
		fmt.Printf("tokenize %d %d %s\n", h, s.tokens, strconv.FormatFloat(numbers, 'g', -1, 64))
	case "typed":
		var h uint64
		count := 0
		t0 := time.Now()
		for r := 0; r < iterations; r++ {
			mutate(r)
			c := decode(doc)
			h = fold(h, foldCatalog(&c))
			count = len(c.Performances)
		}
		elapsed = time.Since(t0)
		fmt.Printf("typed %d %d\n", h, count)
	case "serialize":
		c := decode(doc)
		if len(c.Performances) == 0 {
			fmt.Fprintln(os.Stderr, "serialize: the document has no performances")
			os.Exit(1)
		}
		var buf bytes.Buffer
		buf.Grow(len(doc)*2 + 64)
		enc := json.NewEncoder(&buf)
		enc.SetEscapeHTML(false)
		var h uint64
		var out []byte
		t0 := time.Now()
		for r := 0; r < iterations; r++ {
			c.Performances[r%len(c.Performances)].Start++
			buf.Reset()
			if err := enc.Encode(&c); err != nil {
				fmt.Fprintln(os.Stderr, "serialize:", err)
				os.Exit(1)
			}
			out = bytes.TrimSuffix(buf.Bytes(), []byte("\n"))
			h = fold(fold(h, uint64(len(out))), uint64(out[r%len(out)]))
		}
		elapsed = time.Since(t0)
		var sum uint64
		for _, b := range out {
			sum = fold(sum, uint64(b))
		}
		fmt.Printf("serialize %d %d %d\n", h, len(out), sum)
	default:
		fmt.Fprintln(os.Stderr, "unknown workload", workload)
		os.Exit(2)
	}
	fmt.Printf("ns %d\n", elapsed.Nanoseconds())
}
