// The hyper 1.x twin of bench/http1-server.ts: a current-thread tokio runtime,
// so every connection's future runs on the one thread the Nish server gets.
//
//   serve <port> [ignored...]
mod order;

use std::convert::Infallible;
use std::sync::atomic::{AtomicU64, Ordering};

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

fn main() {
    let port = std::env::args().nth(1).unwrap_or_else(|| "8080".into());
    let runtime = tokio::runtime::Builder::new_current_thread().enable_io().build().unwrap();
    runtime.block_on(async {
        let listener = TcpListener::bind(format!("127.0.0.1:{port}")).await.unwrap();
        println!("listening {port}");
        loop {
            let Ok((stream, _)) = listener.accept().await else { continue };
            let _ = stream.set_nodelay(true);
            tokio::spawn(async move {
                let _ = http1::Builder::new().serve_connection(TokioIo::new(stream), service_fn(answer)).await;
            });
        }
    });
}
