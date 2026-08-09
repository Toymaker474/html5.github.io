use wasm_bindgen::prelude::*;

const C: u8 = 0;
const H: u8 = 1;
const O: u8 = 2;
const N: u8 = 3;
const P: u8 = 4;
const S: u8 = 5;

#[wasm_bindgen]
pub struct Genesis {
    width: f32,
    height: f32,
    temperature: f32,
    time_scale: f32,
    pressure: f32,
    dielectric: f32,
    reaction_rate: f32,
    bond_strength: f32,
    uv_flux: f32,
    solvent_drag: f32,
    seed: u32,
    types: Vec<u8>,
    pos: Vec<f32>,
    vel: Vec<f32>,
    charge: Vec<f32>,
    bonds: Vec<u32>,
    bond_age: Vec<f32>,
    formed_total: u32,
    broken_total: u32,
    molecule_count_cache: u32,
    largest_molecule_cache: u32,
    kinetic_cache: f32,
    potential_cache: f32,
    chemistry_timer: f32,
}

#[wasm_bindgen]
impl Genesis {
    #[wasm_bindgen(constructor)]
    pub fn new(atom_count: usize, width: f32, height: f32, seed: u32) -> Genesis {
        console_error_panic_hook::set_once();
        let mut sim = Genesis {
            width: width.max(64.0),
            height: height.max(64.0),
            temperature: 320.0,
            time_scale: 1.0,
            pressure: 1.0,
            dielectric: 18.0,
            reaction_rate: 1.0,
            bond_strength: 1.0,
            uv_flux: 0.15,
            solvent_drag: 0.994,
            seed: seed.max(1),
            types: Vec::with_capacity(atom_count),
            pos: Vec::with_capacity(atom_count * 2),
            vel: Vec::with_capacity(atom_count * 2),
            charge: Vec::with_capacity(atom_count),
            bonds: Vec::new(),
            bond_age: Vec::new(),
            formed_total: 0,
            broken_total: 0,
            molecule_count_cache: atom_count as u32,
            largest_molecule_cache: 1,
            kinetic_cache: 0.0,
            potential_cache: 0.0,
            chemistry_timer: 0.0,
        };
        sim.seed_atoms(atom_count);
        sim.recompute_graph_stats();
        sim
    }

    pub fn atom_count(&self) -> usize { self.types.len() }
    pub fn bond_count(&self) -> usize { self.bonds.len() / 2 }
    pub fn molecule_count(&self) -> u32 { self.molecule_count_cache }
    pub fn largest_molecule(&self) -> u32 { self.largest_molecule_cache }
    pub fn formed_total(&self) -> u32 { self.formed_total }
    pub fn broken_total(&self) -> u32 { self.broken_total }
    pub fn kinetic_energy(&self) -> f32 { self.kinetic_cache }
    pub fn potential_energy(&self) -> f32 { self.potential_cache }
    pub fn temperature(&self) -> f32 { self.temperature }

    pub fn set_temperature(&mut self, value: f32) { self.temperature = value.clamp(60.0, 1600.0); }
    pub fn set_time_scale(&mut self, value: f32) { self.time_scale = value.clamp(0.05, 12.0); }
    pub fn set_pressure(&mut self, value: f32) { self.pressure = value.clamp(0.1, 12.0); }
    pub fn set_dielectric(&mut self, value: f32) { self.dielectric = value.clamp(1.0, 80.0); }
    pub fn set_reaction_rate(&mut self, value: f32) { self.reaction_rate = value.clamp(0.0, 8.0); }
    pub fn set_bond_strength(&mut self, value: f32) { self.bond_strength = value.clamp(0.2, 4.0); }
    pub fn set_uv_flux(&mut self, value: f32) { self.uv_flux = value.clamp(0.0, 5.0); }
    pub fn set_solvent_drag(&mut self, value: f32) { self.solvent_drag = value.clamp(0.90, 0.9999); }

    pub fn positions(&self) -> js_sys::Float32Array { js_sys::Float32Array::from(self.pos.as_slice()) }
    pub fn velocities(&self) -> js_sys::Float32Array { js_sys::Float32Array::from(self.vel.as_slice()) }
    pub fn atom_types(&self) -> js_sys::Uint8Array { js_sys::Uint8Array::from(self.types.as_slice()) }
    pub fn bond_pairs(&self) -> js_sys::Uint32Array { js_sys::Uint32Array::from(self.bonds.as_slice()) }

    pub fn add_energy_pulse(&mut self, x: f32, y: f32, radius: f32, strength: f32) {
        let r2 = radius * radius;
        for i in 0..self.types.len() {
            let dx = self.pos[i * 2] - x;
            let dy = self.pos[i * 2 + 1] - y;
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
        let dt = (dt * self.time_scale).clamp(0.0001, 0.025);
        let n = self.types.len();
        if n == 0 { return; }

        let cutoff = 28.0f32;
        let cell_size = cutoff;
        let cols = ((self.width / cell_size).ceil() as usize).max(1);
        let rows = ((self.height / cell_size).ceil() as usize).max(1);
        let mut grid: Vec<Vec<usize>> = (0..cols * rows).map(|_| Vec::new()).collect();
        for i in 0..n {
            let gx = ((self.pos[i * 2] / cell_size).floor() as isize).clamp(0, cols as isize - 1) as usize;
            let gy = ((self.pos[i * 2 + 1] / cell_size).floor() as isize).clamp(0, rows as isize - 1) as usize;
            grid[gy * cols + gx].push(i);
        }

        let mut force = vec![0.0f32; n * 2];
        let mut potential = 0.0f32;
        let cutoff2 = cutoff * cutoff;
        for gy in 0..rows {
            for gx in 0..cols {
                let bucket = gy * cols + gx;
                for &i in &grid[bucket] {
                    let min_x = gx.saturating_sub(1);
                    let max_x = (gx + 1).min(cols - 1);
                    let min_y = gy.saturating_sub(1);
                    let max_y = (gy + 1).min(rows - 1);
                    for ny in min_y..=max_y {
                        for nx in min_x..=max_x {
                            for &j in &grid[ny * cols + nx] {
                                if j <= i { continue; }
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
                                let epsilon = pair_epsilon(self.types[i], self.types[j]);
                                let lj_p = 4.0 * epsilon * (sr6 * sr6 - sr6);
                                let lj_f = 24.0 * epsilon * (2.0 * sr6 * sr6 - sr6) * inv;
                                let ck = 120.0 / self.dielectric.max(1.0);
                                let cp = ck * self.charge[i] * self.charge[j] * inv;
                                let cf = ck * self.charge[i] * self.charge[j] / (d2 + 2.0);
                                let f = (lj_f + cf).clamp(-120.0, 120.0);
                                let fx = dx * inv * f;
                                let fy = dy * inv * f;
                                force[i * 2] -= fx;
                                force[i * 2 + 1] -= fy;
                                force[j * 2] += fx;
                                force[j * 2 + 1] += fy;
                                potential += lj_p + cp;
                            }
                        }
                    }
                }
            }
        }

        self.try_form_bonds(&grid, cols, rows, cell_size, dt);
        self.solve_bonds_and_break(&mut force, dt, &mut potential);
        self.solve_angle_constraints(&mut force);

        let thermal = (self.temperature / 320.0).sqrt() * 3.0;
        let drag = self.solvent_drag.powf(dt * 60.0);
        let uv_kick = self.uv_flux * 0.18;
        let mut kinetic = 0.0f32;
        for i in 0..n {
            let nx = (self.rand01() - 0.5) * thermal;
            let ny = (self.rand01() - 0.5) * thermal;
            let ux = (self.rand01() - 0.5) * uv_kick;
            let uy = (self.rand01() - 0.5) * uv_kick;
            self.vel[i * 2] = (self.vel[i * 2] + force[i * 2] * dt + (nx + ux) * dt) * drag;
            self.vel[i * 2 + 1] = (self.vel[i * 2 + 1] + force[i * 2 + 1] * dt + (ny + uy) * dt) * drag;
            self.pos[i * 2] += self.vel[i * 2] * dt * 60.0;
            self.pos[i * 2 + 1] += self.vel[i * 2 + 1] * dt * 60.0;

            let confinement = (self.pressure - 1.0).max(0.0) * 0.0006;
            self.vel[i * 2] += (self.width * 0.5 - self.pos[i * 2]) * confinement;
            self.vel[i * 2 + 1] += (self.height * 0.5 - self.pos[i * 2 + 1]) * confinement;

            if self.pos[i * 2] < 0.0 { self.pos[i * 2] = 0.0; self.vel[i * 2] *= -0.75; }
            if self.pos[i * 2] > self.width { self.pos[i * 2] = self.width; self.vel[i * 2] *= -0.75; }
            if self.pos[i * 2 + 1] < 0.0 { self.pos[i * 2 + 1] = 0.0; self.vel[i * 2 + 1] *= -0.75; }
            if self.pos[i * 2 + 1] > self.height { self.pos[i * 2 + 1] = self.height; self.vel[i * 2 + 1] *= -0.75; }

            let vx = self.vel[i * 2];
            let vy = self.vel[i * 2 + 1];
            kinetic += 0.5 * atomic_mass(self.types[i]) * (vx * vx + vy * vy);
        }
        self.kinetic_cache = kinetic;
        self.potential_cache = potential;
        self.chemistry_timer += dt;
        if self.chemistry_timer >= 0.15 {
            self.chemistry_timer = 0.0;
            self.recompute_graph_stats();
        }
    }
}

impl Genesis {
    fn seed_atoms(&mut self, count: usize) {
        let mix = [H, H, H, C, C, O, O, N, P, S];
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

    fn try_form_bonds(&mut self, grid: &[Vec<usize>], cols: usize, rows: usize, cell_size: f32, dt: f32) {
        let n = self.types.len();
        let mut degree = vec![0u8; n];
        for pair in self.bonds.chunks_exact(2) {
            let a = pair[0] as usize;
            let b = pair[1] as usize;
            if a < n && b < n {
                degree[a] = degree[a].saturating_add(1);
                degree[b] = degree[b].saturating_add(1);
            }
        }
        let mut candidates = Vec::new();
        for i in 0..n {
            if degree[i] >= valence(self.types[i]) { continue; }
            let gx = ((self.pos[i * 2] / cell_size).floor() as isize).clamp(0, cols as isize - 1) as usize;
            let gy = ((self.pos[i * 2 + 1] / cell_size).floor() as isize).clamp(0, rows as isize - 1) as usize;
            for ny in gy.saturating_sub(1)..=(gy + 1).min(rows - 1) {
                for nx in gx.saturating_sub(1)..=(gx + 1).min(cols - 1) {
                    for &j in &grid[ny * cols + nx] {
                        if j <= i || degree[j] >= valence(self.types[j]) || self.is_bonded(i, j) { continue; }
                        let dx = self.pos[j * 2] - self.pos[i * 2];
                        let dy = self.pos[j * 2 + 1] - self.pos[i * 2 + 1];
                        let d2 = dx * dx + dy * dy;
                        let capture = bond_capture_radius(self.types[i], self.types[j]);
                        if d2 > capture * capture { continue; }
                        let rvx = self.vel[j * 2] - self.vel[i * 2];
                        let rvy = self.vel[j * 2 + 1] - self.vel[i * 2 + 1];
                        let relative_ke = 0.5 * (rvx * rvx + rvy * rvy);
                        let barrier = activation_barrier(self.types[i], self.types[j]);
                        let thermal = (self.temperature / 320.0).sqrt();
                        let alignment = 1.0 / (1.0 + relative_ke * 0.35);
                        let probability = self.reaction_rate * thermal * alignment * (-barrier / (self.temperature / 240.0).max(0.1)).exp() * dt * 6.0;
                        candidates.push((i, j, probability.clamp(0.0, 0.7)));
                    }
                }
            }
        }
        for (i, j, probability) in candidates {
            if degree[i] >= valence(self.types[i]) || degree[j] >= valence(self.types[j]) || self.is_bonded(i, j) { continue; }
            if self.rand01() < probability {
                self.bonds.push(i as u32);
                self.bonds.push(j as u32);
                self.bond_age.push(0.0);
                degree[i] += 1;
                degree[j] += 1;
                self.formed_total = self.formed_total.saturating_add(1);
            }
        }
    }

    fn solve_bonds_and_break(&mut self, force: &mut [f32], dt: f32, potential: &mut f32) {
        let n = self.types.len();
        let count = self.bonds.len() / 2;
        let mut keep = vec![true; count];
        let mut probs = vec![0.0f32; count];
        for bi in 0..count {
            let a = self.bonds[bi * 2] as usize;
            let b = self.bonds[bi * 2 + 1] as usize;
            if a >= n || b >= n { keep[bi] = false; continue; }
            self.bond_age[bi] += dt;
            let dx = self.pos[b * 2] - self.pos[a * 2];
            let dy = self.pos[b * 2 + 1] - self.pos[a * 2 + 1];
            let d = (dx * dx + dy * dy).sqrt().max(0.001);
            let target = bond_length(self.types[a], self.types[b]);
            let stretch = d - target;
            let k = 38.0 * self.bond_strength * bond_order_strength(self.types[a], self.types[b]);
            let fx = dx / d * stretch * k;
            let fy = dy / d * stretch * k;
            force[a * 2] += fx;
            force[a * 2 + 1] += fy;
            force[b * 2] -= fx;
            force[b * 2 + 1] -= fy;
            *potential += 0.5 * k * stretch * stretch;
            let strain = stretch.abs() / target.max(0.1);
            let thermal_break = (self.temperature / bond_dissociation_temp(self.types[a], self.types[b])).powi(3);
            let uv_break = self.uv_flux * photo_sensitivity(self.types[a], self.types[b]);
            probs[bi] = ((strain - 0.38).max(0.0) * 1.6 + thermal_break * 0.012 + uv_break * 0.004) * dt * 60.0;
        }
        for bi in 0..count {
            if keep[bi] && self.bond_age[bi] > 0.08 && self.rand01() < probs[bi].clamp(0.0, 0.65) {
                keep[bi] = false;
                self.broken_total = self.broken_total.saturating_add(1);
            }
        }
        if keep.iter().any(|v| !*v) {
            let mut new_bonds = Vec::with_capacity(self.bonds.len());
            let mut new_age = Vec::with_capacity(self.bond_age.len());
            for bi in 0..count {
                if keep[bi] {
                    new_bonds.push(self.bonds[bi * 2]);
                    new_bonds.push(self.bonds[bi * 2 + 1]);
                    new_age.push(self.bond_age[bi]);
                }
            }
            self.bonds = new_bonds;
            self.bond_age = new_age;
        }
    }

    fn solve_angle_constraints(&self, force: &mut [f32]) {
        let n = self.types.len();
        let mut neighbors: Vec<Vec<usize>> = (0..n).map(|_| Vec::new()).collect();
        for pair in self.bonds.chunks_exact(2) {
            let a = pair[0] as usize;
            let b = pair[1] as usize;
            if a < n && b < n { neighbors[a].push(b); neighbors[b].push(a); }
        }
        for center in 0..n {
            if neighbors[center].len() < 2 { continue; }
            let ideal = ideal_angle(self.types[center]);
            for ia in 0..neighbors[center].len() {
                for ib in (ia + 1)..neighbors[center].len() {
                    let a = neighbors[center][ia];
                    let b = neighbors[center][ib];
                    let ax = self.pos[a * 2] - self.pos[center * 2];
                    let ay = self.pos[a * 2 + 1] - self.pos[center * 2 + 1];
                    let bx = self.pos[b * 2] - self.pos[center * 2];
                    let by = self.pos[b * 2 + 1] - self.pos[center * 2 + 1];
                    let al = (ax * ax + ay * ay).sqrt().max(0.001);
                    let bl = (bx * bx + by * by).sqrt().max(0.001);
                    let theta = ((ax * bx + ay * by) / (al * bl)).clamp(-1.0, 1.0).acos();
                    let error = theta - ideal;
                    if error.abs() < 0.01 { continue; }
                    let strength = 0.55 * error;
                    let pax = -ay / al;
                    let pay = ax / al;
                    let pbx = by / bl;
                    let pby = -bx / bl;
                    force[a * 2] += pax * strength;
                    force[a * 2 + 1] += pay * strength;
                    force[b * 2] += pbx * strength;
                    force[b * 2 + 1] += pby * strength;
                    force[center * 2] -= (pax + pbx) * strength * 0.5;
                    force[center * 2 + 1] -= (pay + pby) * strength * 0.5;
                }
            }
        }
    }

    fn recompute_graph_stats(&mut self) {
        let n = self.types.len();
        if n == 0 { self.molecule_count_cache = 0; self.largest_molecule_cache = 0; return; }
        let mut parent: Vec<usize> = (0..n).collect();
        let mut size = vec![1u32; n];
        for pair in self.bonds.chunks_exact(2) {
            let a = pair[0] as usize;
            let b = pair[1] as usize;
            if a >= n || b >= n { continue; }
            let ra = find_root(&mut parent, a);
            let rb = find_root(&mut parent, b);
            if ra != rb {
                if size[ra] < size[rb] { parent[ra] = rb; size[rb] += size[ra]; }
                else { parent[rb] = ra; size[ra] += size[rb]; }
            }
        }
        let mut molecules = 0u32;
        let mut largest = 1u32;
        for i in 0..n {
            if find_root(&mut parent, i) == i { molecules += 1; largest = largest.max(size[i]); }
        }
        self.molecule_count_cache = molecules;
        self.largest_molecule_cache = largest;
    }

    fn is_bonded(&self, a: usize, b: usize) -> bool {
        self.bonds.chunks_exact(2).any(|p| (p[0] as usize == a && p[1] as usize == b) || (p[0] as usize == b && p[1] as usize == a))
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

fn find_root(parent: &mut [usize], x: usize) -> usize {
    let mut root = x;
    while parent[root] != root { root = parent[root]; }
    let mut node = x;
    while parent[node] != node { let next = parent[node]; parent[node] = root; node = next; }
    root
}

fn atomic_radius(t: u8) -> f32 { match t { H => 3.0, C => 4.8, N => 4.5, O => 4.3, P => 5.3, S => 5.1, _ => 4.0 } }
fn atomic_mass(t: u8) -> f32 { match t { H => 1.0, C => 12.0, N => 14.0, O => 16.0, P => 31.0, S => 32.0, _ => 12.0 } }
fn valence(t: u8) -> u8 { match t { H => 1, C => 4, N => 3, O => 2, P => 5, S => 2, _ => 1 } }
fn default_charge(t: u8) -> f32 { match t { H => 0.12, C => 0.0, N => -0.18, O => -0.28, P => 0.22, S => -0.08, _ => 0.0 } }
fn pair_epsilon(a: u8, b: u8) -> f32 { if matches!(a, O | N | P) || matches!(b, O | N | P) { 2.2 } else { 1.35 } }
fn bond_capture_radius(a: u8, b: u8) -> f32 { 1.18 * (atomic_radius(a) + atomic_radius(b)) }
fn bond_length(a: u8, b: u8) -> f32 { 0.86 * (atomic_radius(a) + atomic_radius(b)) }
fn activation_barrier(a: u8, b: u8) -> f32 { match (a, b) { (H, O) | (O, H) => 0.7, (C, O) | (O, C) => 1.0, (C, N) | (N, C) => 1.1, (P, O) | (O, P) => 0.8, _ => 1.35 } }
fn bond_order_strength(a: u8, b: u8) -> f32 { match (a, b) { (C, C) => 1.15, (C, O) | (O, C) => 1.2, (P, O) | (O, P) => 1.1, _ => 1.0 } }
fn bond_dissociation_temp(a: u8, b: u8) -> f32 { 520.0 + 120.0 * bond_order_strength(a, b) }
fn photo_sensitivity(a: u8, b: u8) -> f32 { if matches!(a, S | P) || matches!(b, S | P) { 1.4 } else { 0.7 } }
fn ideal_angle(t: u8) -> f32 { match t { C => 109.5_f32.to_radians(), N => 107.0_f32.to_radians(), O => 104.5_f32.to_radians(), P => 109.5_f32.to_radians(), _ => 180.0_f32.to_radians() } }
