use super::util::{linear_to_srgb, luminance, map_pixels_display_space, smoothstep};
use super::EDIT_STRENGTH;

/// Scale for basic develop sliders that felt too intense at full strength.
const BASIC_INTENSITY: f32 = 0.1;

/// EV adjustment in linear space, luminance-weighted (preserves chroma).
/// Strength tuned below full slider range so ±1 EV feels natural in the UI.
const EXPOSURE_STRENGTH: f32 = 0.55 * BASIC_INTENSITY;
/// Slightly stronger than other basic sliders; contrast felt too subtle at full slider.
const CONTRAST_STRENGTH: f32 = 0.2;
const SHADOWS_STRENGTH: f32 = 0.55;
const HIGHLIGHTS_STRENGTH: f32 = 0.75;
const HIGHLIGHTS_AMOUNT: f32 = 0.55;
const VIBRANCE_STRENGTH: f32 = 0.38 * BASIC_INTENSITY;
const SATURATION_STRENGTH: f32 = EDIT_STRENGTH * BASIC_INTENSITY;
const WHITES_BLACKS_STRENGTH: f32 = EDIT_STRENGTH * BASIC_INTENSITY;
const TINT_STRENGTH: f32 = 0.15 * BASIC_INTENSITY;

pub fn apply_exposure(p: &mut [f32], ev: f32) {
    if ev.abs() < f32::EPSILON {
        return;
    }
    let gain = 2.0_f32.powf(ev * EXPOSURE_STRENGTH);
    for px in p.chunks_exact_mut(3) {
        let l = luminance(px[0], px[1], px[2]);
        if l < 1e-8 {
            px[0] *= gain;
            px[1] *= gain;
            px[2] *= gain;
            continue;
        }
        let new_l = map_exposure_luminance(l, gain, ev);
        let ratio = new_l / l;
        px[0] = (px[0] * ratio).max(0.0);
        px[1] = (px[1] * ratio).max(0.0);
        px[2] = (px[2] * ratio).max(0.0);
    }
}

/// Contrast pivot at 18% gray; gentler positive/negative curves than before.
pub fn apply_contrast(p: &mut [f32], amount: f32) {
    if amount.abs() < 0.01 {
        return;
    }
    let n = amount / 100.0 * CONTRAST_STRENGTH;
    let factor = if n >= 0.0 {
        1.0 + n * 0.95
    } else {
        1.0 / (1.0 - n * 0.5)
    };
    const PIVOT: f32 = 0.18;
    for c in p.iter_mut() {
        *c = (PIVOT + (*c - PIVOT) * factor).max(0.0);
    }
}

/// Region-weighted highlight recovery / shadow lift using luminance-ratio scaling.
pub fn apply_highlights_shadows(p: &mut [f32], highlights: f32, shadows: f32) {
    if highlights.abs() < 0.01 && shadows.abs() < 0.01 {
        return;
    }
    let hs = highlights / 100.0 * HIGHLIGHTS_STRENGTH;
    let ss = shadows / 100.0 * SHADOWS_STRENGTH;
    for px in p.chunks_exact_mut(3) {
        let l = luminance(px[0], px[1], px[2]);
        let mut new_l = l;

        if highlights.abs() >= 0.01 {
            let r = linear_to_srgb(px[0].max(0.0));
            let g = linear_to_srgb(px[1].max(0.0));
            let b = linear_to_srgb(px[2].max(0.0));
            let l_disp = luminance(r, g, b);
            let mask = smoothstep(0.55, 0.95, l_disp);
            let factor = 1.0 - hs * mask * HIGHLIGHTS_AMOUNT;
            new_l *= factor;
        }
        if shadows.abs() >= 0.01 {
            let r = linear_to_srgb(px[0].max(0.0));
            let g = linear_to_srgb(px[1].max(0.0));
            let b = linear_to_srgb(px[2].max(0.0));
            let l_disp = luminance(r, g, b);
            let mask = 1.0 - smoothstep(0.02, 0.42, l_disp);
            new_l += ss * mask * 0.22;
        }

        new_l = new_l.max(0.0);
        if l > 1e-6 {
            let ratio = new_l / l;
            px[0] = (px[0] * ratio).max(0.0);
            px[1] = (px[1] * ratio).max(0.0);
            px[2] = (px[2] * ratio).max(0.0);
        } else {
            px[0] = new_l;
            px[1] = new_l;
            px[2] = new_l;
        }
    }
}

/// Whites / blacks endpoint adjustments; blacks lift reduced for subtler toe control.
pub fn apply_whites_blacks(p: &mut [f32], whites: f32, blacks: f32) {
    if whites.abs() < 0.01 && blacks.abs() < 0.01 {
        return;
    }
    let ws = whites / 100.0 * WHITES_BLACKS_STRENGTH;
    let bs = blacks / 100.0 * WHITES_BLACKS_STRENGTH;
    const BLACKS_LIFT: f32 = 0.18;
    const WHITES_LIFT: f32 = 0.38;
    for px in p.chunks_exact_mut(3) {
        let l = luminance(px[0], px[1], px[2]);
        if blacks.abs() >= 0.01 {
            let mask = 1.0 - smoothstep(0.0, 0.48, l);
            let lift = bs * mask * BLACKS_LIFT;
            px[0] += lift;
            px[1] += lift;
            px[2] += lift;
        }
        if whites.abs() >= 0.01 {
            let mask = smoothstep(0.52, 1.0, l);
            let lift = ws * mask * WHITES_LIFT;
            px[0] += lift;
            px[1] += lift;
            px[2] += lift;
        }
        px[0] = px[0].max(0.0);
        px[1] = px[1].max(0.0);
        px[2] = px[2].max(0.0);
    }
}

pub fn apply_white_balance(
    p: &mut [f32],
    temp: f32,
    tint: f32,
    baseline_temp: f32,
    baseline_tint: f32,
) {
    if (temp - baseline_temp).abs() < 1.0 && (tint - baseline_tint).abs() < 0.01 {
        return;
    }
    let m = wb(temp, tint);
    let b = wb(baseline_temp, baseline_tint);
    for px in p.chunks_exact_mut(3) {
        px[0] *= m[0] / b[0];
        px[1] *= m[1] / b[1];
        px[2] *= m[2] / b[2];
    }
}

pub fn apply_vibrance_saturation(p: &mut [f32], vibrance: f32, saturation: f32) {
    if vibrance.abs() < 0.01 && saturation.abs() < 0.01 {
        return;
    }
    let sat = 1.0 + saturation / 100.0 * SATURATION_STRENGTH;
    let vib = vibrance / 100.0 * VIBRANCE_STRENGTH;
    map_pixels_display_space(p, |r, g, b| {
        let (h, mut sl, l) = rgb_to_hsl_local(r, g, b);
        sl = (sl * sat + vib * (1.0 - sl) * (1.0 - sl)).clamp(0.0, 1.0);
        hsl_to_rgb_local(h, sl, l)
    });
}

pub fn white_balance_multipliers(temp: f32, tint: f32) -> [f32; 3] {
    wb(temp, tint)
}

/// Positive EV: midtone-weighted log2 gain with filmic shoulder above unity.
fn map_exposure_luminance(l: f32, gain: f32, ev: f32) -> f32 {
    if ev < 0.0 {
        return l * gain;
    }
    // Exposure2012-style: strongest lift near 18% gray, less in toe and shoulder.
    let mid_weight = smoothstep(0.01, 0.14, l) * (1.0 - smoothstep(0.45, 0.92, l));
    let effective_gain = 1.0 + (gain - 1.0) * mid_weight;
    filmic_shoulder(l * effective_gain)
}

/// Soft highlight rolloff: linear below 1.0, compressive shoulder above.
fn filmic_shoulder(x: f32) -> f32 {
    if x <= 1.0 {
        x
    } else {
        let overshoot = x - 1.0;
        1.0 + overshoot / (1.0 + overshoot * 1.6)
    }
}

fn wb(temp: f32, tint: f32) -> [f32; 3] {
    let t = temp_to_rgb(temp.clamp(2000.0, 50000.0));
    let r = temp_to_rgb(6500.0);
    let mut rgb = [t[0] / r[0], t[1] / r[1], t[2] / r[2]];
    let tf = 1.0 + tint / 150.0 * TINT_STRENGTH;
    rgb[1] *= tf;
    rgb[0] /= tf.sqrt();
    rgb[2] *= tf.sqrt();
    let m = rgb[0].max(rgb[1]).max(rgb[2]);
    [rgb[0] / m, rgb[1] / m, rgb[2] / m]
}

fn temp_to_rgb(k: f32) -> [f32; 3] {
    let t = (k / 100.0).clamp(10.0, 500.0);
    let r = if t <= 66.0 {
        1.0
    } else {
        (329.698727446 * (t - 60.0).powf(-0.1332047592) / 255.0).clamp(0.0, 1.0)
    };
    let g = ((if t <= 66.0 {
        99.4708025861 * t.ln() - 161.1195681661
    } else {
        288.1221695283 * (t - 60.0).powf(-0.0755148492)
    }) / 255.0)
        .clamp(0.0, 1.0);
    let b = if t >= 66.0 {
        1.0
    } else if t <= 19.0 {
        0.0
    } else {
        (138.5177312231 * (t - 10.0).ln() - 305.0447927307) / 255.0
    }
    .clamp(0.0, 1.0);
    [r, g, b]
}

fn rgb_to_hsl_local(r: f32, g: f32, b: f32) -> (f32, f32, f32) {
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let l = (max + min) * 0.5;
    if (max - min).abs() < f32::EPSILON {
        return (0.0, 0.0, l);
    }
    let d = max - min;
    let s = if l > 0.5 {
        d / (2.0 - max - min)
    } else {
        d / (max + min)
    };
    let h = if (max - r).abs() < f32::EPSILON {
        ((g - b) / d + if g < b { 6.0 } else { 0.0 }) / 6.0
    } else if (max - g).abs() < f32::EPSILON {
        ((b - r) / d + 2.0) / 6.0
    } else {
        ((r - g) / d + 4.0) / 6.0
    };
    (h, s, l)
}

fn hsl_to_rgb_local(h: f32, s: f32, l: f32) -> (f32, f32, f32) {
    if s.abs() < f32::EPSILON {
        return (l, l, l);
    }
    let q = if l < 0.5 { l * (1.0 + s) } else { l + s - l * s };
    let p = 2.0 * l - q;
    (
        hue_local(p, q, h + 1.0 / 3.0),
        hue_local(p, q, h),
        hue_local(p, q, h - 1.0 / 3.0),
    )
}

fn hue_local(p: f32, q: f32, mut t: f32) -> f32 {
    if t < 0.0 {
        t += 1.0;
    }
    if t > 1.0 {
        t -= 1.0;
    }
    if t < 1.0 / 6.0 {
        p + (q - p) * 6.0 * t
    } else if t < 0.5 {
        q
    } else if t < 2.0 / 3.0 {
        p + (q - p) * (2.0 / 3.0 - t) * 6.0
    } else {
        p
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposure_boosts_midgray() {
        let mut p = vec![0.18, 0.18, 0.18];
        apply_exposure(&mut p, 1.0);
        assert!(p[0] > 0.185, "midtone should lift with +1 EV");
        assert!(p[0] < 0.22, "exposure should stay subtler than hard double");
    }

    #[test]
    fn exposure_preserves_chroma() {
        let mut p = vec![0.2, 0.4, 0.1];
        let ratio_before = p[0] / p[1];
        apply_exposure(&mut p, 0.5);
        let ratio_after = p[0] / p[1];
        assert!((ratio_before - ratio_after).abs() < 0.02);
    }

    #[test]
    fn exposure_shoulder_limits_highlights() {
        let mut p = vec![0.9, 0.9, 0.9];
        apply_exposure(&mut p, 1.0);
        assert!(p[0] < 1.35, "highlight shoulder should compress rolloff");
    }

    #[test]
    fn blacks_lift_is_subtle() {
        let mut p = vec![0.02, 0.02, 0.02];
        apply_whites_blacks(&mut p, 0.0, 100.0);
        assert!(p[0] < 0.10, "full blacks slider should not crush-lift shadows");
        assert!(p[0] > 0.03);
    }
}
