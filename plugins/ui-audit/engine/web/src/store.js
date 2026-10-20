import { ref, computed } from 'vue'
import { api } from './api.js'
import { route } from './route.js'

export const projects = ref([])
export const projectsLoaded = ref(false)
export const siteConfig = ref({ commitUrl: null, issueUrl: null })
export const currentProject = computed(() => projects.value.find((p) => p.slug === route.value.project) ?? null)

export const runs = ref([])
export const latestRun = computed(() => runs.value[0] ?? null)
export const currentRunId = computed(() => Number(route.value.query.run) || latestRun.value?.id || null)
export const isLatest = computed(() => !!latestRun.value && currentRunId.value === latestRun.value.id)
export const runById = (id) => runs.value.find((r) => r.id === id) ?? null

export async function loadProjects() {
    const [list, config] = await Promise.all([api.projects(), api.config()])
    projects.value = list
    siteConfig.value = config
    projectsLoaded.value = true
}

// A response that arrives after the project changed belongs to the old project and is dropped.
export async function loadRuns() {
    const project = route.value.project
    if (!project) {
        runs.value = []
        return
    }
    const list = await api.runs()
    if (route.value.project === project) runs.value = list
}

const fill = (template, key, value) => (/^https?:\/\//.test(template ?? '') ? template.replaceAll(`{${key}}`, encodeURIComponent(value)) : null)
// A project may name its own repository; the site config is the fallback for every project.
export const commitLink = (sha) => fill(currentProject.value?.meta?.commitUrl ?? siteConfig.value.commitUrl, 'sha', sha)
// {key} is the whole key; {n} is its first run of digits, for trackers whose URLs use the bare number.
export const issueLink = (key) => {
    const t = currentProject.value?.meta?.issueUrl ?? siteConfig.value.issueUrl
    const link = fill(t, 'key', key)
    return link && link.replaceAll('{n}', encodeURIComponent(key.match(/\d+/)?.[0] ?? key))
}
