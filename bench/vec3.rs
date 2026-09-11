// Rust twin of vec3.ts: the same methods on a Box<Vec3> (heap objects, like
// the arena objects in Nish), same expression order.
const N: i32 = 50000000; // bench:n

struct Vec3 {
    x: f64,
    y: f64,
    z: f64,
}

impl Vec3 {
    fn new(x: f64, y: f64, z: f64) -> Box<Vec3> {
        Box::new(Vec3 { x, y, z })
    }
    fn add(&mut self, o: &Vec3) {
        self.x = self.x + o.x;
        self.y = self.y + o.y;
        self.z = self.z + o.z;
    }
    fn add_scaled(&mut self, o: &Vec3, s: f64) {
        self.x = self.x + o.x * s;
        self.y = self.y + o.y * s;
        self.z = self.z + o.z * s;
    }
    fn dot(&self, o: &Vec3) -> f64 {
        self.x * o.x + self.y * o.y + self.z * o.z
    }
    fn cross_into(&self, o: &Vec3, out: &mut Vec3) {
        out.x = self.y * o.z - self.z * o.y;
        out.y = self.z * o.x - self.x * o.z;
        out.z = self.x * o.y - self.y * o.x;
    }
    fn norm(&self) -> f64 {
        self.dot(self).sqrt()
    }
}

fn main() {
    let dt = 0.0000001;
    let mut p = Vec3::new(0.0, 0.0, 0.0);
    let mut v = Vec3::new(1.0, 2.0, 3.0);
    let g = Vec3::new(0.0, -0.0000001, 0.0);
    let mut kick = Vec3::new(0.0, 0.0, 0.0);
    let mut energy = 0.0;
    for _ in 0..N {
        v.add(&g);
        v.cross_into(&g, &mut kick);
        v.add_scaled(&kick, 0.001);
        p.add_scaled(&v, dt);
        energy = energy + 0.5 * v.dot(&v) + p.norm() * dt;
    }
    println!("{}\n{}\n{}\n{}", p.x, p.y, p.z, energy);
}
