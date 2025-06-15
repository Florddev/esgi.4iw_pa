<template>
    <button class="building-button group relative" :class="[
        'flex flex-col items-center gap-2 p-3 rounded-lg transition-all duration-200',
        'border-2 backdrop-blur-sm min-w-[80px]',
        buttonClasses
    ]" :disabled="!canAfford" @click="handleClick">
        <!-- Icon Container -->
        <div class="icon-container relative w-10 h-10 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
            :class="iconContainerClasses">
            <BuildingIcon :building-type="building.key" :size="24" />

            <!-- Disabled Overlay -->
            <div v-if="!canAfford" class="absolute inset-0 bg-black/50 rounded-lg" />
        </div>

        <!-- Building Name -->
        <span class="building-name text-xs font-medium text-center leading-tight" :class="textClasses">
            {{ building.name }}
        </span>

        <!-- Cost Display -->
        <div class="cost-display flex items-center gap-1 text-xs">
            <div v-for="(amount, resource) in building.cost" :key="resource" class="cost-item flex items-center gap-1"
                :class="getCostItemClasses(resource, amount)">
                <ResourceIcon :resource-type="resource as ResourceType" :size="12" />
                <span class="font-bold">{{ amount }}</span>
            </div>
        </div>

        <!-- Selection Indicator -->
        <div v-if="selected"
            class="selection-indicator absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />

        <!-- Tooltip -->
        <div v-if="building.description"
            class="tooltip absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
            {{ building.description }}
            <div
                class="tooltip-arrow absolute top-full left-1/2 transform -translate-x-1/2 border-2 border-transparent border-t-gray-900" />
        </div>
    </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { BuildingConfig, ResourceType } from '@/game/types'
import BuildingIcon from './BuildingIcon.vue'
import ResourceIcon from './ResourceIcon.vue'

interface Props {
    building: BuildingConfig
    selected?: boolean
    canAfford?: boolean
}

interface Emits {
    (e: 'select', buildingKey: string): void
}

const props = withDefaults(defineProps<Props>(), {
    selected: false,
    canAfford: true
})

const emit = defineEmits<Emits>()
const gameStore = useGameStore()

// Computed styles
const buttonClasses = computed(() => {
    if (!props.canAfford) {
        return 'bg-gray-800/50 border-gray-600 cursor-not-allowed opacity-60'
    }

    if (props.selected) {
        return 'bg-green-600/20 border-green-400 shadow-lg shadow-green-400/20'
    }

    return 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50 hover:border-gray-500 hover:shadow-lg'
})

const iconContainerClasses = computed(() => {
    if (!props.canAfford) {
        return 'bg-gray-700/50'
    }

    if (props.selected) {
        return 'bg-green-500/20'
    }

    return 'bg-gray-600/50 group-hover:bg-gray-500/50'
})

const textClasses = computed(() => {
    if (!props.canAfford) {
        return 'text-gray-500'
    }

    if (props.selected) {
        return 'text-green-300'
    }

    return 'text-gray-200 group-hover:text-white'
})

const getCostItemClasses = (resource: string, amount: number) => {
    const currentAmount = gameStore.state?.resources?.get(resource as ResourceType) || 0
    const canAffordThis = currentAmount >= amount

    return {
        'text-green-400': canAffordThis,
        'text-red-400': !canAffordThis,
        'font-bold': true
    }
}

// Methods
const handleClick = () => {
    if (props.canAfford) {
        emit('select', props.building.key)
    }
}
</script>

<style scoped>
.building-button {
    user-select: none;
}

.tooltip-arrow {
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2));
}

.selection-indicator {
    animation: pulse 2s infinite;
}

@keyframes pulse {

    0%,
    100% {
        transform: scale(1);
        opacity: 1;
    }

    50% {
        transform: scale(1.1);
        opacity: 0.8;
    }
}
</style>