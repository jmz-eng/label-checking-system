"""验证浏览器单标签25×10mm文件，使用独立CODE128解码器检查12位载荷。

Python依赖：Pillow、pypdfium2。跨平台解码可安装zxing-cpp（import zxingcpp）；
macOS也可使用系统Swift与Vision作为独立解码器，无需安装zxing-cpp。
运行：python scripts/verify_label_print.py
自定义：--root 样例目录 --png 标签.png --pdf 标签.pdf --expected 000000000101
"""

import argparse
from pathlib import Path
import re
import subprocess
import sys

from PIL import Image
import pypdfium2 as pdfium


def decode(image_path: Path, expected: str) -> None:
    try:
        import zxingcpp
    except ImportError:
        if sys.platform != "darwin":
            raise RuntimeError("需要安装独立CODE128解码器：python -m pip install zxing-cpp") from None
        subprocess.run(
            ["swift", str(Path(__file__).with_name("check_code128.swift")), str(image_path), expected],
            check=True,
        )
    else:
        with Image.open(image_path) as image:
            results = zxingcpp.read_barcodes(image, formats=zxingcpp.BarcodeFormat.Code128)
        decoded = [result.text for result in results]
        assert decoded == [expected], f"{image_path.name} 未解出唯一完整条形码：{decoded}"
    print(f"{image_path.name}：CODE128完整条形码 {expected} 解码通过")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1] / "frontend/test-results")
    parser.add_argument("--png", default="label-300dpi.png")
    parser.add_argument("--pdf", default="label-25x10mm.pdf")
    parser.add_argument("--expected", default="000000000002")
    args = parser.parse_args()
    assert re.fullmatch(r"[0-9]{12}", args.expected), "期望载荷必须为12位数字"
    root = args.root.resolve()
    with pdfium.PdfDocument(root / args.pdf) as document:
        assert len(document) == 1, "打印输出必须只有一页"
        page = document[0]
        width, height = page.get_size()
        width_mm, height_mm = width * 25.4 / 72, height * 25.4 / 72
        # 浏览器PDF对纸张尺寸有点数舍入，允许小于0.2mm的差异。
        assert abs(width_mm - 25) < 0.2 and abs(height_mm - 10) < 0.2, "纸张尺寸不匹配"
        rendered = root / f"{Path(args.pdf).stem}-300dpi.png"
        page.render(scale=300 / 72).to_pil().save(rendered)
    with Image.open(root / args.png) as image:
        # 浏览器截图将CSS边界向外取整；使用与PDF相同的小于0.2mm容差。
        assert abs(image.width - 25 * 300 / 25.4) < 0.2 * 300 / 25.4 and abs(image.height - 10 * 300 / 25.4) < 0.2 * 300 / 25.4, "PNG不是25×10mm、300dpi完整标签"
    decode(root / args.png, args.expected)
    decode(rendered, args.expected)
    print(f"单页尺寸：{width_mm:.3f} × {height_mm:.3f} mm")


if __name__ == "__main__":
    main()
