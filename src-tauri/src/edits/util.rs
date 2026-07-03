pub fn clamp01(v: f32) -> f32 { v.clamp(0.0, 1.0) }
pub fn clamp(v: f32, lo: f32, hi: f32) -> f32 { v.clamp(lo, hi) }
pub fn lerp(a: f32, b: f32, t: f32) -> f32 { a + (b - a) * t }

fn sample(data: &[f32], width: u32, x: u32, y: u32, channel: u32) -> f32 {
    data[((y * width + x) * 3 + channel) as usize]
}

pub fn sample_bilinear(data: &[f32], width: u32, height: u32, x: f32, y: f32) -> [f32; 3] {
    let w = width as f32;
    let h = height as f32;
    let x = x.clamp(0.0, w - 1.0);
    let y = y.clamp(0.0, h - 1.0);
    let x0 = x.floor() as u32;
    let y0 = y.floor() as u32;
    let x1 = (x0 + 1).min(width - 1);
    let y1 = (y0 + 1).min(height - 1);
    let xf = x - x0 as f32;
    let yf = y - y0 as f32;
    let mut out = [0.0f32; 3];
    for c in 0..3u32 {
        let p00 = sample(data, width, x0, y0, c);
        let p10 = sample(data, width, x1, y0, c);
        let p01 = sample(data, width, x0, y1, c);
        let p11 = sample(data, width, x1, y1, c);
        let top = p00 * (1.0 - xf) + p10 * xf;
        let bottom = p01 * (1.0 - xf) + p11 * xf;
        out[c as usize] = top * (1.0 - yf) + bottom * yf;
    }
    out
}

pub fn gaussian_blur(data: &[f32], width: u32, height: u32, sigma: f32) -> Vec<f32> {
    if sigma <= 0.01 {
        return data.to_vec();
    }
    let radius = (sigma * 3.0).ceil() as i32;
    let mut kernel = Vec::new();
    let mut sum = 0.0f32;
    for i in -radius..=radius {
        let v = (-0.5 * (i as f32 / sigma).powi(2)).exp();
        kernel.push(v);
        sum += v;
    }
    for v in &mut kernel {
        *v /= sum;
    }
    let w = width as i32;
    let h = height as i32;
    let mut temp = vec![0.0f32; data.len()];
    let mut out = vec![0.0f32; data.len()];
    for y in 0..h {
        for x in 0..w {
            for c in 0..3i32 {
                let mut s = 0.0f32;
                for (ki, &kw) in kernel.iter().enumerate() {
                    let sx = (x + ki as i32 - radius).clamp(0, w - 1) as u32;
                    s += sample(data, width, sx, y as u32, c as u32) * kw;
                }
                temp[((y * w + x) * 3 + c) as usize] = s;
            }
        }
    }
    for y in 0..h {
        for x in 0..w {
            for c in 0..3i32 {
                let mut s = 0.0f32;
                for (ki, &kw) in kernel.iter().enumerate() {
                    let sy = (y + ki as i32 - radius).clamp(0, h - 1) as u32;
                    s += sample(&temp, width, x as u32, sy, c as u32) * kw;
                }
                out[((y * w + x) * 3 + c) as usize] = s;
            }
        }
    }
    out
}

pub struct Homography {
    pub m: [[f32; 3]; 3],
}

impl Homography {
    pub fn transform(&self, x: f32, y: f32) -> (f32, f32) {
        let hx = self.m[0][0] * x + self.m[0][1] * y + self.m[0][2];
        let hy = self.m[1][0] * x + self.m[1][1] * y + self.m[1][2];
        let hw = self.m[2][0] * x + self.m[2][1] * y + self.m[2][2];
        if hw.abs() < 1e-8 {
            return (x, y);
        }
        (hx / hw, hy / hw)
    }

    pub fn from_quad_to_quad(src: &[[f32; 2]; 4], dst: &[[f32; 2]; 4]) -> Self {
        let mut a = [[0.0f32; 8]; 8];
        let mut b = [0.0f32; 8];
        for i in 0..4 {
            let (sx, sy) = (src[i][0], src[i][1]);
            let (dx, dy) = (dst[i][0], dst[i][1]);
            a[i * 2] = [sx, sy, 1.0, 0.0, 0.0, 0.0, -dx * sx, -dx * sy];
            b[i * 2] = dx;
            a[i * 2 + 1] = [0.0, 0.0, 0.0, sx, sy, 1.0, -dy * sx, -dy * sy];
            b[i * 2 + 1] = dy;
        }
        let h = solve_8x8(&a, &b);
        Self {
            m: [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1.0]],
        }
    }
}

fn solve_8x8(a: &[[f32; 8]; 8], b: &[f32; 8]) -> [f32; 8] {
    let mut mat = [[0.0f32; 9]; 8];
    for i in 0..8 {
        mat[i][..8].copy_from_slice(&a[i]);
        mat[i][8] = b[i];
    }
    for col in 0..8 {
        let mut pivot = col;
        for row in (col + 1)..8 {
            if mat[row][col].abs() > mat[pivot][col].abs() {
                pivot = row;
            }
        }
        mat.swap(col, pivot);
        let div = mat[col][col];
        if div.abs() < 1e-10 {
            continue;
        }
        for j in col..9 {
            mat[col][j] /= div;
        }
        for row in 0..8 {
            if row == col {
                continue;
            }
            let f = mat[row][col];
            for j in col..9 {
                mat[row][j] -= f * mat[col][j];
            }
        }
    }
    let mut out = [0.0f32; 8];
    for i in 0..8 {
        out[i] = mat[i][8];
    }
    out
}

pub fn linear_to_srgb(v: f32) -> f32 {
    if v <= 0.0031308 { v * 12.92 } else { 1.055 * v.powf(1.0 / 2.4) - 0.055 }
}

pub fn srgb_to_linear(v: f32) -> f32 {
    if v <= 0.04045 {
        v / 12.92
    } else {
        ((v + 0.055) / 1.055).powf(2.4)
    }
}

/// Run a per-pixel RGB adjustment in display (sRGB) space for perceptually even color edits.
pub fn map_pixels_display_space(data: &mut [f32], mut f: impl FnMut(f32, f32, f32) -> (f32, f32, f32)) {
    for px in data.chunks_exact_mut(3) {
        let r = linear_to_srgb(px[0].max(0.0));
        let g = linear_to_srgb(px[1].max(0.0));
        let b = linear_to_srgb(px[2].max(0.0));
        let (nr, ng, nb) = f(r, g, b);
        px[0] = srgb_to_linear(nr.clamp(0.0, 1.0));
        px[1] = srgb_to_linear(ng.clamp(0.0, 1.0));
        px[2] = srgb_to_linear(nb.clamp(0.0, 1.0));
    }
}

pub fn luminance(r: f32, g: f32, b: f32) -> f32 {
    0.2126 * r + 0.7152 * g + 0.0722 * b
}

pub fn smoothstep(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

pub fn rgb_to_hsl(r: f32, g: f32, b: f32) -> (f32, f32, f32) {
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let l = (max + min) * 0.5;
    if (max - min).abs() < 1e-6 { return (0.0, 0.0, l); }
    let d = max - min;
    let s = if l > 0.5 { d / (2.0 - max - min) } else { d / (max + min) };
    let h = if (max - r).abs() < 1e-6 {
        ((g - b) / d + if g < b { 6.0 } else { 0.0 }) / 6.0
    } else if (max - g).abs() < 1e-6 {
        ((b - r) / d + 2.0) / 6.0
    } else {
        ((r - g) / d + 4.0) / 6.0
    };
    (h, s, l)
}

pub fn hsl_to_rgb(h: f32, s: f32, l: f32) -> (f32, f32, f32) {
    if s.abs() < 1e-6 { return (l, l, l); }
    let q = if l < 0.5 { l * (1.0 + s) } else { l + s - l * s };
    let p = 2.0 * l - q;
    let hue = |p: f32, q: f32, mut t: f32| -> f32 {
        if t < 0.0 { t += 1.0; }
        if t > 1.0 { t -= 1.0; }
        if t < 1.0 / 6.0 { p + (q - p) * 6.0 * t }
        else if t < 0.5 { q }
        else if t < 2.0 / 3.0 { p + (q - p) * (2.0 / 3.0 - t) * 6.0 }
        else { p }
    };
    (hue(p, q, h + 1.0 / 3.0), hue(p, q, h), hue(p, q, h - 1.0 / 3.0))
}
