<template>
    <section>
        <p v-if="!isLatest && run" class="banner">這是第 {{ run.id }} 輪，只能瀏覽。</p>
        <details v-if="run?.skipped.length" class="skipped">
            <summary>略過 {{ run.skipped.length }} 個畫面</summary>
            <ul><li v-for="s in run.skipped" :key="s.key"><code>{{ s.key }}</code> — {{ s.reason }}</li></ul>
        </details>
        <nav class="filters">
            <button v-for="p in pages" :key="p" :aria-pressed="page === p" @click="setFilter('page', p)">{{ p }}</button>
            <span class="sep"></span>
            <button v-for="m in modes" :key="m" :aria-pressed="mode === m" @click="setFilter('mode', m)">{{ m }}</button>
        </nav>
        <div v-for="g in groups" :key="g.title" class="group">
            <h2>{{ g.title }} <small>{{ g.items.length }}</small></h2>
            <div class="grid">
                <a v-for="s in g.items" :key="s.stateKey" class="card" :href="shotHref(s)" :data-state="s.stateKey">
                    <img :src="api.fileUrl(s.runId, s.files[0])" loading="lazy" alt="" />
                    <span v-if="s.openCount" class="badge" :title="`${s.openCount} 個未處理標註`">{{ s.openCount }}</span>
                    <span class="cap">{{ s.label }}<small v-if="s.files.length > 1"> +{{ s.files.length - 1 }}</small></span>
                </a>
            </div>
        </div>
        <p v-if="error" class="empty">載入失敗：{{ error }}</p>
        <p v-else-if="!shots.length && run" class="empty">這一輪沒有截圖。</p>
        <p v-if="!run" class="empty">還沒有任何輪次。在 VM 上執行 <code>ui-audit capture</code> 產生第一輪。</p>
    </section>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { api } from '../api.js'
import { route, go, href } from '../route.js'
import { currentRunId, isLatest, runById } from '../store.js'
import { onServerEvent } from '../sse.js'

const shots = ref([])
const error = ref('')
const run = computed(() => runById(currentRunId.value))
const page = computed(() => route.value.query.page ?? 'all')
const mode = computed(() => route.value.query.mode ?? 'all')
const pages = computed(() => ['all', ...new Set(shots.value.map((s) => s.page))])
const modes = computed(() => ['all', ...new Set(shots.value.map((s) => s.mode))])
const groups = computed(() => {
    const out = new Map()
    for (const s of shots.value) {
        if ((page.value !== 'all' && s.page !== page.value) || (mode.value !== 'all' && s.mode !== mode.value)) continue
        const title = `${s.page} · ${s.mode}`
        if (!out.has(title)) out.set(title, { title, items: [] })
        out.get(title).items.push(s)
    }
    return [...out.values()]
})

function setFilter(k, v) {
    go('/', { ...route.value.query, [k]: v === 'all' ? null : v })
}
const shotHref = (s) => href('/shot', { key: s.stateKey, run: String(s.runId) })

async function load() {
    const id = currentRunId.value
    try {
        const result = id ? await api.shots(id) : []
        if (id !== currentRunId.value) return
        shots.value = result
        error.value = ''
    } catch (e) {
        if (id !== currentRunId.value) return
        shots.value = []
        error.value = e.message
    }
}
watch(currentRunId, load, { immediate: true })
const off = onServerEvent(({ type }) => {
    if (type.startsWith('comment.') || type === 'reconnected') load()
})
onUnmounted(off)
</script>

<style scoped>
.banner { background: var(--warn-bg); color: var(--warn); padding: 8px 12px; border-radius: 4px }
.filters { display: flex; flex-wrap: wrap; gap: 6px; margin-block: 12px }
.filters button { font: inherit; font-size: 13px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line); background: var(--panel); color: var(--fg); cursor: pointer }
.filters button[aria-pressed='true'] { background: var(--accent); border-color: var(--accent); color: #fff }
.sep { width: 1px; background: var(--line) }
.group h2 { font-size: 15px; margin: 18px 0 8px }
.group h2 small { color: var(--muted); font-weight: 400 }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px }
.card { position: relative; display: flex; flex-direction: column; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; color: inherit; text-decoration: none }
.card img { width: 100%; aspect-ratio: 16/10; object-fit: cover; object-position: top }
.badge { position: absolute; top: 6px; right: 6px; min-width: 22px; height: 22px; border-radius: 11px; background: var(--mark); color: #fff; font-size: 12px; font-weight: 600; display: grid; place-items: center; padding: 0 6px }
.cap { padding: 8px 10px; font-size: 13px; overflow-wrap: anywhere }
.cap small { color: var(--muted) }
.empty { color: var(--muted) }
</style>
