// The extra routes of bench/http-twins/extra-routes.mjs, kept equal to it by
// hand: check.mjs requests every one, so a route missing here fails it.
// go-nethttp and go-fasthttp hold identical copies of this file.
package main

import "strings"

var extraGets, extraPosts = extraRoutes()

// extraRoutes splits each GET pattern, and each with `/submit` after it for
// POST, into its segments once, before the server listens.
func extraRoutes() (gets, posts [][]string) {
	routes := []string{
		"/catalog/products",
		"/catalog/categories",
		"/catalog/brands",
		"/cart/items",
		"/cart/totals",
		"/checkout/shipping",
		"/checkout/payment",
		"/checkout/review",
		"/orders/recent",
		"/orders/archived",
		"/account/addresses",
		"/account/cards",
		"/account/security",
		"/support/tickets",
		"/support/faq",
		"/stores/nearby",
		"/stores/hours",
		"/promotions/active",
		"/reviews/latest",
		"/wishlist/shared",
		"/orders/:orderId",
		"/orders/:orderId/items",
		"/orders/:orderId/items/:itemId",
		"/orders/:orderId/items/:itemId/returns",
		"/products/:productId",
		"/products/:productId/reviews",
		"/products/:productId/reviews/:reviewId",
		"/customers/:customerId/orders",
	}
	for _, prefix := range []string{"", "/:locale", "/v2", "/v2/:locale"} {
		for _, route := range routes {
			gets = append(gets, strings.Split(prefix+route, "/"))
			posts = append(posts, strings.Split(prefix+route+"/submit", "/"))
		}
	}
	return gets, posts
}

// extra reports whether a GET or POST of path names an extra route, trying
// each pattern in turn.
func extra(method, path string) bool {
	var table [][]string
	switch method {
	case "GET":
		table = extraGets
	case "POST":
		table = extraPosts
	default:
		return false
	}
	got := strings.Split(path, "/")
	for _, want := range table {
		if matches(want, got) {
			return true
		}
	}
	return false
}

// matches compares segment by segment; a `:name` segment takes any non-empty one.
func matches(want, got []string) bool {
	if len(want) != len(got) {
		return false
	}
	for k, segment := range want {
		if strings.HasPrefix(segment, ":") {
			if got[k] == "" {
				return false
			}
		} else if segment != got[k] {
			return false
		}
	}
	return true
}
