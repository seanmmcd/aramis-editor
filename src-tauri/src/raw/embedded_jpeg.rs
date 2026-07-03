use std::fs;
use std::io::Cursor;
use std::path::Path;

use super::jpeg_backend;
use super::{DecodeError, DecodedImage};

/// Extract the largest embedded JPEG from a RAW container (NEF, CR2, etc.).
pub fn extract_largest_jpeg(data: &[u8]) -> Option<Vec<u8>> {
    let mut best: Option<(usize, usize)> = None;
    let mut i = 0;
    while i + 1 < data.len() {
        if data[i] == 0xFF && data[i + 1] == 0xD8 {
            if let Some(end) = find_jpeg_end(data, i) {
                let len = end - i;
                if best.map_or(true, |(_, bl)| len > bl) {
                    best = Some((i, len));
                }
                i = end;
                continue;
            }
        }
        i += 1;
    }
    best.map(|(start, len)| data[start..start + len].to_vec())
}

fn find_jpeg_end(data: &[u8], start: usize) -> Option<usize> {
    let mut i = start + 2;
    while i + 1 < data.len() {
        if data[i] != 0xFF {
            i += 1;
            continue;
        }
        let marker = data[i + 1];
        if marker == 0xD9 {
            return Some(i + 2);
        }
        if marker == 0x00 {
            i += 2;
            continue;
        }
        if marker == 0xD8 || (0xD0..=0xD7).contains(&marker) {
            i += 2;
            continue;
        }
        if i + 3 >= data.len() {
            return None;
        }
        let seg_len = ((data[i + 2] as usize) << 8) | data[i + 3] as usize;
        if seg_len < 2 {
            return None;
        }
        i += 2 + seg_len;
    }
    None
}

pub fn read_dimensions(path: &Path) -> Result<(u32, u32), DecodeError> {
    let data = fs::read(path).map_err(|e| DecodeError::Msg(e.to_string()))?;
    let jpeg = extract_largest_jpeg(&data)
        .ok_or_else(|| DecodeError::Msg("no embedded jpeg".into()))?;
    image::ImageReader::new(Cursor::new(&jpeg))
        .with_guessed_format()
        .map_err(|e| DecodeError::Msg(e.to_string()))?
        .into_dimensions()
        .map_err(|e| DecodeError::Msg(e.to_string()))
}

pub fn decode(path: &Path) -> Result<DecodedImage, DecodeError> {
    let data = fs::read(path).map_err(|e| DecodeError::Msg(e.to_string()))?;
    let jpeg = extract_largest_jpeg(&data)
        .ok_or_else(|| DecodeError::Msg("no embedded jpeg".into()))?;
    jpeg_backend::decode_from_memory(&jpeg)
}
