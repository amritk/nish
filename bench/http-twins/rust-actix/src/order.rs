use serde::{Deserialize, Serialize};

// Mirrors bench/http-payload.json field for field, in the payload's key order,
// which is the order serde_json writes them back in.
#[derive(Deserialize, Serialize)]
pub struct Order {
    pub id: i64,
    pub revision: i64,
    pub name: String,
    pub customer: Customer,
    pub currency: String,
    pub total: f64,
    pub items: Vec<Item>,
    pub tags: Vec<String>,
    pub shipping: Shipping,
    pub notes: Option<String>,
    pub paid: bool,
}

#[derive(Deserialize, Serialize)]
pub struct Customer {
    pub id: i64,
    pub name: String,
    pub email: String,
    pub verified: bool,
}

#[derive(Deserialize, Serialize)]
pub struct Item {
    pub sku: String,
    pub name: String,
    pub qty: i64,
    pub price: f64,
}

#[derive(Deserialize, Serialize)]
pub struct Shipping {
    pub method: String,
    pub street: String,
    pub city: String,
    pub region: String,
    pub postal: String,
}

#[derive(Serialize)]
pub struct Message {
    pub message: &'static str,
    pub n: u64,
}
