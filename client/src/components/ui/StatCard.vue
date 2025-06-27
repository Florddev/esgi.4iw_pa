<template>
    <div class="stat-card p-4 rounded-lg border transition-all duration-200 hover:scale-105" :class="cardClasses">
        <!-- Icon and Value -->
        <div class="flex items-center justify-between mb-2">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center" :class="iconClasses">
                <ActionIcon :icon-type="icon" :size="20" />
            </div>

            <div class="text-right">
                <div class="text-2xl font-bold" :class="valueClasses">
                    {{ formattedValue }}
                </div>
            </div>
        </div>

        <!-- Title -->
        <h3 class="text-sm font-medium text-gray-400">
            {{ title }}
        </h3>

        <!-- Progress bar (optional) -->
        <div v-if="maxValue" class="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full transition-all duration-300" :class="progressClasses"
                :style="{ width: progressPercentage + '%' }" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ActionIcon from './ActionIcon.vue'

interface Props {
    title: string
    value: number
    icon: string
    color: 'blue' | 'green' | 'purple' | 'yellow' | 'red'
    maxValue?: number
}

const props = defineProps<Props>()

// Computed
const formattedValue = computed(() => {
    if (props.value >= 1000000) {
        return `${(props.value / 1000000).toFixed(1)}M`
    }
    if (props.value >= 1000) {
        return `${(props.value / 1000).toFixed(1)}K`
    }
    return props.value.toString()
})

const progressPercentage = computed(() => {
    if (!props.maxValue) return 0
    return Math.min(100, (props.value / props.maxValue) * 100)
})

const cardClasses = computed(() => {
    const colorClasses = {
        blue: 'bg-blue-600/10 border-blue-500/30',
        green: 'bg-green-600/10 border-green-500/30',
        purple: 'bg-purple-600/10 border-purple-500/30',
        yellow: 'bg-yellow-600/10 border-yellow-500/30',
        red: 'bg-red-600/10 border-red-500/30'
    }

    return colorClasses[props.color]
})

const iconClasses = computed(() => {
    const colorClasses = {
        blue: 'bg-blue-500/20 text-blue-400',
        green: 'bg-green-500/20 text-green-400',
        purple: 'bg-purple-500/20 text-purple-400',
        yellow: 'bg-yellow-500/20 text-yellow-400',
        red: 'bg-red-500/20 text-red-400'
    }

    return colorClasses[props.color]
})

const valueClasses = computed(() => {
    const colorClasses = {
        blue: 'text-blue-300',
        green: 'text-green-300',
        purple: 'text-purple-300',
        yellow: 'text-yellow-300',
        red: 'text-red-300'
    }

    return colorClasses[props.color]
})

const progressClasses = computed(() => {
    const colorClasses = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        purple: 'bg-purple-500',
        yellow: 'bg-yellow-500',
        red: 'bg-red-500'
    }

    return colorClasses[props.color]
})
</script>

<style scoped>
.stat-card {
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
}

.stat-card:hover {
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}
</style>