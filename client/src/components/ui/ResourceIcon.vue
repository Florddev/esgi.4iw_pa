<!-- src/components/ui/ResourceIcon.vue -->
<template>
    <div class="resource-icon-wrapper" :style="{ width: `${size}px`, height: `${size}px` }">
        <svg :width="size" :height="size" viewBox="0 0 24 24" class="resource-icon-svg" fill="currentColor">
            <component :is="iconComponent" />
        </svg>
    </div>
</template>

<script setup lang="ts">
import { computed, defineComponent } from 'vue'
import type { ResourceType } from '@/game/types'

interface Props {
    resourceType: ResourceType
    size?: number
}

const props = withDefaults(defineProps<Props>(), {
    size: 20
})

// Resource Icon Components
const WoodIcon = defineComponent({
    name: 'WoodIcon',
    template: `
      <g>
        <path d="M12 2C8 2 6 4 6 8v8c0 4 2 6 6 6s6-2 6-8V8c0-4-2-6-6-6zm0 2c2.5 0 4 1 4 4v8c0 2.5-1 4-4 4s-4-1-4-4V8c0-3 1.5-4 4-4z"/>
        <path d="M8 12h8M8 9h8M8 15h8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
      </g>
    `
})

const StoneIcon = defineComponent({
    name: 'StoneIcon',
    template: `
      <g>
        <path d="M12 2l-8 6v8l8 6 8-6V8l-8-6zm0 2.5L17.5 9v6L12 19.5 6.5 15V9L12 4.5z"/>
        <circle cx="12" cy="12" r="2"/>
      </g>
    `
})

const FoodIcon = defineComponent({
    name: 'FoodIcon',
    template: `
      <g>
        <path d="M12 2C8.5 2 6 4.5 6 8s2.5 6 6 6 6-2.5 6-6-2.5-6-6-6zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/>
        <path d="M8 16c0 2.2 1.8 4 4 4s4-1.8 4-4"/>
        <circle cx="10" cy="9" r="1"/>
        <circle cx="14" cy="9" r="1"/>
      </g>
    `
})

const PlanksIcon = defineComponent({
    name: 'PlanksIcon',
    template: `
      <g>
        <rect x="3" y="6" width="18" height="3" rx="1"/>
        <rect x="3" y="10" width="18" height="3" rx="1"/>
        <rect x="3" y="14" width="18" height="3" rx="1"/>
        <line x1="8" y1="6" x2="8" y2="17" stroke="currentColor" stroke-width="1"/>
        <line x1="16" y1="6" x2="16" y2="17" stroke="currentColor" stroke-width="1"/>
      </g>
    `
})

const ToolsIcon = defineComponent({
    name: 'ToolsIcon',
    template: `
      <g>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z"/>
      </g>
    `
})

const MetalIcon = defineComponent({
    name: 'MetalIcon',
    template: `
      <g>
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </g>
    `
})

const UnknownIcon = defineComponent({
    name: 'UnknownIcon',
    template: `
      <g>
        <circle cx="12" cy="12" r="10"/>
        <path d="m9 9 3-3 3 3m-3 12v-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    `
})

// Component mapping
const iconComponents = {
    wood: WoodIcon,
    stone: StoneIcon,
    food: FoodIcon,
    planks: PlanksIcon,
    tools: ToolsIcon,
    metal: MetalIcon
} as const

// Computed icon component
const iconComponent = computed(() => {
    return iconComponents[props.resourceType as keyof typeof iconComponents] || UnknownIcon
})
</script>

<style scoped>
.resource-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
}

.resource-icon-svg {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}
</style>