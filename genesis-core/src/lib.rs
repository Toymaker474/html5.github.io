use wasm_bindgen::prelude::*;

const ELEMENT_C: u8 = 0;
const ELEMENT_H: u8 = 1;
const ELEMENT_O: u8 = 2;
const ELEMENT_N: u8 = 3;
const ELEMENT_P: u8 = 4;
const ELEMENT_S: u8 = 5;

#[wasm_bindgen]
pub struct Genesis {
    width: f32,
    height: f32,
    temperature: f32,
    time_scale: f32,
    seed: u32,
    types: Vec<u8>,
    pos: Vec<f32>,
    vel: Vec<f32>,
    charge: Vec<f32>,
    bonds: Vec<u32>,
}

#[wasm_bindgen]
impl Genesis {
    #[wasm_bindgen(constructor)]
    pub fn new(atom_count: usize, width: f32, height: f32, seed: u32) -> Genesis {
        console_error_panic_hook::set_once();
        let mut sim = Genesis {
            width,
            height,
            temperature: 320.0,
            time_scale: 1.0,
            seed: seed.max(1),
            types: Vec::with_capacity(atom_count),
            pos: Vec::with_capacity(atom_count * 2),
            vel: Vec::with_capacity(atom_count * 2),
            charge: Vec::with_capacity(atom_count),
            bonds: Vec::new(),
        };
        sim.seed_atoms(atom_count);
        sim
    }

    pub fn atom_count(&self) -> usize { self.types.len() }
    pub fn bond_count(&self) -> usize { self.bonds.len() / 2 }
    pub fn temperature(&self) -> f32 { self.temperature }
    pub fn set_temperature(&mut self, value: f32) { self.temperature = value.clamp(80.0, 1200.0); }
    pub fn set_time_scale(&mut self, value: f32) { self.time_scale = value.clamp(0.05, 12.0); }

    pub fn positions(&self) -> js_sys::Float32Array {
        js_sys::Float32Array::from(self.pos.as_slice())
    }

    pub fn velocities(&self) -> js_sys::Float32Array {
        js_sys::Float32Array::from(self.vel.as_slice())
    }

    pub fn atom_types(&self) -> js_sys::Uint8Array {
        js_sys::Uint8Array::from(self.types.as_slice())
    }

    pub fn bond_pairs(&self) -> js_sys::Uint32Array {
        js_sys::Uint32Array::from(self.bonds.as_slice())
    }

    pub fn add_energy_pulse(&mut self, x: f32, y: f32, radius: f32, strength: f32) {
        let r2 = radius * radius;
        for i in 0..self.types.len() {
            let px = self.pos[i * 2];
            let py = self.pos[i * 2 + 1];
            let dx = px - x;
            let dy = py - y;
            let d2 = dx * dx + dy * dy;
            if d2 < r2 {
                let d = d2.sqrt().max(0.001);
                let w = 1.0 - d / radius.max(0.001);
                self.vel[i * 2] += dx / d * strength * w;
                self.vel[i * 2 + 1] += dy / d * strength * w;
            }
        }
    }

    pub fn step(&mut self, dt: f32) {
        let dt = (dt * self.time_scale).clamp(0.0001, 0.03);
        let n = self.types.len();
        if n == 0 { return; }

        let mut force = vec![0.0f32; n * 2];
        let cutoff = 26.0f32;
        let cutoff2 = cutoff * cutoff;

        for i in 0..n {
            for j in (i + 1)..n {
                let dx = self.pos[j * 2] - self.pos[i * 2];
                let dy = self.pos[j * 2 + 1] - self.pos[i * 2 + 1];
                let d2 = dx * dx + dy * dy;
                if d2 <= 0.0001 || d2 > cutoff2 { continue; }
                let d = d2.sqrt();
                let inv = 1.0 / d;

                let sigma = atomic_radius(self.types[i]) + atomic_radius(self.types[j]);
                let sr = (sigma * inv).clamp(0.0, 3.0);
                let sr2 = sr * sr;
                let sr6 = sr2 * sr2 * sr2;
                let lj = 18.0 * (2.0 * sr6 * sr6 - sr6) * inv;
                let coulomb = 9.0 * self.charge[i] * self.charge[j] / (d2 + 8.0);
                let f = (lj + coulomb).clamp(-80.0, 80.0);
                let fx = dx * inv * f;
                let fy = dy * inv * f;
                force[i * 2] -= fx;
                force[i * 2 + 1] -= fy;
                force[j * 2] += fx;
                force[j * 2 + 1] += fy;
            }
        }

        self.try_form_bonds();

        for pair in self.bonds.chunks_exact(2) {
            let a = pair[0] as usize;
            let b = pair[1] as usize;
            if a >= n || b >= n { continue; }
            let dx = self.pos[b * 2] - self.pos[a * 2];
            let dy = self.pos[b * 2 + 1] - self.pos[a * 2 + 1];
            let d = (dx * dx + dy * dy).sqrt().max(0.001);
            let target = 0.92 * (atomic_radius(self.types[a]) + atomic_radius(self.types[b]));
            let stretch = d - target;
            let k = 32.0;
            let fx = dx / d * stretch * k;
            let fy = dy / d * stretch * k;
            force[a * 2] += fx;
            force[a * 2 + 1] += fy;
            force[b * 2] -= fx;
            force[b * 2 + 1] -= fy;
        }

        let thermal = (self.temperature / 320.0).sqrt() * 3.4;
        for i in 0..n {
            let noise_x = (self.rand01() - 0.5) * thermal;
            let noise_y = (self.rand01() - 0.5) * thermal;
            self.vel[i * 2] = (self.vel[i * 2] + force[i * 2] * dt + noise_x * dt) * 0.994;
            self.vel[i * 2 + 1] = (self.vel[i * 2 + 1] + force[i * 2 + 1] * dt + noise_y * dt) * 0.994;
            self.pos[i * 2] += self.vel[i * 2] * dt * 60.0;
            self.pos[i * 2 + 1] += self.vel[i * 2 + 1] * dt * 60.0;

            if self.pos[i * 2] < 0.0 { self.pos[i * 2] = 0.0; self.vel[i * 2] *= -0.75; }
            if self.pos[i * 2] > self.width { self.pos[i * 2] = self.width; self.vel[i * 2] *= -0.75; }
            if self.pos[i * 2 + 1] < 0.0 { self.pos[i * 2 + 1] = 0.0; self.vel[i * 2 + 1] *= -0.75; }
            if self.pos[i * 2 + 1] > self.height { self.pos[i * 2 + 1] = self.height; self.vel[i * 2 + 1] *= -0.75; }
        }
    }
}

impl Genesis {
    fn seed_atoms(&mut self, count: usize) {
        let mix = [ELEMENT_H, ELEMENT_H, ELEMENT_H, ELEMENT_C, ELEMENT_C, ELEMENT_O, ELEMENT_O, ELEMENT_N, ELEMENT_P, ELEMENT_S];
        for _ in 0..count {
            let t = mix[(self.rand01() * mix.len() as f32) as usize % mix.len()];
            self.types.push(t);
            self.pos.push(self.rand01() * self.width);
            self.pos.push(self.rand01() * self.height);
            self.vel.push((self.rand01() - 0.5) * 0.5);
            self.vel.push((self.rand01() - 0.5) * 0.5);
            self.charge.push(default_charge(t));
        }
    }

    fn try_form_bonds(&mut self) {
        let n = self.types.len();
        if self.bonds.len() / 2 > n * 2 { return; }
        let mut degree = vec![0u8; n];
        for p in self.bonds.chunks_exact(2) {
            degree[p[0] as usize] = degree[p[0] as usize].saturating_add(1);
            degree[p[1] as usize] = degree[p[1] as usize].saturating_add(1);
        }
        for i in 0..n {
            if degree[i] >= valence(self.types[i]) { continue; }
            for j in (i + 1)..n {
                if degree[j] >= valence(self.types[j]) { continue; }
                if self.is_bonded(i, j) { continue; }
                let dx = self.pos[j * 2] - self.pos[i * 2];
                let dy = self.pos[j * 2 + 1] - self.pos[i * 2 + 1];
                let d2 = dx * dx + dy * dy;
                let r = 1.25 * (atomic_radius(self.types[i]) + atomic_radius(self.types[j]));
                if d2 < r * r {
                    let relative = (self.vel[j * 2] - self.vel[i * 2]).powi(2) + (self.vel[j * 2 + 1] - self.vel[i * 2 + 1]).powi(2);
                    let activation = 1.0 / (1.0 + relative * 0.25 + self.temperature / 700.0);
                    if self.rand01() < activation * 0.08 {
                        self.bonds.push(i as u32);
                        self.bonds.push(j as u32);
                        degree[i] += 1;
                        degree[j] += 1;
                        break;
                    }
                }
            }
        }
    }

    fn is_bonded(&self, a: usize, b: usize) -> bool {
        self.bonds.chunks_exact(2).any(|p| {
            (p[0] as usize == a && p[1] as usize == b) || (p[0] as usize == b && p[1] as usize == a)
        })
    }

    fn rand01(&mut self) -> f32 {
        let mut x = self.seed;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.seed = x.max(1);
        (self.seed as f64 / u32::MAX as f64) as f32
    }
}

fn atomic_radius(t: u8) -> f32 {
    match t {
        ELEMENT_H => 3.0,
        ELEMENT_C => 4.8,
        ELEMENT_N => 4.5,
        ELEMENT_O => 4.3,
        ELEMENT_P => 5.3,
        ELEMENT_S => 5.1,
        _ => 4.0,
    }
}

fn valence(t: u8) -> u8 {
    match t {
        ELEMENT_H => 1,
        ELEMENT_C => 4,
        ELEMENT_N => 3,
        ELEMENT_O => 2,
        ELEMENT_P => 5,
        ELEMENT_S => 2,
        _ => 1,
    }
}

fn default_charge(t: u8) -> f32 {
    match t {
        ELEMENT_H => 0.12,
        ELEMENT_C => 0.0,
        ELEMENT_N => -0.18,
        ELEMENT_O => -0.28,
        ELEMENT_P => 0.22,
        ELEMENT_S => -0.08,
        _ => 0.0,
    }
}
