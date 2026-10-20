<template>
    <header class="bar">
        <strong class="name">UI Audit</strong>
        <label v-if="projects.length" class="projsel">
            專案
            <select :value="route.project" @change="go('/', {}, $event.target.value)">
                <option v-for="p in projects" :key="p.slug" :value="p.slug">{{ p.name }}{{ p.openCount ? ` (${p.openCount})` : '' }}</option>
            </select>
        </label>
        <nav v-if="currentProject" class="tabs">
            <a :href="href('/')" :aria-current="view === 'gallery' || view === 'shot'">截圖</a>
            <a :href="href('/comments')" :aria-current="view === 'comments'">標註</a>
        </nav>
        <label v-if="currentProject" class="runsel">
            輪次
            <select :value="currentRunId ?? ''" @change="pickRun($event.target.value)">
                <option v-for="r in runs" :key="r.id" :value="r.id">第 {{ r.id }} 輪 · {{ r.ref }} · {{ r.sha.slice(0, 7) }} · {{ r.createdAt.slice(0, 10) }}{{ r.note ? ` · ${r.note}` : '' }}</option>
            </select>
        </label>
    </header>
    <p v-if="newRun" class="newrun">已有新一輪截圖（第 {{ newRun }} 輪）。<button @click="showLatest">切換到最新</button></p>
    <main>
        <p v-if="projectsLoaded && !projects.length" class="empty">還沒有任何專案。在安裝 UI Audit 的機器上執行 <code>ui-audit capture --target &lt;名稱&gt;</code> 產生第一輪。</p>
        <template v-else-if="currentProject">
            <Gallery v-if="view === 'gallery'" :key="route.project" />
            <Viewer v-else-if="view === 'shot'" :key="route.project + route.query.key + route.query.run" />
            <Comments v-else-if="view === 'comments'" :key="route.project" />
        </template>
    </main>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import Gallery from './views/Gallery.vue'
import Viewer from './views/Viewer.vue'
import Comments from './views/Comments.vue'
import { route, go, href, redirectLegacy } from './route.js'
import { projects, projectsLoaded, currentProject, runs, currentRunId, loadProjects, loadRuns } from './store.js'
import { onServerEvent } from './sse.js'

const view = computed(() => ({ '/': 'gallery', '/shot': 'shot', '/comments': 'comments' })[route.value.path] ?? 'gallery')
const newRun = ref(null)

function pickRun(id) {
    go(route.value.path, { ...route.value.query, run: id })
}
function showLatest() {
    newRun.value = null
    go('/', {})
}

loadProjects().then(() => redirectLegacy(projects.value.map((p) => p.slug)))
watch(
    () => route.value.project,
    () => {
        newRun.value = null
        runs.value = []
        if (projectsLoaded.value) redirectLegacy(projects.value.map((p) => p.slug))
    },
)
watch(
    () => currentProject.value?.slug,
    (slug) => slug && loadRuns(),
    { immediate: true },
)
const offProjects = onServerEvent(
    ({ type }) => {
        if (type.startsWith('comment.') || type === 'run.done' || type === 'reconnected') loadProjects()
    },
    { all: true },
)
const offRuns = onServerEvent(async ({ type, data }) => {
    if (type === 'run.done') {
        await loadRuns()
        newRun.value = data.runId
    }
})
onUnmounted(() => {
    offProjects()
    offRuns()
})
</script>

<style>
:root {
    --bg: #f3f5f8; --panel: #fff; --fg: #1b2330; --muted: #5d6878; --line: #d9dfe7;
    --accent: #057feb; --mark: #e5383b; --ok: #1e9e5a; --warn: #9a5b00; --warn-bg: #fff3dc;
    --sans: system-ui, 'Noto Sans TC', sans-serif;
}
@media (prefers-color-scheme: dark) {
    :root { --bg: #15181d; --panel: #1e2228; --fg: #e6eaf0; --muted: #98a2b0; --line: #2e343d; --accent: #3d9bff; --mark: #ff5a5f; --ok: #3ccf82; --warn: #f0b860; --warn-bg: #3a2c12; color-scheme: dark }
}
body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.5 var(--sans) }
main { padding: 12px 20px 40px }
</style>

<style scoped>
.bar { position: sticky; top: 0; z-index: 10; display: flex; gap: 20px; align-items: center; padding: 10px 20px; background: var(--panel); border-bottom: 1px solid var(--line) }
.tabs { display: flex; gap: 4px }
.tabs a { padding: 4px 12px; border-radius: 4px; color: var(--fg); text-decoration: none }
.tabs a[aria-current='true'] { background: var(--accent); color: #fff }
.runsel { margin-left: auto; display: flex; gap: 6px; align-items: center; color: var(--muted) }
.runsel select { font: inherit; max-width: 460px }
.projsel { display: flex; gap: 6px; align-items: center; color: var(--muted) }
.projsel select { font: inherit }
.empty { color: var(--muted) }
.newrun { margin: 0; padding: 8px 20px; background: var(--warn-bg); color: var(--warn) }
.newrun button { font: inherit; margin-left: 8px }
</style>
