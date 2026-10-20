// The hyper 1.x twin of bench/http1-server.ts: a current-thread tokio runtime,
// so every connection's future runs on the one thread the Nish server gets.
//
//   serve <port> [ignored...]
mod extra;
mod order;

use std::convert::Infallible;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use bytes::Bytes;
use http_body_util::{BodyExt, Full};
use hyper::body::Incoming;
use hyper::header::{CONTENT_TYPE, HeaderName, HeaderValue};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use tokio::net::TcpListener;

use order::{Message, Order};

static REQUESTS: AtomicU64 = AtomicU64::new(0);

/// The extra GET and POST patterns, split into segments before the server listens.
static EXTRAS: OnceLock<(Vec<Vec<String>>, Vec<Vec<String>>)> = OnceLock::new();

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

/// Re-serializes any JSON body, compactly; serde_json writes an object's keys sorted.
async fn rewrite(req: Request<Incoming>) -> Response<Full<Bytes>> {
    let value = match req.into_body().collect().await {
        Ok(body) => serde_json::from_slice::<serde_json::Value>(&body.to_bytes()).ok(),
        Err(_) => None,
    };
    match value {
        Some(value) => reply(StatusCode::OK, "application/json", serde_json::to_vec(&value).unwrap()),
        None => reply(StatusCode::BAD_REQUEST, "text/plain", "bad request"),
    }
}

/// `<id> <name>` for `/id/<id>?name=<name>`, the first `name` in the query.
fn query(path: &str, query: Option<&str>) -> Option<String> {
    let id = path.strip_prefix("/id/")?;
    if id.is_empty() || id.contains('/') {
        return None;
    }
    let name = query.unwrap_or("").split('&').find_map(|pair| pair.strip_prefix("name=")).unwrap_or("");
    Some(format!("{id} {name}"))
}

/// Whether a GET or POST of `path` names an extra route, trying each pattern in turn.
fn extra(method: &Method, path: &str) -> bool {
    let (gets, posts) = EXTRAS.get().unwrap();
    let table = match *method {
        Method::GET => gets,
        Method::POST => posts,
        _ => return false,
    };
    let got: Vec<&str> = path.split('/').collect();
    table.iter().any(|want| {
        want.len() == got.len()
            && want.iter().zip(&got).all(|(w, g)| if w.starts_with(':') { !g.is_empty() } else { w == g })
    })
}

/// The routes after the measured ones: the query, the extra routes, then 404.
fn fallback(req: &Request<Incoming>) -> Response<Full<Bytes>> {
    let path = req.uri().path();
    if req.method() == Method::GET {
        if let Some(body) = query(path, req.uri().query()) {
            let mut res = reply(StatusCode::OK, "text/plain", body);
            res.headers_mut().insert(HeaderName::from_static("x-powered-by"), HeaderValue::from_static("benchmark"));
            return res;
        }
    }
    if extra(req.method(), path) {
        return reply(StatusCode::OK, "text/plain", "ok");
    }
    reply(StatusCode::NOT_FOUND, "text/plain", "not found")
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
        (&Method::POST, "/json") => rewrite(req).await,
        (&Method::GET, "/") => reply(StatusCode::OK, "text/plain", "Hi"),
        _ => fallback(&req),
    })
}

fn main() {
    let port = std::env::args().nth(1).unwrap_or_else(|| "8080".into());
    let split = |pattern: &str| pattern.split('/').map(String::from).collect();
    let patterns = extra::patterns();
    let gets = patterns.iter().map(|p| split(p)).collect();
    let posts = patterns.iter().map(|p| split(&format!("{p}/submit"))).collect();
    EXTRAS.set((gets, posts)).unwrap();
    let runtime = tokio::runtime::Builder::new_current_thread().enable_io().enable_time().build().unwrap();
    runtime.block_on(async {
        let listener = TcpListener::bind(format!("127.0.0.1:{port}")).await.unwrap();
        println!("listening {port}");
        loop {
            let stream = match listener.accept().await {
                Ok((stream, _)) => stream,
                // EMFILE and its kind clear only once a connection closes:
                // wait rather than spin on the one thread.
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
}
