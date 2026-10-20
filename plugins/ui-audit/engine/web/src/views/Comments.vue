<template>
    <section>
        <nav class="status-filter">
            <button v-for="s in STATUSES" :key="s.id" :data-status="s.id" :aria-pressed="status === s.id" @click="go('/comments', { status: s.id })">{{ s.label }}</button>
        </nav>
        <div class="list">
            <p v-if="error" class="empty">載入失敗：{{ error }}</p>
            <template v-else-if="status === 'fixed'">
                <CompareRow v-for="c in list" :key="c.id" :comment="c" @open="opened = c" />
            </template>
            <template v-else>
                <div v-for="c in list" :key="c.id" class="comment-card" tabindex="0" @click="open(c)" @keydown.enter.self="open(c)">
                    <ShotImage v-if="c.before" class="thumb" :src="api.fileUrl(c.before.runId, c.before.file)" :boxes="[{ rect: c.rect, variant: 'before' }]" />
                    <div class="body">
                        <p class="text">{{ c.text }}</p>
                        <p class="meta">
                            <span>第 {{ c.runId }} 輪 · {{ c.label }}</span>
                            <span v-if="!c.inLatest" class="gone">新一輪無此畫面</span>
                            <a v-if="c.issueKey && issueLink(c.issueKey)" :href="issueLink(c.issueKey)" target="_blank" rel="noopener" @click.stop>{{ c.issueKey }}</a>
                            <span v-else-if="c.issueKey">{{ c.issueKey }}</span>
                        </p>
                        <p v-if="c.status === 'wontfix'" class="note">{{ c.note }}</p>
                    </div>
                </div>
            </template>
            <p v-if="ready && !error && !list.length" class="empty">沒有「{{ STATUSES.find((s) => s.id === status).label }}」的標註。</p>
        </div>
        <CompareModal v-if="opened" :comment="opened" @close="opened = null" />
    </section>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import ShotImage from '../components/ShotImage.vue'
import CompareRow from '../components/CompareRow.vue'
import CompareModal from '../components/CompareModal.vue'
import { api } from '../api.js'
import { route, go } from '../route.js'
import { latestRun, issueLink } from '../store.js'
import { onServerEvent } from '../sse.js'

const STATUSES = [
    { id: 'open', label: '未處理' },
    { id: 'fixed', label: '已修' },
    { id: 'issue', label: '已開 issue' },
    { id: 'wontfix', label: '不修' },
]
const status = computed(() => (STATUSES.some((s) => s.id === route.value.query.status) ? route.value.query.status : 'open'))
// Tagged with the status it was fetched for, so a stale or late response is never rendered under another filter.
const loaded = ref({ status: null, items: [], error: '' })
const ready = computed(() => loaded.value.status === status.value)
const list = computed(() => (ready.value ? loaded.value.items : []))
const error = computed(() => (ready.value ? loaded.value.error : ''))
let seq = 0
const opened = ref(null)

// Open notes are drawn against the latest run; others link to the run they were drawn on.
const shotQuery = (c) => ({ key: c.stateKey, run: String(c.status === 'open' && c.inLatest ? latestRun.value?.id ?? c.runId : c.runId) })

// The card holds an issue link, so it navigates by script instead of being an anchor itself.
const open = (c) => go('/shot', shotQuery(c))
async function load() {
    const mine = ++seq
    const wanted = status.value
    let next
    try {
        next = { status: wanted, items: await api.comments({ status: wanted }), error: '' }
    } catch (e) {
        next = { status: wanted, items: [], error: e.message }
    }
    if (mine === seq && wanted === status.value) loaded.value = next
}
watch(status, load, { immediate: true })
const off = onServerEvent(({ type }) => {
    if (type.startsWith('comment.') || type === 'reconnected' || type === 'run.done') load()
})
onUnmounted(off)
</script>

<style scoped>
.status-filter { display: flex; gap: 6px; margin-bottom: 14px }
.status-filter button { font: inherit; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--panel); color: var(--fg); cursor: pointer }
.status-filter button[aria-pressed='true'] { background: var(--accent); border-color: var(--accent); color: #fff }
.list { display: flex; flex-direction: column; gap: 12px }
.comment-card { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 12px; padding: 10px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; color: inherit; cursor: pointer }
.text { margin: 0 0 6px; white-space: pre-wrap; overflow-wrap: anywhere }
.meta { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin: 0 }
.note { margin: 6px 0 0; font-size: 13px }
.gone { color: var(--warn) }
.empty { color: var(--muted) }
</style>
