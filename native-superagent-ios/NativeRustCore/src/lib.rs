#![allow(clippy::missing_safety_doc)]

use core::slice;

#[no_mangle]
pub extern "C" fn sa_rust_hash64(data: *const u8, len: usize) -> u64 {
    if data.is_null() || len == 0 {
        return 0xcbf29ce484222325;
    }
    let bytes = unsafe { slice::from_raw_parts(data, len) };
    let mut h = 0xcbf29ce484222325u64;
    for &b in bytes {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

#[no_mangle]
pub extern "C" fn sa_rust_mean(values: *const f64, len: usize) -> f64 {
    if values.is_null() || len == 0 {
        return f64::NAN;
    }
    let values = unsafe { slice::from_raw_parts(values, len) };
    let mut sum = 0.0;
    let mut compensation = 0.0;
    for &x in values {
        let y = x - compensation;
        let t = sum + y;
        compensation = (t - sum) - y;
        sum = t;
    }
    sum / len as f64
}

#[no_mangle]
pub extern "C" fn sa_rust_xorshift_fill(seed: u64, out: *mut u64, len: usize) {
    if out.is_null() || len == 0 {
        return;
    }
    let out = unsafe { slice::from_raw_parts_mut(out, len) };
    let mut x = if seed == 0 { 0x9e3779b97f4a7c15 } else { seed };
    for slot in out {
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        *slot = x;
    }
}
