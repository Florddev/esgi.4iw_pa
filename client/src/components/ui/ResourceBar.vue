<script setup lang="ts">
import { computed } from 'vue'
import { ResourceManager } from '@/game/services/ResourceManager'
import type { ResourceType } from '@/game/types'
import ResourceIcon from './ResourceIcon.vue'

interface Props {
    resourceType: ResourceType
    current: number
    max: number
    width?: number
}

const props = withDefaults(defineProps<Props>(), {
    width: 150
})

const resourceManager = ResourceManager.getInstance()

const resourceData = computed(() => {
    return resourceManager.getResource(props.resourceType)
})

const resourceName = computed(() => {
    return resourceData.value?.name || 'Unknown'
})

const resourceColor = computed(() => {
    const color = resourceData.value?.color || 0xFFFFFF
    return `#${color.toString(16).padStart(6, '0')}`
})

const fillPercentage = computed(() => {
    if (props.max === 0) return 0
    return Math.min(100, (props.current / props.max) * 100)
})

const fillColorClass = computed(() => {
    const percentage = fillPercentage.value

    if (percentage >= 80) {
        return 'bg-green-500'
    } else if (percentage >= 50) {
        return 'bg-yellow-500'
    } else if (percentage >= 25) {
        return 'bg-orange-500'
    } else {
        return 'bg-red-500'
    }
})
</script>
<template>
    <div class="resource-bar-container flex items-center gap-3">
        <!-- Resource Icon -->
        <div class="resource-icon-container flex-shrink-0" :style="{ color: resourceColor }">
            <ResourceIcon :resource-type="resourceType" :size="20" />
        </div>

        <!-- Progress Bar -->
        <div class="progress-container flex-1">
            <div class="progress-bar-background relative h-3 rounded-full overflow-hidden"
                :style="{ width: `${width}px` }">
                <!-- Background -->
                <div class="absolute inset-0 bg-gray-700"></div>

                <!-- Fill -->
                <div class="progress-fill absolute top-0 left-0 h-full transition-all duration-300 ease-out"
                    :class="fillColorClass" :style="{ width: fillPercentage + '%' }"></div>

                <!-- Quantity Text Overlay -->
                <div class="absolute inset-0 flex items-center justify-center">
                    <span class="text-xs font-bold text-white drop-shadow-sm">
                        {{ current }}/{{ max }}
                    </span>
                </div>
            </div>

            <!-- Resource Name -->
            <div class="resource-name mt-1 text-xs text-gray-300 text-center">
                {{ resourceName }}
            </div>
        </div>
    </div>
</template>

<style scoped>
.progress-bar-background {
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

.progress-fill {
    background-image: linear-gradient(45deg,
            rgba(255, 255, 255, 0.1) 25%,
            transparent 25%,
            transparent 50%,
            rgba(255, 255, 255, 0.1) 50%,
            rgba(255, 255, 255, 0.1) 75%,
            transparent 75%,
            transparent);
    background-size: 20px 20px;
    animation: progress-stripe 1s linear infinite;
}

@keyframes progress-stripe {
    0% {
        background-position: 0 0;
    }

    100% {
        background-position: 20px 0;
    }
}

.resource-bar-container {
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    border-radius: 8px;
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>