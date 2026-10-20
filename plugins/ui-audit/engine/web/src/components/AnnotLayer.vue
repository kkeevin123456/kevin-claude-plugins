<template>
    <ShotImage :src="src" :boxes="boxes" @hover="$emit('hover', $event)">
        <div v-if="editable" ref="layer" class="draw-layer" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp"></div>
        <div v-if="pending" class="note-editor" :style="editorPos" @pointerdown.stop>
            <textarea ref="input" v-model="text" rows="3" placeholder="描述這裡哪裡怪怪的（Enter 儲存、Esc 取消）" @keydown="onKey" @blur="onBlur"></textarea>
        </div>
    </ShotImage>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import ShotImage from './ShotImage.vue'
import { dragToRect, keyAction, blurAction } from '../draw.js'

const props = defineProps({ src: String, fileIdx: Number, comments: Array, editable: Boolean, highlightId: Number })
const emit = defineEmits(['create', 'hover'])

const layer = ref(null)
const input = ref(null)
const start = ref(null)
const draft = ref(null)
const pending = ref(null)
const text = ref('')
let closing = false

const boxes = computed(() => [
    ...props.comments.map((c) => ({ id: c.id, rect: c.rect, n: c.n, variant: c.id === props.highlightId ? 'highlight' : 'open' })),
    ...(draft.value ? [{ rect: draft.value, variant: 'draft' }] : []),
    ...(pending.value ? [{ rect: pending.value, variant: 'draft' }] : []),
])
const editorPos = computed(() => {
    const r = pending.value
    const below = r.y + r.h < 0.8
    return { left: `${Math.min(r.x, 0.7) * 100}%`, top: below ? `calc(${(r.y + r.h) * 100}% + 6px)` : 'auto', bottom: below ? 'auto' : `calc(${(1 - r.y) * 100}% + 6px)` }
})

const local = (e) => {
    const b = layer.value.getBoundingClientRect()
    return { pt: { x: e.clientX - b.left, y: e.clientY - b.top }, box: { width: b.width, height: b.height } }
}
function onDown(e) {
    if (e.button !== 0 || pending.value) return
    layer.value.setPointerCapture(e.pointerId)
    start.value = local(e).pt
}
function onMove(e) {
    if (!start.value) return
    const { pt, box } = local(e)
    draft.value = dragToRect(start.value, pt, box)
}
async function onUp(e) {
    if (!start.value) return
    const { pt, box } = local(e)
    const rect = dragToRect(start.value, pt, box)
    start.value = null
    draft.value = null
    if (!rect) return
    pending.value = rect
    text.value = ''
    await nextTick()
    input.value.focus()
}
function finish(action) {
    if (closing || !pending.value) return
    closing = true
    if (action === 'save') emit('create', { fileIdx: props.fileIdx, rect: pending.value, text: text.value.trim() })
    pending.value = null
    text.value = ''
    nextTick(() => (closing = false))
}
function onKey(e) {
    const action = keyAction(e)
    if (!action) return
    e.preventDefault()
    finish(action === 'save' && !text.value.trim() ? 'cancel' : action)
}
const onBlur = () => finish(blurAction(text.value))
</script>

<style scoped>
.draw-layer { position: absolute; inset: 0; cursor: crosshair; touch-action: none }
.note-editor { position: absolute; z-index: 5; width: 300px; line-height: 1.4 }
.note-editor textarea { width: 100%; box-sizing: border-box; font: 14px/1.4 var(--sans); padding: 8px; border: 2px solid var(--accent); border-radius: 4px; background: var(--panel); color: var(--fg); resize: vertical }
</style>
