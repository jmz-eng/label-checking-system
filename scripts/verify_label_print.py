"""验证浏览器单标签打印文件，使用独立解码器检查完整载荷。"""

from pathlib import Path

import cv2
import numpy as np
import pypdfium2 as pdfium


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "frontend/test-results"
    document = pdfium.PdfDocument(root / "label-25x10mm.pdf")
    assert len(document) == 1, "打印输出必须只有一页"
    page = document[0]
    width, height = page.get_size()
    width_mm, height_mm = width * 25.4 / 72, height * 25.4 / 72
    # 浏览器 PDF 对纸张尺寸有点数舍入，允许小于 0.2 mm 的差异。
    assert abs(width_mm - 25) < 0.2 and abs(height_mm - 10) < 0.2, "纸张尺寸不匹配"
    page.render(scale=300 / 72).to_pil().save(root / "label-pdf-300dpi.png")
    expected = "TM-SN26007PK02-31212PK-D196H-0003"
    for name in ("label-300dpi.png", "label-pdf-300dpi.png"):
        pixels = cv2.imdecode(np.fromfile(root / name, dtype=np.uint8), cv2.IMREAD_COLOR)
        payload, _, _ = cv2.QRCodeDetector().detectAndDecode(pixels)
        assert payload == expected, f"{name} 未解出完整标签码"
        print(f"{name}：完整标签码解码通过")
    print(f"单页尺寸：{width_mm:.3f} × {height_mm:.3f} mm")


if __name__ == "__main__":
    main()
