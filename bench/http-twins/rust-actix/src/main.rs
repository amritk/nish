// The actix-web 4 twin of bench/http1-server.ts: `workers(N)` for N =
// BENCH_CORES (1 when it is unset), each worker a thread with its own
// single-threaded runtime, as many as the Nish server gets cores.
// Signals are left to the default action, so SIGINT ends it at once rather than
// after actix's graceful drain.
//
//   serve <port> [ignored...]
mod order;

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use actix_web::http::KeepAlive;
use actix_web::{App, HttpResponse, HttpServer, web};

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

async fn not_found() -> HttpResponse {
    count();
    HttpResponse::NotFound().content_type("text/plain").body("not found")
}

/// BENCH_CORES, the cores bench/http.mjs gives the server, or 1 when it is
/// unset or not a positive count.
fn bench_cores() -> usize {
    std::env::var("BENCH_CORES").ok().and_then(|n| n.parse().ok()).filter(|&n| n > 0).unwrap_or(1)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port: u16 = std::env::args().nth(1).map_or(8080, |p| p.parse().unwrap());
    let server = HttpServer::new(|| {
        App::new()
            .service(web::resource("/plaintext").get(plaintext).default_service(web::to(not_found)))
            .service(web::resource("/json").get(json).default_service(web::to(not_found)))
            .service(web::resource("/json-echo").post(echo).default_service(web::to(not_found)))
            .default_service(web::to(not_found))
    })
    .workers(bench_cores())
    // No timer closes an idle connection, as in the hyper, Go and Node twins:
    // actix's 5 s defaults would drop bench/http.mjs's idle connections early.
    .client_request_timeout(Duration::ZERO)
    .keep_alive(KeepAlive::Os)
    .disable_signals()
    .bind(("127.0.0.1", port))?;
    println!("listening {port}");
    server.run().await
}
