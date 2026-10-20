<template>
    <section v-if="shot" class="viewer">
        <div class="viewer-head">
            <a :href="backHref">← 截圖牆</a>
            <h1>{{ shot.label }}</h1>
            <code>{{ shot.stateKey }}</code>
            <span class="nav"><button :disabled="!prev" @click="goShot(prev)">←</button><button :disabled="!next" @click="goShot(next)">→</button></span>
        </div>
        <p v-if="error" class="error">{{ error }}<a v-if="staleTo" :href="staleTo">切換到最新一輪</a><blockquote v-if="lostNote" class="lost-note">{{ lostNote }}</blockquote></p>
        <div class="cols">
            <div class="imgs">
                <AnnotLayer
                    v-for="(f, idx) in shot.files"
                    :key="f"
                    :src="api.fileUrl(shot.runId, f)"
                    :file-idx="idx"
                    :comments="numbered.filter((c) => c.fileIdx === idx || (idx === 0 && c.fileIdx >= shot.files.length))"
                    :editable="isLatest"
                    :highlight-id="hover"
                    @hover="hover = $event"
                    @create="create"
                />
            </div>
            <aside>
                <h2>標註 <small>{{ numbered.length }}</small></h2>
                <CommentList :comments="numbered" :highlight-id="hover" :editable="isLatest" :latest-run-id="latestRun?.id" @hover="hover = $event" @update="update" @remove="remove" />
            </aside>
        </div>
    </section>
    <p v-else-if="loaded" class="missing">這一輪沒有這個畫面。<a :href="href('/')">回截圖牆</a></p>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AnnotLayer from '../components/AnnotLayer.vue'
import CommentList from '../components/CommentList.vue'
import { api } from '../api.js'
import { route, go, href } from '../route.js'
import { currentRunId, isLatest, latestRun, loadRuns } from '../store.js'
import { onServerEvent } from '../sse.js'

const shots = ref([])
const comments = ref([])
const hover = ref(null)
const error = ref('')
const staleTo = ref('')
const lostNote = ref('')
const loaded = ref(false)
const key = computed(() => route.value.query.key)
const idx = computed(() => shots.value.findIndex((s) => s.stateKey === key.value))
const shot = computed(() => shots.value[idx.value] ?? null)
const prev = computed(() => shots.value[idx.value - 1] ?? null)
const next = computed(() => shots.value[idx.value + 1] ?? null)
const backHref = computed(() => href('/', { run: currentRunId.value }))

// Latest run: every open note on this screen; an older run: only notes drawn on that run.
const numbered = computed(() => {
    const list = isLatest.value ? comments.value.filter((c) => c.status === 'open') : comments.value.filter((c) => c.runId === currentRunId.value)
    return list.map((c, i) => ({ ...c, n: i + 1 }))
})

async function loadComments() {
    comments.value = await api.comments({ state_key: key.value })
}
async function load() {
    shots.value = await api.shots(currentRunId.value)
    await loadComments()
    loaded.value = true
}
function goShot(s) {
    go('/shot', { key: s.stateKey, run: s.runId })
}
async function create({ fileIdx, rect, text }) {
    error.value = ''
    staleTo.value = ''
    lostNote.value = ''
    try {
        await api.createComment({ runId: currentRunId.value, stateKey: key.value, fileIdx, rect, text })
        await loadComments()
    } catch (e) {
        lostNote.value = text
        if (e.status === 409) {
            error.value = '已有新一輪截圖，這張已經過時，標註沒有存。'
            staleTo.value = href('/shot', { key: key.value, run: String(e.body.latestRunId) })
            await loadRuns()
        } else error.value = `儲存失敗：${e.message}`
    }
}
async function update({ id, text }, done) {
    error.value = ''
    staleTo.value = ''
    lostNote.value = ''
    try {
        await api.updateComment(id, text)
        await loadComments()
        done(true)
    } catch (e) {
        error.value = `儲存失敗：${e.message}`
        done(false)
    }
}
async function remove(id) {
    error.value = ''
    staleTo.value = ''
    lostNote.value = ''
    try {
        await api.deleteComment(id)
        await loadComments()
    } catch (e) {
        error.value = `刪除失敗：${e.message}`
    }
}
function onKey(e) {
    if (e.target.closest('textarea, input, select')) return
    if (e.key === 'ArrowLeft' && prev.value) goShot(prev.value)
    if (e.key === 'ArrowRight' && next.value) goShot(next.value)
    if (e.key === 'Escape') location.hash = backHref.value
}

onMounted(() => {
    load()
    addEventListener('keydown', onKey)
})
const off = onServerEvent(({ type, data }) => {
    if (type === 'reconnected' || (type.startsWith('comment.') && data.stateKey === key.value)) loadComments()
})
onUnmounted(() => {
    off()
    removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.viewer-head { display: flex; gap: 14px; align-items: baseline; flex-wrap: wrap; margin-bottom: 10px }
.viewer-head h1 { font-size: 17px; margin: 0 }
.viewer-head code { color: var(--muted); font-size: 12px }
.nav { margin-left: auto; display: flex; gap: 4px }
.cols { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start }
.imgs { display: flex; flex-direction: column; gap: 10px }
aside { position: sticky; top: 60px; max-height: calc(100vh - 80px); overflow: auto }
aside h2 { font-size: 15px; margin: 0 0 8px }
.error { background: var(--warn-bg); color: var(--warn); padding: 8px 12px; border-radius: 4px }
.error a { margin-left: 8px }
.lost-note { margin: 6px 0 0; padding: 6px 10px; border-left: 3px solid var(--warn); white-space: pre-wrap; overflow-wrap: anywhere; user-select: text }
.missing { color: var(--muted) }
</style>
