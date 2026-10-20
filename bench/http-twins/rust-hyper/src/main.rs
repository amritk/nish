// The hyper 1.x twin of bench/http1-server.ts. With BENCH_CORES unset or 1, a
// current-thread tokio runtime, so every connection's future runs on the one
// thread the Nish server gets; with BENCH_CORES=N, a multi-thread runtime with
// N workers, as many as the Nish server gets cores.
//
//   serve <port> [ignored...]
mod order;

use std::convert::Infallible;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use bytes::Bytes;
use http_body_util::{BodyExt, Full};
use hyper::body::Incoming;
use hyper::header::{CONTENT_TYPE, HeaderValue};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use tokio::net::TcpListener;

use order::{Message, Order};

static REQUESTS: AtomicU64 = AtomicU64::new(0);

fn reply(status: StatusCode, content_type: &'static str, body: impl Into<Bytes>) -> Response<Full<Bytes>> {
    let mut res = Response::new(Full::new(body.into()));
    *res.status_mut() = status;
    res.headers_mut().insert(CONTENT_TYPE, HeaderValue::from_static(content_type));
    res
}

async fn echo(req: Request<Incoming>) -> Response<Full<Bytes>> {
    let order = match req.into_body().collect().await {
        Ok(body) => serde_json::from_slice::<Order>(&body.to_bytes()).ok(),
        Err(_) => None,
    };
    match order {
        Some(mut order) => {
            order.revision += 1;
            reply(StatusCode::OK, "application/json", serde_json::to_vec(&order).unwrap())
        }
        None => reply(StatusCode::BAD_REQUEST, "text/plain", "bad request"),
    }
}

async fn answer(req: Request<Incoming>) -> Result<Response<Full<Bytes>>, Infallible> {
    let n = REQUESTS.fetch_add(1, Ordering::Relaxed) + 1;
    Ok(match (req.method(), req.uri().path()) {
        (&Method::GET, "/plaintext") => reply(StatusCode::OK, "text/plain", "Hello, World!"),
        (&Method::GET, "/json") => {
            let body = serde_json::to_vec(&Message { message: "Hello, World!", n }).unwrap();
            reply(StatusCode::OK, "application/json", body)
        }
        (&Method::POST, "/json-echo") => echo(req).await,
        _ => reply(StatusCode::NOT_FOUND, "text/plain", "not found"),
    })
}

/// BENCH_CORES, the cores bench/http.mjs gives the server, or 1 when it is
/// unset or not a positive count.
fn bench_cores() -> usize {
    std::env::var("BENCH_CORES").ok().and_then(|n| n.parse().ok()).filter(|&n| n > 0).unwrap_or(1)
}

fn main() {
    let port = std::env::args().nth(1).unwrap_or_else(|| "8080".into());
    let cores = bench_cores();
    let mut builder = if cores == 1 {
        tokio::runtime::Builder::new_current_thread()
    } else {
        let mut b = tokio::runtime::Builder::new_multi_thread();
        b.worker_threads(cores);
        b
    };
    let runtime = builder.enable_io().enable_time().build().unwrap();
    // The accept loop is spawned, not run inside `block_on`: on the
    // multi-thread runtime that keeps it on the N workers rather than on an
    // extra thread beside them.
    let accept = runtime.spawn(async move {
        let listener = TcpListener::bind(format!("127.0.0.1:{port}")).await.unwrap();
        println!("listening {port}");
        loop {
            let stream = match listener.accept().await {
                Ok((stream, _)) => stream,
                // EMFILE and its kind clear only once a connection closes:
                // wait rather than spin on the accepting thread.
                Err(e) => {
                    eprintln!("accept: {e}");
                    tokio::time::sleep(Duration::from_millis(10)).await;
                    continue;
                }
            };
            let _ = stream.set_nodelay(true);
            tokio::spawn(async move {
                let _ = http1::Builder::new().serve_connection(TokioIo::new(stream), service_fn(answer)).await;
            });
        }
    });
    runtime.block_on(accept).unwrap();
}
