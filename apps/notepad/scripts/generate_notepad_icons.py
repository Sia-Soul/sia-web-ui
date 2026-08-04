from __future__ import annotations

import hashlib
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


EXTENSIONS = (
    "txt", "json", "md", "markdown", "cs", "js", "jsx", "mjs", "cjs",
    "ts", "tsx", "html", "htm", "css", "xml", "yaml", "yml", "ini",
    "sh", "bash", "zsh", "ps1", "bat", "cmd", "py", "sql", "php",
    "rb", "pl", "lua",
)

PALETTES = (
    ((24, 200, 255), (108, 92, 231), (247, 37, 133), (255, 159, 28)),
    ((0, 229, 255), (0, 119, 255), (136, 65, 255), (255, 72, 174)),
    ((53, 255, 180), (0, 183, 255), (111, 70, 255), (255, 67, 159)),
    ((255, 198, 31), (255, 111, 57), (238, 52, 150), (111, 66, 255)),
)

MASTER_SIZE = 1024
ICON_SIZES = ((16, 16), (20, 20), (24, 24), (32, 32), (40, 40), (48, 48), (64, 64), (128, 128), (256, 256))
FONT_CANDIDATES = (
    Path("C:/Windows/Fonts/segoeuib.ttf"),
    Path("C:/Windows/Fonts/arialbd.ttf"),
)


def font_path() -> Path:
    for candidate in FONT_CANDIDATES:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("找不到用于绘制图标的粗体字体")


def interpolate(left: tuple[int, int, int], right: tuple[int, int, int], ratio: float) -> tuple[int, int, int]:
    return tuple(round(left[index] + (right[index] - left[index]) * ratio) for index in range(3))


def gradient_color(palette: tuple[tuple[int, int, int], ...], position: float) -> tuple[int, int, int]:
    scaled = max(0.0, min(1.0, position)) * (len(palette) - 1)
    index = min(int(scaled), len(palette) - 2)
    return interpolate(palette[index], palette[index + 1], scaled - index)


def draw_icon(label: str, palette_index: int) -> Image.Image:
    size = MASTER_SIZE
    palette = PALETTES[palette_index % len(PALETTES)]
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gradient = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gradient_draw = ImageDraw.Draw(gradient)
    for x in range(size):
        position = x / (size - 1)
        gradient_draw.line((x, 0, x, size), fill=(*gradient_color(palette, position), 255))

    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)

    label = label.upper()
    max_text_width = 900
    text_size = 292 if len(label) <= 4 else 250
    path = font_path()
    while text_size > 84:
        font = ImageFont.truetype(str(path), text_size)
        bbox = draw.textbbox((0, 0), label, font=font, stroke_width=0)
        if bbox[2] - bbox[0] <= max_text_width:
            break
        text_size -= 6

    bbox = draw.textbbox((0, 0), label, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    text_x = (size - text_width) / 2 - bbox[0]
    text_y = 472 - text_height / 2 - bbox[1]
    draw.text((text_x, text_y), label, font=font, fill=255)

    underline_width = min(900, max(470, text_width + 36))
    underline_left = (size - underline_width) / 2
    underline_top = 680
    draw.rounded_rectangle(
        (underline_left, underline_top, underline_left + underline_width, underline_top + 48),
        radius=24,
        fill=255,
    )
    gradient.putalpha(mask)
    icon.alpha_composite(gradient)
    return icon


def main() -> None:
    script_path = Path(__file__).resolve()
    app_root = script_path.parent.parent
    tauri_root = app_root / "src-tauri"
    filetype_dir = tauri_root / "filetype-icons"
    filetype_dir.mkdir(parents=True, exist_ok=True)

    note_icon = draw_icon("NOTE", 0)
    with tempfile.TemporaryDirectory(prefix="sia-notepad-icons-") as temporary_directory:
        source_png = Path(temporary_directory) / "note-icon.png"
        note_icon.save(source_png, "PNG")
        subprocess.run(
            ["cargo", "tauri", "icon", str(source_png), "--output", str(tauri_root / "icons")],
            cwd=app_root,
            check=True,
        )

    for extension in EXTENSIONS:
        digest = hashlib.sha256(extension.encode("ascii")).digest()
        icon = draw_icon(extension, digest[0] % len(PALETTES))
        icon.save(filetype_dir / f"{extension}.ico", format="ICO", sizes=ICON_SIZES)

    print(f"Generated the app icon and {len(EXTENSIONS)} file association icons.")


if __name__ == "__main__":
    main()
