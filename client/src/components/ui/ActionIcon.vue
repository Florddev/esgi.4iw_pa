<!-- src/components/ui/ActionIcon.vue -->
<template>
    <div class="action-icon-wrapper" :style="{ width: `${size}px`, height: `${size}px` }">
        <svg :width="size" :height="size" viewBox="0 0 24 24" class="action-icon-svg" fill="currentColor">
            <component :is="iconComponent" />
        </svg>
    </div>
</template>

<script setup lang="ts">
import { computed, defineComponent } from 'vue'

interface Props {
    iconType: string
    size?: number
}

const props = withDefaults(defineProps<Props>(), {
    size: 16
})

// Action Icon Components
const WorkerIcon = defineComponent({
    name: 'WorkerIcon',
    template: `
      <g>
        <circle cx="12" cy="7" r="3"/>
        <path d="M14 14H10a4 4 0 0 0-4 4v2h12v-2a4 4 0 0 0-4-4z"/>
        <path d="M8 14l2-2 2 2 2-2"/>
      </g>
    `
})

const TrashIcon = defineComponent({
    name: 'TrashIcon',
    template: `
      <g>
        <path d="M3 6h18"/>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
        <line x1="10" y1="11" x2="10" y2="17"/>
        <line x1="14" y1="11" x2="14" y2="17"/>
      </g>
    `
})

const PlusIcon = defineComponent({
    name: 'PlusIcon',
    template: `
      <g>
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v8"/>
        <path d="M8 12h8"/>
      </g>
    `
})

const CloseIcon = defineComponent({
    name: 'CloseIcon',
    template: `
      <g>
        <circle cx="12" cy="12" r="10"/>
        <path d="M15 9l-6 6"/>
        <path d="M9 9l6 6"/>
      </g>
    `
})

const SettingsIcon = defineComponent({
    name: 'SettingsIcon',
    template: `
      <g>
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v6m0 6v6"/>
        <path d="M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10z"/>
        <path d="M16.24 7.76l-2.12 2.12m-4.24 4.24l-2.12 2.12"/>
        <path d="M16.24 16.24l-2.12-2.12m-4.24-4.24l-2.12-2.12"/>
      </g>
    `
})

const InfoIcon = defineComponent({
    name: 'InfoIcon',
    template: `
      <g>
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4"/>
        <path d="M12 8h.01"/>
      </g>
    `
})

const UnknownIcon = defineComponent({
    name: 'UnknownIcon',
    template: `
      <g>
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <path d="M12 17h.01"/>
      </g>
    `
})

// Component mapping
const iconComponents = {
    worker: WorkerIcon,
    trash: TrashIcon,
    plus: PlusIcon,
    close: CloseIcon,
    settings: SettingsIcon,
    info: InfoIcon
} as const

// Computed icon component
const iconComponent = computed(() => {
    return iconComponents[props.iconType as keyof typeof iconComponents] || UnknownIcon
})
</script>

<style scoped>
.action-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
}

.action-icon-svg {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}
</style>