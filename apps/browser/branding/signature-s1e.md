# S1-E 品牌定稿

用户选择 S1-E 连笔 Sia，并确认采用粉紫、蓝、青的炫彩渐变填充与白色描边：保留大写 S 的上下回环、连接的 i/a、圆点与下方收笔线。选稿对照保存在 `sia-signature-selection.png`。图稿由内置 image_gen 生成，未使用 CLI 或外部 API。

- `sia-signature-s1e-iridescent.png`：所有正式图标共用的炫彩渐变、白描边透明原稿。
- `sia-signature-s1e-purple-outline.png`：上一版浅紫色、白描边原稿，仅归档。
- `sia-signature-s1e-transparent.png`：早期深蓝原稿，仅归档。
- `sia-signature-s1e-app.png`：早期浅底候选图，仅归档，不参与资源导出或打包。
- `build-signature-assets.cjs`：仅按用途缩放图稿，不改写字形。随后使用 Tauri CLI 生成 ICO、ICNS 和各平台 PNG。
- 所有正式输出均保留透明背景；方形资源仅增加透明留白，不添加底板。
- 网页与原生图标共用图稿原色，均不使用主题滤镜；亮色渐变和白色描边提高深色背景下的可见性。
- 使用无头渲染检查网页主要笔画对比，并直接读取原生图标检查 16/24/32/48px 的透明背景和亮色覆盖率。
- Windows 安装包以 `app-s1e-iridescent.ico` 作为快捷方式图标，并迁移已有品牌任务栏链接的旧安装/开发路径；不新增、取消固定或重新排序。

16px 图标用于识别整体签名，不能保证读清所有细笔画；完整名称在标题栏、新标签页和桌面快捷方式文本中展示。

## 炫彩白描边定稿提示词

使用内置 image_gen 编辑上一版紫色图稿，`transparent_background=true`。用户确认的输出原件 `exec-faf189e3-6ce4-4256-a035-07c8b0f347ae.png` 已复制为 `sia-signature-s1e-iridescent.png`。后续仅缩放和导出格式。

```text
Precise palette edit of the supplied approved S1-E Sia browser logo. Preserve the EXACT calligraphic Sia lettering, large looping S, joined lowercase ia, circular i dot, single sweeping underline, stroke thickness and narrow white outline. Change ONLY the interior coloring from solid purple to a beautiful luminous multicolor gradient: lavender violet at the top of S flows into vivid rose pink on the lower-left S loop, bright sky blue across the central joining strokes, and fresh turquoise cyan across the a and right-hand tail. The underline has a cohesive pink-violet-blue-cyan transition matching the letters. The dot is luminous periwinkle with a hint of pink. Artful harmonious iridescent COLOR, but completely FLAT two-dimensional vector artwork, no metallic surfaces, no lighting highlights, no bevels, no shadow, no glow, no texture, no 3D. Keep colors bright enough for a dark taskbar, avoid muddy colors, black patches and very dark blue. Clean fine WHITE contour around all letter shapes. Genuine TRANSPARENT alpha background and counters. Erase any stray speckles or marks from the reference's empty spaces. Show exactly ONE isolated large logo with small safe transparent margins, no grid, no labels, no extra text or frame. This is a color preview, not a redesign of the letter shapes.
```

## 早期紫色白描边提示词（归档）

参考同字形的青色描边候选，通过内置 image_gen 编辑，`transparent_background=true`。输出原件 `exec-ddd9a2d6-447d-4816-9d88-357dd4297ab2.png` 已复制到当前目录的 `sia-signature-s1e-purple-outline.png`。后续仅缩放和导出格式；小尺寸效果通过浏览器真实 alpha 合成预览检查。

```text
Use case: precise-object-edit. Edit this exact supplied Sia browser logo. ONLY change the palette: all cyan letter and underline interiors become a flat bright soft lavender purple #B58AEF. The i dot interior becomes a slightly lighter lavender #D2B6FA. Replace every dark navy outline with a crisp PURE WHITE #FFFFFF thin outline, including all outer contours, inner counters and the circular i dot. Keep the exact letter shapes, thickness, S loops, connections, proportions, underline, layout, size and framing of the supplied image. The white outline must be continuous, clean and clearly present, but no thicker than the existing navy outline. Flat solid colors throughout, no gradients, no texture, no glow, no shadow, no bevel, no 3D, no sticker backing plate, no colored background. Genuine transparent alpha outside the narrow white outline AND inside letter counters. Single isolated logo reading exactly Sia, no captions or extra elements. Intended for 16–48px Windows taskbar display, preserve the robust strokes from the reference.
```

## 早期深蓝透明字标提示词（归档）

参考：`sia-signature-selection.png` 的下排中间 S1-E。生成时 `transparent_background=true`。

```text
Precise extraction and production cleanup of the USER-SELECTED S1-E logo in the BOTTOM MIDDLE cell of the supplied comparison board. Return ONLY ONE large high-resolution isolated Sia wordmark on a genuinely TRANSPARENT alpha background. Target the LARGE S1-E mark, not the small repeated sample. Preserve its custom letter geometry faithfully: tall elegant calligraphic capital S with airy upper oval loop and broad open lower loop sweeping left; connected lowercase i and single-storey a to its right; turquoise/cyan round i dot; a graceful SINGLE sweeping underline under the full word, lower underline beginning naturally near the bottom S loop and arcing gently toward the right, with a tapered terminal. Preserve the selected composition and handwritten thick-to-thin rhythm, including the a terminal that curves slightly upward above the underline. Main lettering AND underline deep vivid royal blue #082EA4; i dot cyan #00B5DF. Keep three letters reading exactly Sia. Clean smooth vector-like edges, flat solid colors only, no grain, NO gradients, NO shadows, NO texture, NO 3D, NO reflections, NO outlines, no decoration beyond the original underline. Do not reinterpret as another font, do not simplify to a single S, do not add square tile or badge, do not add labels, numbers, captions, grid or repeated logo samples. Center this one logo generously enlarged with a small safe transparent margin around its outermost flourishes so none are clipped; preserve original approximately wide 1.7:1 wordmark proportions. Transparent outside and through all letter counters. This image is the final production asset for the approved design.
```

## 已停用的浅底候选提示词（仅归档）

参考：上述透明字标。生成时 `transparent_background=false`。

```text
Production packaging of the exact supplied approved Sia wordmark. Preserve this logo's calligraphic S/i/a letter shapes, blue ink, cyan i dot and underline precisely. Return a SINGLE SQUARE app-icon source image with a FULLY OPAQUE, PERFECTLY UNIFORM near-white #F8FAFF background covering the ENTIRE canvas edge-to-edge. No transparency anywhere, no rounded outer tile, no frame, no border, no shadow. Center the supplied exact blue-and-cyan wordmark optically on the square, keeping its original aspect ratio, occupying 90 percent of canvas width, with balanced top and bottom whitespace. Flat smooth solid blue lettering and cyan dot, immaculate clean edges, no texture, NO noise, no gradient, no 3D, no lighting, no antialias speckles. One Sia logo only, no additional text or graphics, no mockup. This is a simple high-quality square bitmap of the approved signature on a clean pale background.
```
