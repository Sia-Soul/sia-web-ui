# S1-E 品牌定稿

用户选择 S1-E 连笔 Sia，并确认采用粉紫、蓝、青的炫彩渐变填充与白色描边：保留大写 S 的上下回环、连接的 i/a、圆点与下方收笔线。选稿对照保存在 `sia-signature-selection.png`。图稿由内置 image_gen 生成，未使用 CLI 或外部 API。

- `sia-signature-s1e-blue-bird.png`：正式图稿，A 版蓝青飞鸟搭配珍珠白 Sia、深蓝细描边，背景及内部留白透明。
- `sia-signature-s1e-coral-globe.png`：此前地球图稿，仅归档；炫彩 Sia 签名叠加珊瑚橙地球；大陆与细边框相连，无经纬线、无地球白描边，海洋和背景透明。
- `sia-signature-s1e-iridescent.png`：此前不带地球的炫彩签名原稿，仅归档。
- `sia-signature-s1e-purple-outline.png`：上一版浅紫色、白描边原稿，仅归档。
- `sia-signature-s1e-transparent.png`：早期深蓝原稿，仅归档。
- `sia-signature-s1e-app.png`：早期浅底候选图，仅归档，不参与资源导出或打包。
- `build-signature-assets.cjs`：仅按用途缩放图稿，不改写字形。随后使用 Tauri CLI 生成 ICO、ICNS 和各平台 PNG。
- 所有正式输出均保留透明背景；方形资源仅增加透明留白，不添加底板。
- 网页与原生图标共用图稿原色，均不使用主题滤镜；亮色渐变和白色描边提高深色背景下的可见性。
- 使用无头渲染检查网页主要笔画对比，并直接读取原生图标检查 16/24/32/48px 的透明背景和亮色覆盖率。
- Windows 安装包以 `app-s1e-blue-bird.ico` 作为快捷方式图标，并迁移已有品牌任务栏链接的旧安装/开发路径；不新增、取消固定或重新排序。

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

## 石墨灰地球候选（归档）

用户确认 H 石墨灰版。内置 image_gen 输出 `exec-7730531f-a85e-44a6-b95e-27102f7edb4c.png` 已原样保存为 `sia-signature-s1e-graphite-globe.png`。保持炫彩签名及字标本身的白描边，只将背景地球大陆和相连的细外圈设为石墨灰，目标色 `#68717E`。生成采用 `transparent_background=true`；正式导出只缩放和转换格式。

```text
Precise color-only edit of this supplied transparent Sia globe logo. Change ONLY the background globe's white continent fills and thin circular rim to a uniform flat #68717E (H · 石墨灰) color. All land and circle border must share that color. Retain connected continent-to-rim silhouettes, thin border, globe diameter and placement. No extra white outline on globe. Keep FOREGROUND Sia lettering unchanged: pink-purple-blue-cyan multicolor gradient, existing thin white outline on letters, dot, calligraphic shapes and underline flourish. Preserve genuine transparent background and transparent ocean spaces. No latitude longitude lines, no 3D, shading, glow or shadows. Single clean logo only, no captions. Color variant H · 石墨灰.
```

## 珊瑚橙地球定稿（归档）

正式使用 D 珊瑚橙版本，替代石墨灰候选。原件 `exec-dcd10dcc-f23d-4851-88c3-4e5bae05b245.png` 原样复制为 `sia-signature-s1e-coral-globe.png`；石墨灰原稿仅归档。大陆与细外圈使用同一珊瑚橙色（目标色 `#F5A080`），保持相连、无经纬线和额外白描边；炫彩签名及自身白描边、海洋和背景透明保持不变。使用内置 image_gen 和 `transparent_background=true` 生成，导出仅缩放与转换格式。

```text
Precise color-only edit of the supplied transparent Sia logo. Change ONLY the background globe's white land continent silhouettes and thin circular rim to a uniform flat #F5A080 (珊瑚橙) color. All globe land and rim use this same color, retain seamless connected land-to-rim shapes. Keep the circle size, shape, position and thin rim thickness identical. No additional white outline on the globe. Preserve FOREGROUND Sia signature exactly, including pink-purple-blue-cyan multicolor gradient, original white outline on the lettering, dot and underline flourish. Ocean holes and background stay truly transparent. No latitude or longitude lines, no 3D, no shadows, no glow. Clean flat graphic. Single logo only, no labels. This is color variant 珊瑚橙.
```

## 蓝青飞鸟 A 版（2026-10-26）

当前接入 A 版：蓝青飞鸟与珍珠白 Sia，字标使用深蓝细描边。内置 image_gen 输出 `exec-c750dd40-3a26-4a46-aa2c-07950385b84e.png` 原样保存为 `sia-signature-s1e-blue-bird.png`。生成采用 `transparent_background=true`，正式导出仅缩放与转换格式，全部图标保留透明背景。方形资源每边预留约 6% 透明安全边距，避免贴边羽翼在任务栏重采样时触及画布边角。

```text
Color-only redesign of this exact Sia flying-bird logo. Keep all geometry and composition: sweeping near-circular flying phoenix bird, head looking right, broad wings and long tail feathers, foreground calligraphic Sia with dot and underline. Change BOTH bird colors and signature colors to one coordinated palette. Bird broad flowing feathers in ocean blue #1266D5 through turquoise #23CECA, pale cyan accent shapes. Sia lettering solid pearl white #F7FBFF with a fine deep navy #12446A outline, excellent readability against blue and cyan. The old rainbow signature must be fully replaced with the requested lettering color, including dot and underline; no leftover neon rainbow. Foreground signature must stay clearly legible on bird. Preserve original stroke widths and shapes, including fine signature outline. Flat clean 2D graphic with smooth restrained color transitions on bird and crisp broad color-block overlap accents, no 3D, no bevel, no shadows, no glow. Transparent background and internal negative spaces. Single large logo only, no labels or comparison board. Variant A · 蓝青 / 珍珠白.
```
