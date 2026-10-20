<template>
    <div class="compare-modal" role="dialog" aria-modal="true" @click.self="$emit('close')">
        <div class="frame">
            <header><strong>{{ comment.label }}</strong><button @click="$emit('close')">關閉（Esc）</button></header>
            <div class="cols">
                <div ref="left" class="col" @scroll="sync('left')">
                    <ShotImage :src="api.fileUrl(comment.before.runId, comment.before.file)" :boxes="[{ rect: comment.rect, variant: 'before' }]" />
                </div>
                <div ref="right" class="col" @scroll="sync('right')">
                    <ShotImage v-if="comment.after" :src="api.fileUrl(comment.after.runId, comment.after.file)" :boxes="[{ rect: comment.rect, variant: 'after' }]" />
                    <p v-else class="gone">新一輪無此畫面</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import ShotImage from './ShotImage.vue'
import { api } from '../api.js'
defineProps({ comment: { type: Object, required: true } })
const emit = defineEmits(['close'])
const left = ref(null)
const right = ref(null)
let lock = false
function sync(from) {
    if (lock) return
    lock = true
    const [a, b] = from === 'left' ? [left.value, right.value] : [right.value, left.value]
    b.scrollTop = a.scrollTop
    b.scrollLeft = a.scrollLeft
    requestAnimationFrame(() => (lock = false))
}
const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => addEventListener('keydown', onKey))
onUnmounted(() => removeEventListener('keydown', onKey))
</script>

<style scoped>
.compare-modal { position: fixed; inset: 0; z-index: 50; background: rgb(5 8 12 / 0.85); display: grid; place-items: center; padding: 20px }
.frame { width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--panel); border-radius: 6px; overflow: hidden }
header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--line) }
.cols { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2px; background: var(--line) }
.col { overflow: auto; background: var(--bg) }
.col :deep(.shot) { width: 1440px }
.gone { color: var(--warn); padding: 20px }
</style>
