#!/usr/bin/env python3
"""Render every .html in a directory to a same-named .png, cropped to its <svg>.

    python3 render_diagrams.py path/to/diagrams/

Requires Playwright with Chromium installed (`playwright install chromium`).
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright


def main(directory: str) -> None:
    d = pathlib.Path(directory)
    pages = sorted(d.glob("*.html"))
    if not pages:
        sys.exit(f"no .html files in {d}")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for html in pages:
            page = browser.new_page(
                viewport={"width": 1400, "height": 1200}, device_scale_factor=2
            )
            page.goto(html.resolve().as_uri())
            page.wait_for_timeout(2500)  # let the webfonts land before measuring
            png = html.with_suffix(".png")
            page.locator("svg").screenshot(path=str(png), omit_background=True)
            print("rendered", png.name)
            page.close()
        browser.close()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
