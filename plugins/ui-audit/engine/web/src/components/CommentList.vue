<template>
    <ol class="list">
        <li
            v-for="c in comments"
            :key="c.id"
            class="comment-item"
            :class="{ hi: c.id === highlightId }"
            :data-id="c.id"
            @mouseenter="$emit('hover', c.id)"
            @mouseleave="$emit('hover', null)"
        >
            <span class="n">{{ c.n }}</span>
            <div class="body">
                <template v-if="editing === c.id">
                    <textarea v-model="draft" rows="3"></textarea>
                    <div class="acts"><button class="save" @click="save(c)">儲存</button><button @click="editing = null">取消</button></div>
                </template>
                <template v-else>
                    <p class="text">{{ c.text }}</p>
                    <div class="meta">
                        <span v-if="c.runId !== latestRunId" class="from-run">標於第 {{ c.runId }} 輪</span>
                        <span>{{ c.createdAt.slice(0, 16).replace('T', ' ') }}</span>
                    </div>
                    <div v-if="editable" class="acts">
                        <template v-if="removing === c.id">
                            <span>確定刪除？</span><button class="confirm-remove" @click="$emit('remove', c.id)">刪除</button><button @click="removing = null">取消</button>
                        </template>
                        <template v-else>
                            <button class="edit" @click="startEdit(c)">編輯</button><button class="remove" @click="removing = c.id">刪除</button>
                        </template>
                    </div>
                </template>
            </div>
        </li>
        <li v-if="!comments.length" class="empty">{{ editable ? '在圖上按住左鍵拉一個框，就能新增標註。' : '這張圖沒有標註。' }}</li>
    </ol>
</template>

<script setup>
import { ref } from 'vue'
defineProps({ comments: Array, highlightId: Number, editable: Boolean, latestRunId: Number })
const emit = defineEmits(['hover', 'update', 'remove'])
const editing = ref(null)
const removing = ref(null)
const draft = ref('')
function startEdit(c) {
    editing.value = c.id
    draft.value = c.text
}
function save(c) {
    if (!draft.value.trim()) return
    emit('update', { id: c.id, text: draft.value.trim() }, (ok) => {
        if (ok) editing.value = null
    })
}
</script>

<style scoped>
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px }
.comment-item { display: flex; gap: 10px; padding: 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel) }
.comment-item.hi { border-color: var(--accent) }
.n { flex: none; width: 22px; height: 22px; border-radius: 50%; background: var(--mark); color: #fff; font-size: 12px; font-weight: 600; display: grid; place-items: center }
.hi .n { background: var(--accent) }
.body { min-width: 0; flex: 1 }
.text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere }
.meta { display: flex; gap: 10px; font-size: 12px; color: var(--muted); margin-top: 4px }
.from-run { color: var(--warn) }
.acts { display: flex; gap: 6px; align-items: center; margin-top: 6px; font-size: 13px }
.acts button { font: inherit; padding: 2px 8px }
textarea { width: 100%; box-sizing: border-box; font: inherit }
.empty { color: var(--muted); padding: 10px }
</style>
