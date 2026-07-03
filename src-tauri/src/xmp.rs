use std::fs;
use std::path::Path;

use crate::edits::EditStack;

const ARAMIS_JSON_ATTR: &str = "ae:EditStackJson=\"";
const LEGACY_JSON_ATTR: &str = "lz:EditStackJson=\"";

pub fn sidecar_path(path: &Path) -> std::path::PathBuf {
    path.with_extension("xmp")
}

pub fn has_sidecar(path: &Path) -> bool {
    sidecar_path(path).is_file()
}

pub fn has_aramis_saved_edits(path: &Path) -> bool {
    let content = match fs::read_to_string(sidecar_path(path)) {
        Ok(c) => c,
        Err(_) => return false,
    };
    content.contains("ae:SavedEdits=\"True\"")
        || content.contains("lz:SavedEdits=\"True\"")
        || content.contains(ARAMIS_JSON_ATTR)
        || content.contains(LEGACY_JSON_ATTR)
}

fn escape_xml_attr(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn unescape_xml_attr(value: &str) -> String {
    value
        .replace("&quot;", "\"")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
}

fn crop_to_crs(edits: &EditStack) -> (bool, f32, f32, f32, f32, f32, f32) {
    if !edits.crop.enabled {
        return (false, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
    }
    let left = edits.crop.x;
    let top = edits.crop.y;
    let right = (1.0 - edits.crop.x - edits.crop.width).max(0.0);
    let bottom = (1.0 - edits.crop.y - edits.crop.height).max(0.0);
    (
        true,
        top,
        left,
        right,
        bottom,
        edits.crop.angle,
        edits.crop.straighten,
    )
}

fn hsl_attr(edits: &EditStack, channel: &str, index: usize) -> f32 {
    match channel {
        "Hue" => edits.hsl.hue[index],
        "Saturation" => edits.hsl.saturation[index],
        "Luminance" => edits.hsl.luminance[index],
        _ => 0.0,
    }
}

pub fn write_xmp(path: &Path, edits: &EditStack) -> Result<(), std::io::Error> {
    let json = serde_json::to_string(edits).unwrap_or_else(|_| "{}".into());
    let escaped = escape_xml_attr(&json);
    let b = &edits.basic;
    let e = &edits.effects;
    let d = &edits.detail;
    let tc = &edits.tone_curve.parametric;
    let t = &edits.transform;
    let l = &edits.lens;
    let c = &edits.calibration;
    let (has_crop, crop_top, crop_left, crop_right, crop_bottom, crop_angle, straighten) =
        crop_to_crs(edits);

    let xml = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description
      xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
      xmlns:ae="http://aramis-editor.app/ns/1.0/"
      ae:SavedEdits="True"
      crs:Exposure2012="{exp:.4}"
      crs:Contrast2012="{con:.0}"
      crs:Highlights2012="{hi:.0}"
      crs:Shadows2012="{sh:.0}"
      crs:Whites2012="{wh:.0}"
      crs:Blacks2012="{bl:.0}"
      crs:Temperature="{temp:.0}"
      crs:Tint="{tint:.0}"
      crs:Saturation="{sat:.0}"
      crs:Vibrance="{vib:.0}"
      crs:ParametricShadows="{ps:.0}"
      crs:ParametricDarks="{pd:.0}"
      crs:ParametricLights="{pl:.0}"
      crs:ParametricHighlights="{ph:.0}"
      crs:ParametricShadowSplit="{pss:.4}"
      crs:ParametricMidtoneSplit="{pms:.4}"
      crs:ParametricHighlightSplit="{phs:.4}"
      crs:HueAdjustmentRed="{hr:.0}"
      crs:SaturationAdjustmentRed="{sr:.0}"
      crs:LuminanceAdjustmentRed="{lr:.0}"
      crs:HueAdjustmentOrange="{ho:.0}"
      crs:SaturationAdjustmentOrange="{so:.0}"
      crs:LuminanceAdjustmentOrange="{lo:.0}"
      crs:HueAdjustmentYellow="{hy:.0}"
      crs:SaturationAdjustmentYellow="{sy:.0}"
      crs:LuminanceAdjustmentYellow="{ly:.0}"
      crs:HueAdjustmentGreen="{hg:.0}"
      crs:SaturationAdjustmentGreen="{sg:.0}"
      crs:LuminanceAdjustmentGreen="{lg:.0}"
      crs:HueAdjustmentAqua="{ha:.0}"
      crs:SaturationAdjustmentAqua="{sa:.0}"
      crs:LuminanceAdjustmentAqua="{la:.0}"
      crs:HueAdjustmentBlue="{hb:.0}"
      crs:SaturationAdjustmentBlue="{sb:.0}"
      crs:LuminanceAdjustmentBlue="{lb:.0}"
      crs:HueAdjustmentPurple="{hp:.0}"
      crs:SaturationAdjustmentPurple="{sp:.0}"
      crs:LuminanceAdjustmentPurple="{lp:.0}"
      crs:HueAdjustmentMagenta="{hm:.0}"
      crs:SaturationAdjustmentMagenta="{sm:.0}"
      crs:LuminanceAdjustmentMagenta="{lm:.0}"
      crs:Sharpness="{sharp:.0}"
      crs:SharpenRadius="{srad:.2}"
      crs:SharpenDetail="{sdet:.0}"
      crs:SharpenEdgeMasking="{smask:.0}"
      crs:LuminanceSmoothing="{luma:.0}"
      crs:LuminanceNoiseReductionDetail="{lnd:.0}"
      crs:LuminanceNoiseReductionContrast="{lnc:.0}"
      crs:ColorNoiseReduction="{cnoise:.0}"
      crs:HasCrop="{has_crop}"
      crs:CropTop="{ct:.6}"
      crs:CropLeft="{cl:.6}"
      crs:CropRight="{cr:.6}"
      crs:CropBottom="{cb:.6}"
      crs:CropAngle="{cang:.4}"
      crs:PerspectiveRotate="{str:.4}"
      crs:Rotate="{rot:.0}"
      crs:PerspectiveVertical="{pver:.0}"
      crs:PerspectiveHorizontal="{phor:.0}"
      crs:LensProfileEnable="{lpe}"
      crs:LensProfileName="{lpn}"
      crs:LensManualDistortionAmount="{ldist:.0}"
      crs:VignetteAmount="{lvig:.0}"
      crs:ChromaticAberrationB="{lca:.0}"
      crs:Defringe="{ldef:.0}"
      crs:PostCropVignetteAmount="{vig:.0}"
      crs:PostCropVignetteMidpoint="{vmp:.0}"
      crs:PostCropVignetteRoundness="{vr:.0}"
      crs:PostCropVignetteFeather="{vf:.0}"
      crs:GrainAmount="{grain:.0}"
      crs:GrainSize="{gs:.0}"
      crs:GrainFrequency="{gr:.0}"
      crs:ShadowTint="{cst:.0}"
      crs:RedHue="{crh:.0}"
      crs:RedSaturation="{crs:.0}"
      crs:GreenHue="{cgh:.0}"
      crs:GreenSaturation="{cgs:.0}"
      crs:BlueHue="{cbh:.0}"
      crs:BlueSaturation="{cbs:.0}"
      ae:EditStackJson="{escaped}"/>
  </rdf:RDF>
</x:xmpmeta>"#,
        exp = b.exposure,
        con = b.contrast,
        hi = b.highlights,
        sh = b.shadows,
        wh = b.whites,
        bl = b.blacks,
        temp = b.temp,
        tint = b.tint,
        sat = b.saturation,
        vib = b.vibrance,
        ps = tc.shadows,
        pd = tc.darks,
        pl = tc.lights,
        ph = tc.highlights,
        pss = tc.shadow_split,
        pms = tc.midtone_split,
        phs = tc.highlight_split,
        hr = hsl_attr(edits, "Hue", 0),
        sr = hsl_attr(edits, "Saturation", 0),
        lr = hsl_attr(edits, "Luminance", 0),
        ho = hsl_attr(edits, "Hue", 1),
        so = hsl_attr(edits, "Saturation", 1),
        lo = hsl_attr(edits, "Luminance", 1),
        hy = hsl_attr(edits, "Hue", 2),
        sy = hsl_attr(edits, "Saturation", 2),
        ly = hsl_attr(edits, "Luminance", 2),
        hg = hsl_attr(edits, "Hue", 3),
        sg = hsl_attr(edits, "Saturation", 3),
        lg = hsl_attr(edits, "Luminance", 3),
        ha = hsl_attr(edits, "Hue", 4),
        sa = hsl_attr(edits, "Saturation", 4),
        la = hsl_attr(edits, "Luminance", 4),
        hb = hsl_attr(edits, "Hue", 5),
        sb = hsl_attr(edits, "Saturation", 5),
        lb = hsl_attr(edits, "Luminance", 5),
        hp = hsl_attr(edits, "Hue", 6),
        sp = hsl_attr(edits, "Saturation", 6),
        lp = hsl_attr(edits, "Luminance", 6),
        hm = hsl_attr(edits, "Hue", 7),
        sm = hsl_attr(edits, "Saturation", 7),
        lm = hsl_attr(edits, "Luminance", 7),
        sharp = d.sharpening_amount,
        srad = d.sharpening_radius,
        sdet = d.sharpening_detail,
        smask = d.sharpening_masking,
        luma = d.noise_reduction_luminance,
        lnd = d.noise_reduction_detail,
        lnc = d.noise_reduction_contrast,
        cnoise = d.noise_reduction_color,
        has_crop = if has_crop { "True" } else { "False" },
        ct = crop_top,
        cl = crop_left,
        cr = crop_right,
        cb = crop_bottom,
        cang = crop_angle,
        str = straighten,
        rot = t.rotate,
        pver = t.vertical,
        phor = t.horizontal,
        lpe = if l.enable_profile { "True" } else { "False" },
        lpn = escape_xml_attr(&l.profile_name),
        ldist = l.distortion,
        lvig = l.vignette,
        lca = l.chromatic_aberration,
        ldef = l.defringe,
        vig = e.post_crop_vignette_amount,
        vmp = e.post_crop_vignette_midpoint,
        vr = e.post_crop_vignette_roundness,
        vf = e.post_crop_vignette_feather,
        grain = e.grain_amount,
        gs = e.grain_size,
        gr = e.grain_roughness,
        cst = c.shadow_tint,
        crh = c.red_primary_hue,
        crs = c.red_primary_sat,
        cgh = c.green_primary_hue,
        cgs = c.green_primary_sat,
        cbh = c.blue_primary_hue,
        cbs = c.blue_primary_sat,
    );
    fs::write(sidecar_path(path), xml)
}

pub fn read_xmp(path: &Path) -> Option<EditStack> {
    let sidecar = sidecar_path(path);
    let content = fs::read_to_string(&sidecar).ok()?;
    if let Some(stack) = read_aramis_json(&content) {
        return Some(stack);
    }
    Some(parse_crs_sidecar(&content))
}

fn read_aramis_json(content: &str) -> Option<EditStack> {
    let attr = if content.contains(ARAMIS_JSON_ATTR) {
        ARAMIS_JSON_ATTR
    } else {
        LEGACY_JSON_ATTR
    };
    let start = content.find(attr)?;
    let json_start = start + attr.len();
    let json_end = content[json_start..].find('"')? + json_start;
    let json = unescape_xml_attr(&content[json_start..json_end]);
    serde_json::from_str::<EditStack>(&json).ok()
}

fn parse_crs_sidecar(content: &str) -> EditStack {
    let mut edits = EditStack::default();

    edits.basic.exposure = parse_attr(content, "crs:Exposure2012").unwrap_or(0.0);
    edits.basic.contrast = parse_attr(content, "crs:Contrast2012").unwrap_or(0.0);
    edits.basic.highlights = parse_attr(content, "crs:Highlights2012").unwrap_or(0.0);
    edits.basic.shadows = parse_attr(content, "crs:Shadows2012").unwrap_or(0.0);
    edits.basic.whites = parse_attr(content, "crs:Whites2012").unwrap_or(0.0);
    edits.basic.blacks = parse_attr(content, "crs:Blacks2012").unwrap_or(0.0);
    edits.basic.temp = parse_attr(content, "crs:Temperature").unwrap_or(6500.0);
    edits.basic.tint = parse_attr(content, "crs:Tint").unwrap_or(0.0);
    edits.basic.saturation = parse_attr(content, "crs:Saturation").unwrap_or(0.0);
    edits.basic.vibrance = parse_attr(content, "crs:Vibrance").unwrap_or(0.0);

    edits.tone_curve.parametric.shadows =
        parse_attr(content, "crs:ParametricShadows").unwrap_or(0.0);
    edits.tone_curve.parametric.darks = parse_attr(content, "crs:ParametricDarks").unwrap_or(0.0);
    edits.tone_curve.parametric.lights = parse_attr(content, "crs:ParametricLights").unwrap_or(0.0);
    edits.tone_curve.parametric.highlights =
        parse_attr(content, "crs:ParametricHighlights").unwrap_or(0.0);
    edits.tone_curve.parametric.shadow_split =
        parse_attr(content, "crs:ParametricShadowSplit").unwrap_or(0.25);
    edits.tone_curve.parametric.midtone_split =
        parse_attr(content, "crs:ParametricMidtoneSplit").unwrap_or(0.5);
    edits.tone_curve.parametric.highlight_split =
        parse_attr(content, "crs:ParametricHighlightSplit").unwrap_or(0.75);

    parse_hsl_band(content, "Red", 0, &mut edits);
    parse_hsl_band(content, "Orange", 1, &mut edits);
    parse_hsl_band(content, "Yellow", 2, &mut edits);
    parse_hsl_band(content, "Green", 3, &mut edits);
    parse_hsl_band(content, "Aqua", 4, &mut edits);
    parse_hsl_band(content, "Blue", 5, &mut edits);
    parse_hsl_band(content, "Purple", 6, &mut edits);
    parse_hsl_band(content, "Magenta", 7, &mut edits);

    edits.detail.sharpening_amount = parse_attr(content, "crs:Sharpness").unwrap_or(0.0);
    edits.detail.sharpening_radius = parse_attr(content, "crs:SharpenRadius").unwrap_or(1.0);
    edits.detail.sharpening_detail = parse_attr(content, "crs:SharpenDetail").unwrap_or(25.0);
    edits.detail.sharpening_masking =
        parse_attr(content, "crs:SharpenEdgeMasking").unwrap_or(0.0);
    edits.detail.noise_reduction_luminance =
        parse_attr(content, "crs:LuminanceSmoothing").unwrap_or(0.0);
    edits.detail.noise_reduction_detail = parse_attr(
        content,
        "crs:LuminanceNoiseReductionDetail",
    )
    .unwrap_or(50.0);
    edits.detail.noise_reduction_contrast = parse_attr(
        content,
        "crs:LuminanceNoiseReductionContrast",
    )
    .unwrap_or(0.0);
    edits.detail.noise_reduction_color =
        parse_attr(content, "crs:ColorNoiseReduction").unwrap_or(0.0);

    if parse_bool_attr(content, "crs:HasCrop").unwrap_or(false) {
        let top = parse_attr(content, "crs:CropTop").unwrap_or(0.0);
        let left = parse_attr(content, "crs:CropLeft").unwrap_or(0.0);
        let right = parse_attr(content, "crs:CropRight").unwrap_or(0.0);
        let bottom = parse_attr(content, "crs:CropBottom").unwrap_or(0.0);
        edits.crop.enabled = true;
        edits.crop.x = left.clamp(0.0, 1.0);
        edits.crop.y = top.clamp(0.0, 1.0);
        edits.crop.width = (1.0 - left - right).clamp(0.01, 1.0);
        edits.crop.height = (1.0 - top - bottom).clamp(0.01, 1.0);
        edits.crop.angle = parse_attr(content, "crs:CropAngle").unwrap_or(0.0);
        edits.crop.straighten = parse_attr(content, "crs:PerspectiveRotate").unwrap_or(0.0);
    }

    edits.transform.rotate = parse_attr(content, "crs:Rotate").unwrap_or(0.0);
    edits.transform.vertical =
        parse_attr(content, "crs:PerspectiveVertical").unwrap_or(0.0);
    edits.transform.horizontal =
        parse_attr(content, "crs:PerspectiveHorizontal").unwrap_or(0.0);

    edits.lens.enable_profile =
        parse_bool_attr(content, "crs:LensProfileEnable").unwrap_or(false);
    if let Some(name) = parse_string_attr(content, "crs:LensProfileName") {
        edits.lens.profile_name = name;
    }
    edits.lens.distortion = parse_attr(content, "crs:LensManualDistortionAmount").unwrap_or(0.0);
    edits.lens.vignette = parse_attr(content, "crs:VignetteAmount").unwrap_or(0.0);
    edits.lens.chromatic_aberration =
        parse_attr(content, "crs:ChromaticAberrationB").unwrap_or(0.0);
    edits.lens.defringe = parse_attr(content, "crs:Defringe").unwrap_or(0.0);

    edits.effects.post_crop_vignette_amount =
        parse_attr(content, "crs:PostCropVignetteAmount").unwrap_or(0.0);
    edits.effects.post_crop_vignette_midpoint =
        parse_attr(content, "crs:PostCropVignetteMidpoint").unwrap_or(50.0);
    edits.effects.post_crop_vignette_roundness =
        parse_attr(content, "crs:PostCropVignetteRoundness").unwrap_or(0.0);
    edits.effects.post_crop_vignette_feather =
        parse_attr(content, "crs:PostCropVignetteFeather").unwrap_or(50.0);
    edits.effects.grain_amount = parse_attr(content, "crs:GrainAmount").unwrap_or(0.0);
    edits.effects.grain_size = parse_attr(content, "crs:GrainSize").unwrap_or(25.0);
    edits.effects.grain_roughness = parse_attr(content, "crs:GrainFrequency").unwrap_or(50.0);

    edits.calibration.shadow_tint = parse_attr(content, "crs:ShadowTint").unwrap_or(0.0);
    edits.calibration.red_primary_hue =
        parse_attr(content, "crs:RedHue").unwrap_or(0.0);
    edits.calibration.red_primary_sat =
        parse_attr(content, "crs:RedSaturation").unwrap_or(0.0);
    edits.calibration.green_primary_hue =
        parse_attr(content, "crs:GreenHue").unwrap_or(0.0);
    edits.calibration.green_primary_sat =
        parse_attr(content, "crs:GreenSaturation").unwrap_or(0.0);
    edits.calibration.blue_primary_hue =
        parse_attr(content, "crs:BlueHue").unwrap_or(0.0);
    edits.calibration.blue_primary_sat =
        parse_attr(content, "crs:BlueSaturation").unwrap_or(0.0);

    edits
}

fn parse_hsl_band(content: &str, color: &str, index: usize, edits: &mut EditStack) {
    if let Some(v) = parse_attr(content, &format!("crs:HueAdjustment{color}")) {
        edits.hsl.hue[index] = v;
    }
    if let Some(v) = parse_attr(content, &format!("crs:SaturationAdjustment{color}")) {
        edits.hsl.saturation[index] = v;
    }
    if let Some(v) = parse_attr(content, &format!("crs:LuminanceAdjustment{color}")) {
        edits.hsl.luminance[index] = v;
    }
}

fn parse_attr(content: &str, key: &str) -> Option<f32> {
    let needle = format!("{key}=\"");
    let start = content.find(&needle)? + needle.len();
    let end = content[start..].find('"')? + start;
    content[start..end].parse().ok()
}

fn parse_string_attr(content: &str, key: &str) -> Option<String> {
    let needle = format!("{key}=\"");
    let start = content.find(&needle)? + needle.len();
    let end = content[start..].find('"')? + start;
    let value = content[start..end].trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn parse_bool_attr(content: &str, key: &str) -> Option<bool> {
    let needle = format!("{key}=\"");
    let start = content.find(&needle)? + needle.len();
    let end = content[start..].find('"')? + start;
    match content[start..end].to_ascii_lowercase().as_str() {
        "true" | "1" | "yes" => Some(true),
        "false" | "0" | "no" => Some(false),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_crs_crop_and_sharpening() {
        let xml = r#"
        <rdf:Description
          crs:HasCrop="True"
          crs:CropTop="0.1"
          crs:CropLeft="0.05"
          crs:CropRight="0.05"
          crs:CropBottom="0.1"
          crs:CropAngle="-2.5"
          crs:Sharpness="40"
          crs:SharpenRadius="1.2"
          crs:Temperature="5200"
          crs:Tint="-8"
        />
        "#;
        let edits = parse_crs_sidecar(xml);
        assert!(edits.crop.enabled);
        assert!((edits.crop.x - 0.05).abs() < 0.001);
        assert!((edits.crop.width - 0.9).abs() < 0.001);
        assert!((edits.detail.sharpening_amount - 40.0).abs() < 0.001);
        assert!((edits.basic.temp - 5200.0).abs() < 0.001);
    }

    #[test]
    fn aramis_sidecar_round_trips_full_edit_stack() {
        let dir = std::env::temp_dir().join(format!("aramis-xmp-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let raw_path = dir.join("sample.nef");
        std::fs::File::create(&raw_path).unwrap();

        let mut edits = EditStack::default();
        edits.basic.exposure = 0.75;
        edits.detail.sharpening_amount = 42.0;
        edits.crop.enabled = true;
        edits.crop.x = 0.1;
        edits.crop.y = 0.05;
        edits.crop.width = 0.8;
        edits.crop.height = 0.9;

        write_xmp(&raw_path, &edits).unwrap();
        assert!(has_aramis_saved_edits(&raw_path));

        let loaded = read_xmp(&raw_path).expect("sidecar should load");
        assert_eq!(loaded, edits);

        std::fs::remove_dir_all(dir).ok();
    }
}
