// The routes every HTTP twin registers beside the measured ones, so that its
// route lookup and its startup look like a small service's rather than a
// three-route demo. None of them is requested under load: check.mjs asks each
// once. Every GET pattern answers `ok` as text/plain, and so does a POST to the
// same pattern with `/submit` after it.
//
// A segment that starts with `:` is a parameter and matches any one non-empty
// segment. A literal segment is tried before a parameter, and no route here
// needs backtracking to be found. Every route with a `/:locale` prefix has at
// least three segments, so none of them shadows the measured `/id/:id`.

const staticRoutes = [
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
]

const paramRoutes = [
  "/orders/:orderId",
  "/orders/:orderId/items",
  "/orders/:orderId/items/:itemId",
  "/orders/:orderId/items/:itemId/returns",
  "/products/:productId",
  "/products/:productId/reviews",
  "/products/:productId/reviews/:reviewId",
  "/customers/:customerId/orders",
]

const prefixes = ["", "/:locale", "/v2", "/v2/:locale"]

/** The GET patterns, 112 of them; each also takes a POST at `<pattern>/submit`. */
export const extraRoutes = prefixes.flatMap((prefix) =>
  [...staticRoutes, ...paramRoutes].map((route) => `${prefix}${route}`)
)

/** A concrete path for a pattern: `:locale` becomes `en`, any other parameter `42`. */
export const sampleOf = (pattern) =>
  pattern
    .split("/")
    .map((segment) => {
      if (segment === ":locale") {
        return "en"
      }
      return segment.startsWith(":") ? "42" : segment
    })
    .join("/")

/**
 * Whether `path` matches `pattern` segment by segment, for the twins that test
 * the measured routes by hand and fall back to a linear scan of the table.
 */
export const matchesRoute = (pattern, path) => {
  const want = pattern.split("/")
  const got = path.split("/")
  if (want.length !== got.length) {
    return false
  }
  return want.every((segment, k) => (segment.startsWith(":") ? got[k].length > 0 : segment === got[k]))
}
