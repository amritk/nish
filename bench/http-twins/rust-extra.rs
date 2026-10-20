// The extra routes of bench/http-twins/extra-routes.mjs, kept equal to it by
// hand: check.mjs requests every one, so a route missing here fails it.
// build.sh copies this file into each Rust twin's src/ as extra.rs.

const ROUTES: [&str; 28] = [
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
];

const PREFIXES: [&str; 4] = ["", "/:locale", "/v2", "/v2/:locale"];

/// The GET patterns, 112 of them; each also takes a POST at `<pattern>/submit`.
/// A `:name` segment matches any one non-empty segment.
pub fn patterns() -> Vec<String> {
    PREFIXES.iter().flat_map(|prefix| ROUTES.iter().map(move |route| format!("{prefix}{route}"))).collect()
}
