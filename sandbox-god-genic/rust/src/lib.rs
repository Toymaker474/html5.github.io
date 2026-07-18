use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct SimCore {
    seed: u32,
    tick: u64,
}

#[wasm_bindgen]
impl SimCore {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32) -> SimCore {
        SimCore { seed: seed.max(1), tick: 0 }
    }

    #[wasm_bindgen(getter)]
    pub fn tick(&self) -> u64 { self.tick }

    pub fn random(&mut self) -> f32 {
        let mut x = self.seed;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.seed = x;
        (x as f64 / u32::MAX as f64) as f32
    }

    /// Packed creature state: [x, y, vx, vy, energy] repeated.
    pub fn integrate(&mut self, state: &mut [f32], dt: f32, world_size: f32) {
        self.tick += 1;
        let drag = (1.0 - dt * 0.45).max(0.0);
        for creature in state.chunks_exact_mut(5) {
            creature[2] *= drag;
            creature[3] *= drag;
            creature[0] = (creature[0] + creature[2] * dt).rem_euclid(world_size);
            creature[1] = (creature[1] + creature[3] * dt).rem_euclid(world_size);
            creature[4] = (creature[4] - dt * 0.0007).max(0.0);
        }
    }

    pub fn fitness(energy: f32, age: f32, children: u32, novelty: f32) -> f32 {
        energy * 0.52 + age.min(100.0) * 0.004 + children as f32 * 0.12 + novelty * 0.2
    }
}
