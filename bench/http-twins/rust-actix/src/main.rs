// The actix-web 4 twin of bench/http1-server.ts: `workers(1)`, one worker
// thread with its own single-threaded runtime, the one core the Nish server gets.
// Signals are left to the default action, so SIGINT ends it at once rather than
// after actix's graceful drain.
//
//   serve <port> [ignored...]
//
// The extra routes are registered first, as a small service would register
// them, and the measured routes after.
mod extra;
mod order;

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use actix_web::http::KeepAlive;
use actix_web::{App, HttpResponse, HttpServer, web};
use serde::Deserialize;

use order::{Message, Order};

static REQUESTS: AtomicU64 = AtomicU64::new(0);

fn count() -> u64 {
    REQUESTS.fetch_add(1, Ordering::Relaxed) + 1
}

async fn plaintext() -> HttpResponse {
    count();
    HttpResponse::Ok().content_type("text/plain").body("Hello, World!")
}

async fn json() -> HttpResponse {
    let body = serde_json::to_vec(&Message { message: "Hello, World!", n: count() }).unwrap();
    HttpResponse::Ok().content_type("application/json").body(body)
}

async fn echo(body: web::Bytes) -> HttpResponse {
    count();
    match serde_json::from_slice::<Order>(&body) {
        Ok(mut order) => {
            order.revision += 1;
            HttpResponse::Ok().content_type("application/json").body(serde_json::to_vec(&order).unwrap())
        }
        Err(_) => HttpResponse::BadRequest().content_type("text/plain").body("bad request"),
    }
}

/// Re-serializes any JSON body, compactly; serde_json writes an object's keys sorted.
async fn rewrite(body: web::Bytes) -> HttpResponse {
    count();
    match serde_json::from_slice::<serde_json::Value>(&body) {
        Ok(value) => HttpResponse::Ok().content_type("application/json").body(serde_json::to_vec(&value).unwrap()),
        Err(_) => HttpResponse::BadRequest().content_type("text/plain").body("bad request"),
    }
}

async fn hi() -> HttpResponse {
    count();
    HttpResponse::Ok().content_type("text/plain").body("Hi")
}

#[derive(Deserialize)]
struct Name {
    #[serde(default)]
    name: String,
}

async fn query(id: web::Path<String>, query: web::Query<Name>) -> HttpResponse {
    count();
    HttpResponse::Ok()
        .content_type("text/plain")
        .insert_header(("x-powered-by", "benchmark"))
        .body(format!("{} {}", id.into_inner(), query.name))
}

async fn ok() -> HttpResponse {
    count();
    HttpResponse::Ok().content_type("text/plain").body("ok")
}

/// An extra-routes pattern in actix's spelling: `:name` becomes `{name}`.
fn actix_pattern(pattern: &str) -> String {
    let segments: Vec<String> = pattern
        .split('/')
        .map(|s| match s.strip_prefix(':') {
            Some(name) => format!("{{{name}}}"),
            None => s.to_string(),
        })
        .collect();
    segments.join("/")
}

async fn not_found() -> HttpResponse {
    count();
    HttpResponse::NotFound().content_type("text/plain").body("not found")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::args().nth(1).map_or(8080, |p| p.parse().unwrap());
    let server = HttpServer::new(|| {
        let mut app = App::new();
        for pattern in extra::patterns() {
            let get = actix_pattern(&pattern);
            let post = format!("{get}/submit");
            app = app
                .service(web::resource(get).get(ok).default_service(web::to(not_found)))
                .service(web::resource(post).post(ok).default_service(web::to(not_found)));
        }
        app.service(web::resource("/").get(hi).default_service(web::to(not_found)))
            .service(web::resource("/id/{id}").get(query).default_service(web::to(not_found)))
            .service(web::resource("/plaintext").get(plaintext).default_service(web::to(not_found)))
            .service(web::resource("/json").get(json).post(rewrite).default_service(web::to(not_found)))
            .service(web::resource("/json-echo").post(echo).default_service(web::to(not_found)))
            .default_service(web::to(not_found))
    })
    .workers(1)
    // No timer closes an idle connection, as in the hyper, Go and Node twins:
    // actix's 5 s defaults would drop bench/http.mjs's idle connections early.
    .client_request_timeout(Duration::ZERO)
    .keep_alive(KeepAlive::Os)
    .disable_signals()
    .bind(("127.0.0.1", port))?;
    println!("listening {port}");
    server.run().await
}
