package main

// Order mirrors bench/http-payload.json field for field, in the payload's key
// order, which is the order encoding/json writes them back in.
type Order struct {
	ID       int64    `json:"id"`
	Revision int64    `json:"revision"`
	Name     string   `json:"name"`
	Customer Customer `json:"customer"`
	Currency string   `json:"currency"`
	Total    float64  `json:"total"`
	Items    []Item   `json:"items"`
	Tags     []string `json:"tags"`
	Shipping Shipping `json:"shipping"`
	Notes    *string  `json:"notes"`
	Paid     bool     `json:"paid"`
}

type Customer struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Verified bool   `json:"verified"`
}

type Item struct {
	Sku   string  `json:"sku"`
	Name  string  `json:"name"`
	Qty   int64   `json:"qty"`
	Price float64 `json:"price"`
}

type Shipping struct {
	Method string `json:"method"`
	Street string `json:"street"`
	City   string `json:"city"`
	Region string `json:"region"`
	Postal string `json:"postal"`
}
