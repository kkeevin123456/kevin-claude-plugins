<template>
    <article class="compare-row">
        <div class="pair">
            <figure class="before" @click="$emit('open', comment)">
                <figcaption>修正前 · 第 {{ comment.before.runId }} 輪</figcaption>
                <ShotImage :src="api.fileUrl(comment.before.runId, comment.before.file)" :boxes="[{ rect: comment.rect, variant: 'before' }]" />
            </figure>
            <figure class="after" @click="$emit('open', comment)">
                <figcaption>修正後 · 第 {{ comment.fixedRunId }} 輪</figcaption>
                <ShotImage v-if="comment.after" :src="api.fileUrl(comment.after.runId, comment.after.file)" :boxes="[{ rect: comment.rect, variant: 'after' }]" />
                <p v-else class="gone">新一輪無此畫面</p>
            </figure>
        </div>
        <p class="text">{{ comment.text }}</p>
        <p class="meta">
            <code>{{ comment.stateKey }}</code>
            <span>第 {{ comment.runId }} 輪 → 第 {{ comment.fixedRunId }} 輪</span>
            <a v-if="comment.commit && commitLink(comment.commit)" :href="commitLink(comment.commit)" target="_blank" rel="noopener">{{ comment.commit }}</a>
            <code v-else-if="comment.commit">{{ comment.commit }}</code>
        </p>
    </article>
</template>

<script setup>
import ShotImage from './ShotImage.vue'
import { api } from '../api.js'
import { commitLink } from '../store.js'
defineProps({ comment: { type: Object, required: true } })
defineEmits(['open'])
</script>

<style scoped>
.compare-row { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 12px }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px }
figure { margin: 0; cursor: zoom-in; min-width: 0 }
figcaption { font-size: 12px; color: var(--muted); margin-bottom: 4px }
.text { margin: 10px 0 4px; white-space: pre-wrap; overflow-wrap: anywhere }
.meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin: 0 }
.gone { color: var(--warn) }
</style>
