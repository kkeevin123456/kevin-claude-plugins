<template>
    <div class="shot">
        <img :src="src" alt="" draggable="false" @load="$emit('load', $event)" />
        <div
            v-for="(b, i) in boxes"
            :key="b.id ?? `b${i}`"
            class="box"
            :class="`box--${b.variant}`"
            :data-comment-id="b.id"
            :style="{ left: pct(b.rect.x), top: pct(b.rect.y), width: pct(b.rect.w), height: pct(b.rect.h) }"
        >
            <span v-if="b.n" class="pin" @mouseenter="$emit('hover', b.id)" @mouseleave="$emit('hover', null)">{{ b.n }}</span>
        </div>
        <slot />
    </div>
</template>

<script setup>
defineProps({ src: { type: String, required: true }, boxes: { type: Array, default: () => [] } })
defineEmits(['hover', 'load'])
const pct = (v) => `${v * 100}%`
</script>

<style scoped>
.shot { position: relative; line-height: 0; user-select: none }
img { width: 100%; display: block }
.box { position: absolute; z-index: 2; box-sizing: border-box; border: 2px solid var(--mark); pointer-events: none }
.box--before { border-color: var(--mark) }
.box--after { border: 2px dashed var(--ok) }
.box--draft { border: 2px dashed var(--accent); pointer-events: none }
.box--highlight { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent) }
.pin { pointer-events: auto; cursor: default; position: absolute; top: -11px; left: -11px; width: 20px; height: 20px; border-radius: 50%; background: var(--mark); color: #fff; font: 600 12px/20px var(--sans); text-align: center }
.box--highlight .pin { background: var(--accent) }
</style>
