<template>
    <div class="building-card group relative" :class="[
        'p-4 rounded-lg border transition-all duration-200 cursor-pointer',
        'hover:transform hover:scale-105',
        cardClasses
    ]" @click="handleSelect">
        <!-- Building Count Badge -->
        <div v-if="count > 0"
            class="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center z-10">
            {{ count }}
        </div>

        <!-- Header -->
        <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                    :class="iconContainerClasses">
                    <BuildingIcon :building-type="building.key" :size="28" />
                </div>

                <div>
                    <h3 class="font-semibold text-white text-lg">
                        {{ building.name }}
                    </h3>
                    <p class="text-xs text-gray-400">
                        {{ count }} sur la carte
                    </p>
                </div>
            </div>

            <!-- Affordability indicator -->
            <div class="w-3 h-3 rounded-full" :class="canAfford ? 'bg-green-400' : 'bg-red-400'"
                :title="canAfford ? 'Ressources suffisantes' : 'Ressources insuffisantes'" />
        </div>

        <!-- Description -->
        <p class="text-sm text-gray-300 mb-4 leading-relaxed">
            {{ building.description }}
        </p>

        <!-- Cost -->
        <div class="space-y-2">
            <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Coût de construction
            </h4>
            <div class="flex flex-wrap gap-2">
                <div v-for="(amount, resource) in building.cost" :key="resource"
                    class="flex items-center gap-1 px-2 py-1 rounded text-xs"
                    :class="getCostItemClasses(resource, amount)">
                    <ResourceIcon :resource-type="resource as ResourceType" :size="14" />
                    <span class="font-bold">{{ amount }}</span>
                </div>
            </div>
        </div>

        <!-- Selection overlay -->
        <div v-if="isSelected"
            class="absolute inset-0 bg-blue-600/20 border-2 border-blue-400 rounded-lg pointer-events-none" />

        <!-- Hover effect -->
        <div
            class="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg pointer-events-none" />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { BuildingConfig, ResourceType } from '@/game/types'
import BuildingIcon from './BuildingIcon.vue'
import ResourceIcon from './ResourceIcon.vue'

interface Props {
    building: BuildingConfig
    count: number
    canAfford: boolean
}

interface Emits {
    (e: 'select', buildingKey: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const gameStore = useGameStore()

// Computed
const isSelected = computed(() => {
    return gameStore.state?.selectedBuilding === props.building.key
})

const cardClasses = computed(() => {
    if (!props.canAfford) {
        return 'bg-gray-800/30 border-gray-600/30 opacity-60 cursor-not-allowed'
    }

    if (isSelected.value) {
        return 'bg-blue-600/20 border-blue-400/50 shadow-lg shadow-blue-400/20'
    }

    return 'bg-gray-800/50 border-gray-600/50 hover:bg-gray-700/50 hover:border-gray-500/50 hover:shadow-lg'
})

const iconContainerClasses = computed(() => {
    if (!props.canAfford) {
        return 'bg-gray-700/30'
    }

    if (isSelected.value) {
        return 'bg-blue-500/20'
    }

    return 'bg-gray-600/30 group-hover:bg-gray-500/30'
})

const getCostItemClasses = (resource: string, amount: number) => {
    const currentAmount = gameStore.state?.resources?.get(resource as ResourceType) || 0
    const canAffordThis = currentAmount >= amount

    return {
        'bg-green-600/20 border border-green-500/30 text-green-300': canAffordThis,
        'bg-red-600/20 border border-red-500/30 text-red-300': !canAffordThis
    }
}

// Methods
const handleSelect = () => {
    if (props.canAfford) {
        emit('select', props.building.key)
    }
}
</script>

<style scoped>
.building-card {
    background-image: radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0);
    background-size: 20px 20px;
}

.building-card:hover {
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}
</style>