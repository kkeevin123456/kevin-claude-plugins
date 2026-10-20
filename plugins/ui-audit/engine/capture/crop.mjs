const WIDTH = 900

// Renders the whole screenshot with the annotated box outlined, above a magnified view of the area around it.
export async function makeCrop({ browser, png, rect, out }) {
    const w = png.readUInt32BE(16)
    const h = png.readUInt32BE(20)
    const pad = { x: rect.w * 0.5, y: rect.h * 0.5 }
    const zx = Math.max(0, rect.x - pad.x)
    const zy = Math.max(0, rect.y - pad.y)
    const zw = Math.min(1, rect.x + rect.w + pad.x) - zx
    const zh = Math.min(1, rect.y + rect.h + pad.y) - zy
    const zoomH = Math.round((WIDTH * (zh * h)) / (zw * w))
    const src = `data:image/png;base64,${png.toString('base64')}`
    const pct = (v) => `${v * 100}%`
    const html = `<body style="margin:0;background:#111;width:${WIDTH}px">
<div style="position:relative;width:${WIDTH}px"><img src="${src}" style="display:block;width:100%">
<div style="position:absolute;left:${pct(rect.x)};top:${pct(rect.y)};width:${pct(rect.w)};height:${pct(rect.h)};border:3px solid #ff2d2d;box-sizing:border-box"></div></div>
<div style="height:8px;background:#ff2d2d"></div>
<div style="position:relative;width:${WIDTH}px;height:${zoomH}px;overflow:hidden">
<img src="${src}" style="position:absolute;width:${WIDTH / zw}px;left:${(-zx * WIDTH) / zw}px;top:${(-zy * WIDTH * h) / (zw * w)}px">
<div style="position:absolute;left:${((rect.x - zx) / zw) * WIDTH}px;top:${((rect.y - zy) / zh) * zoomH}px;width:${(rect.w / zw) * WIDTH}px;height:${(rect.h / zh) * zoomH}px;border:3px solid #ff2d2d;box-sizing:border-box"></div></div></body>`
    const page = await browser.newPage({ viewport: { width: WIDTH, height: 600 } })
    await page.setContent(html)
    await page.screenshot({ path: out, fullPage: true })
    await page.close()
}
