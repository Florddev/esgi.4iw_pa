<script setup lang="ts">
import { computed } from 'vue'
import { ResourceManager } from '@/game/services/ResourceManager'
import type { ResourceStack } from '@/game/types'
import ResourceIcon from './ResourceIcon.vue'

interface Props {
    resource: ResourceStack
    showName?: boolean
    size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
    showName: false,
    size: 'md'
})

const resourceManager = ResourceManager.getInstance()

const resourceData = computed(() => {
    return resourceManager.getResource(props.resource.type)
})

const resourceName = computed(() => {
    return resourceData.value?.name || 'Unknown'
})

const resourceColor = computed(() => {
    const color = resourceData.value?.color || 0xFFFFFF
    return `#${color.toString(16).padStart(6, '0')}`
})

const sizeClasses = computed(() => {
    const sizeMap = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base'
    }
    return sizeMap[props.size]
})

const iconClasses = computed(() => {
    const sizeMap = {
        sm: 'w-6 h-6',
        md: 'w-8 h-8',
        lg: 'w-10 h-10'
    }
    return sizeMap[props.size]
})

const iconSize = computed(() => {
    const sizeMap = {
        sm: 16,
        md: 20,
        lg: 24
    }
    return sizeMap[props.size]
})

const amountClasses = computed(() => {
    const sizeMap = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base'
    }
    return sizeMap[props.size]
})

const formatAmount = (amount: number): string => {
    if (amount >= 1000000) {
        return `${(amount / 1000000).toFixed(1)}M`
    }
    if (amount >= 1000) {
        return `${(amount / 1000).toFixed(1)}K`
    }
    return amount.toString()
}
</script>
<template>
    <div class="resource-item" :class="[
        'flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-sm',
        'bg-black/70 text-white border border-gray-600/30',
        'transition-all duration-200 hover:bg-black/80',
        sizeClasses
    ]">
        <!-- Resource Icon -->
        <div class="resource-icon flex-shrink-0 rounded-full flex items-center justify-center" :class="iconClasses"
            :style="{ backgroundColor: resourceColor }">
            <ResourceIcon :resource-type="resource.type" :size="iconSize" />
        </div>

        <!-- Resource Amount -->
        <span class="resource-amount font-bold tabular-nums" :class="amountClasses">
            {{ formatAmount(resource.amount) }}
        </span>

        <!-- Resource Name (optional) -->
        <span v-if="showName" class="resource-name text-gray-200 text-sm font-medium">
            {{ resourceName }}
        </span>
    </div>
</template>

<style scoped>
.resource-item {
    min-width: fit-content;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.resource-icon {
    position: relative;
    overflow: hidden;
}

.resource-icon::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%);
    pointer-events: none;
}

.tabular-nums {
    font-variant-numeric: tabular-nums;
}
</style>