//! 下载列表使用 Windows 文件关联图标；读取和编码在后台执行，不阻塞 WebView UI 线程。

/// 返回本地文件或文件类型的透明 PNG 数据地址；不支持的平台或读取失败返回空值。
#[tauri::command]
pub async fn get_download_file_icon(file_name: String, file_path: Option<String>) -> Option<String> {
    #[cfg(windows)]
    {
        // 长下载历史最多同时读取四个图标，不为每一行占用一个阻塞线程。
        static READERS: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(4);
        let permit = READERS.acquire().await.ok()?;
        tauri::async_runtime::spawn_blocking(move || {
            let _permit = permit;
            read_icon(&file_name, file_path.as_deref())
        })
            .await.ok().flatten()
    }
    #[cfg(not(windows))]
    { let _ = (file_name, file_path); None }
}

#[cfg(windows)]
fn read_icon(file_name: &str, file_path: Option<&str>) -> Option<String> {
    use base64::Engine;
    use windows::{core::HSTRING, Win32::{
        Graphics::Gdi::*, Storage::FileSystem::FILE_ATTRIBUTE_NORMAL,
        System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED},
        UI::{Shell::*, WindowsAndMessaging::*},
    }};
    // 未完成或已删除文件按扩展名查询；真实本地文件可提供 EXE 等自定义图标，不加载网络路径。
    let local_file = file_path.filter(|path| {
        let bytes = path.as_bytes();
        bytes.len() > 3 && bytes[1] == b':' && matches!(bytes[2], b'\\' | b'/')
            && std::path::Path::new(path).is_file()
    });
    let extension = std::path::Path::new(file_name).extension().and_then(|value| value.to_str()).unwrap_or("");
    let fallback = format!("download.{extension}");
    let path = HSTRING::from(local_file.unwrap_or(&fallback));
    unsafe {
        let initialized = CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok();
        let mut info = SHFILEINFOW::default();
        let flags = SHGFI_ICON | SHGFI_LARGEICON
            | if local_file.is_some() { SHGFI_FLAGS(0) } else { SHGFI_USEFILEATTRIBUTES };
        let result = if SHGetFileInfoW(&path, FILE_ATTRIBUTE_NORMAL, Some(&mut info),
            std::mem::size_of::<SHFILEINFOW>() as u32, flags) == 0 {
            None
        } else {
            let result = (|| {
                let dc = CreateCompatibleDC(None);
                if dc.is_invalid() { return None; }
                let mut bits = std::ptr::null_mut();
                let bitmap_info = BITMAPINFO {
                    bmiHeader: BITMAPINFOHEADER { biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                        biWidth: 32, biHeight: -32, biPlanes: 1, biBitCount: 32,
                        biCompression: BI_RGB.0, ..Default::default() },
                    ..Default::default()
                };
                let bitmap = match CreateDIBSection(Some(dc), &bitmap_info, DIB_RGB_COLORS, &mut bits, None, 0) {
                    Ok(bitmap) => bitmap,
                    Err(_) => { let _ = DeleteDC(dc); return None; }
                };
                let previous = SelectObject(dc, bitmap.into());
                let pixels = std::slice::from_raw_parts_mut(bits.cast::<u8>(), 32 * 32 * 4);
                // 分别在黑白底绘制并反算透明度，兼容传统掩码图标及带 Alpha 的应用图标。
                let rgba = (|| {
                    pixels.fill(0);
                    DrawIconEx(dc, 0, 0, info.hIcon, 32, 32, 0, None, DI_NORMAL).ok()?;
                    let _ = GdiFlush();
                    let black = pixels.to_vec();
                    pixels.fill(255);
                    DrawIconEx(dc, 0, 0, info.hIcon, 32, 32, 0, None, DI_NORMAL).ok()?;
                    let _ = GdiFlush();
                    let mut rgba = Vec::with_capacity(pixels.len());
                    for (black, white) in black.chunks_exact(4).zip(pixels.chunks_exact(4)) {
                        let alpha = 255 - white[0].saturating_sub(black[0]);
                        for channel in [2, 1, 0] {
                            rgba.push(if alpha == 0 { 0 } else { ((u32::from(black[channel]) * 255 / u32::from(alpha)).min(255)) as u8 });
                        }
                        rgba.push(alpha);
                    }
                    Some(rgba)
                })();
                // 无论绘制是否成功，都归还 GDI 对象和设备上下文。
                SelectObject(dc, previous);
                let _ = DeleteObject(bitmap.into());
                let _ = DeleteDC(dc);
                let rgba = rgba?;
                let mut png = Vec::new();
                {
                    let mut encoder = png::Encoder::new(&mut png, 32, 32);
                    encoder.set_color(png::ColorType::Rgba);
                    encoder.set_depth(png::BitDepth::Eight);
                    encoder.write_header().ok()?.write_image_data(&rgba).ok()?;
                }
                Some(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(png)))
            })();
            let _ = DestroyIcon(info.hIcon);
            result
        };
        if initialized { CoUninitialize(); }
        result
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use base64::Engine;

    #[test]
    fn associated_and_executable_icons_are_decodable_png() {
        // 只读取测试进程本身和扩展名关联，不执行文件或访问用户下载资料。
        for (name, path) in [("test.xlsx", None), ("test.unknown-sia", None),
            ("test.exe", Some(std::env::current_exe().unwrap()))] {
            let icon = read_icon(name, path.as_ref().and_then(|path| path.to_str())).unwrap();
            let bytes = base64::engine::general_purpose::STANDARD.decode(icon.strip_prefix("data:image/png;base64,").unwrap()).unwrap();
            let mut reader = png::Decoder::new(std::io::Cursor::new(bytes)).read_info().unwrap();
            assert_eq!((reader.info().width, reader.info().height), (32, 32));
            let mut pixels = vec![0; reader.output_buffer_size().unwrap()];
            reader.next_frame(&mut pixels).unwrap();
            assert!(pixels.chunks_exact(4).any(|pixel| pixel[3] > 0), "文件图标不能完全透明");
            assert!(pixels.chunks_exact(4).any(|pixel| pixel[3] == 0), "保留图标外围的透明像素");
        }
    }
}
