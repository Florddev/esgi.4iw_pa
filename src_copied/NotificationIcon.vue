<!-- src/components/ui/NotificationIcon.vue -->
<template>
    <div class="notification-icon-wrapper" :style="{ width: `${size}px`, height: `${size}px` }">
        <svg :width="size" :height="size" viewBox="0 0 24 24" class="notification-icon-svg" fill="currentColor">
            <component :is="iconComponent" />
        </svg>
    </div>
</template>

<script setup lang="ts">
import { computed, defineComponent } from 'vue'

interface Props {
    type: 'success' | 'error' | 'warning' | 'info'
    size?: number
}

const props = withDefaults(defineProps<Props>(), {
    size: 16
})

// Notification Icon Components
const SuccessIcon = defineComponent({
    name: 'SuccessIcon',
    template: `
      <g>
        <circle cx="12" cy="12" r="10"/>
        <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    `
})

const ErrorIcon = defineComponent({
    name: 'ErrorIcon',
    template: `
      <g>
        <circle cx="12" cy="12" r="10"/>
        <path d="M15 9l-6 6M9 9l6 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    `
})

const WarningIcon = defineComponent({
    name: 'WarningIcon',
    template: `
      <g>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13" stroke="white" stroke-width="2" stroke-linecap="round"/>
        <circle cx="12" cy="17" r="1" fill="white"/>
      </g>
    `
})

const InfoIcon = defineComponent({
    name: 'InfoIcon',
    template: `
      <g>
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4M12 8h.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    `
})

// Component mapping
const iconComponents = {
    success: SuccessIcon,
    error: ErrorIcon,
    warning: WarningIcon,
    info: InfoIcon
} as const

// Computed icon component
const iconComponent = computed(() => {
    return iconComponents[props.type]
})
</script>

<style scoped>
.notification-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
}

.notification-icon-svg {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}
</style>