export const MIN_DRAG_PX = 8
// The server rejects rects thinner than this fraction of the image.
const MIN_RATIO = 0.005

const clamp = (v, max) => Math.min(Math.max(v, 0), max)
const round = (v) => Math.round(v * 1e4) / 1e4

export function dragToRect(start, end, box) {
    if (Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) < MIN_DRAG_PX) return null
    const x1 = clamp(Math.min(start.x, end.x), box.width)
    const x2 = clamp(Math.max(start.x, end.x), box.width)
    const y1 = clamp(Math.min(start.y, end.y), box.height)
    const y2 = clamp(Math.max(start.y, end.y), box.height)
    const w = (x2 - x1) / box.width
    const h = (y2 - y1) / box.height
    if (w < MIN_RATIO || h < MIN_RATIO) return null
    return { x: round(x1 / box.width), y: round(y1 / box.height), w: round(w), h: round(h) }
}

// An Enter that confirms an IME candidate (Chinese input) must not save the note.
export function keyAction({ key, shiftKey = false, isComposing = false }) {
    if (key === 'Escape') return 'cancel'
    if (key === 'Enter' && !shiftKey && !isComposing) return 'save'
    return null
}

export const blurAction = (text) => (text.trim() ? 'save' : 'cancel')
