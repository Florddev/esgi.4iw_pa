<!-- src/components/ui/BuildingInfoModal.vue -->
<template>
    <!-- Modal Overlay -->
    <Teleport to="body">
        <Transition name="modal-fade">
            <div v-if="isVisible" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
                @click="handleOverlayClick">
                <!-- Modal Content -->
                <div class="modal-content relative w-full max-w-md mx-auto" @click.stop>
                    <div class="bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700/50 shadow-2xl">
                        <!-- Header -->
                        <div class="flex items-center justify-between p-6 border-b border-gray-700/50">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                                    <BuildingIcon :building-type="buildingData?.type || 'unknown'" :size="20" />
                                </div>
                                <h2 class="text-xl font-bold text-white">
                                    {{ buildingDisplayName }}
                                </h2>
                            </div>

                            <button
                                class="w-8 h-8 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                                @click="handleClose">
                                <ActionIcon icon="close" :size="16" />
                            </button>
                        </div>

                        <!-- Body -->
                        <div class="p-6 space-y-6">
                            <!-- Building Info -->
                            <div class="space-y-3">
                                <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                                    Informations
                                </h3>
                                <div class="bg-gray-800/50 rounded-lg p-4 space-y-2">
                                    <div class="flex justify-between text-sm">
                                        <span class="text-gray-400">Type:</span>
                                        <span class="text-white">{{ buildingDisplayName }}</span>
                                    </div>
                                    <div class="flex justify-between text-sm">
                                        <span class="text-gray-400">Position:</span>
                                        <span class="text-white">{{ positionText }}</span>
                                    </div>
                                </div>

                                <!-- Description -->
                                <p class="text-gray-300 text-sm leading-relaxed">
                                    {{ buildingDescription }}
                                </p>
                            </div>

                            <!-- Resources -->
                            <div v-if="hasResources" class="space-y-3">
                                <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                                    Ressources stockées
                                </h3>
                                <div class="space-y-2">
                                    <ResourceBar v-for="[resourceType, amount] in storedResources" :key="resourceType"
                                        :resource-type="resourceType" :current="amount"
                                        :max="getResourceCapacity(resourceType)" :width="280" />
                                </div>
                            </div>

                            <!-- Actions -->
                            <div v-if="availableActions.length > 0" class="space-y-3">
                                <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                                    Actions
                                </h3>
                                <div class="flex gap-2">
                                    <ActionButton v-for="action in availableActions" :key="action.key"
                                        :icon="action.icon" :label="action.label" :variant="action.variant"
                                        :disabled="action.disabled" @click="handleAction(action.key)" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { TiledBuilding } from '@/game/objects/TiledBuilding'
import type { ResourceType } from '@/game/types'
import BuildingIcon from './BuildingIcon.vue'
import ActionIcon from './ActionIcon.vue'
import ActionButton from './ActionButton.vue'
import ResourceBar from './ResourceBar.vue'

interface BuildingAction {
    key: string
    label: string
    icon: string
    variant: 'primary' | 'secondary' | 'danger' | 'success'
    disabled?: boolean
}

const gameStore = useGameStore()

// Computed
const isVisible = computed(() => gameStore.state?.showBuildingInfo || false)

const buildingData = computed(() => gameStore.state?.currentBuildingInfo || null)

const buildingDisplayName = computed(() => {
    const type = buildingData.value?.getType()
    const names: Record<string, string> = {
        'house': 'Maison',
        'sawmill': 'Scierie',
        'mine': 'Mine',
        'farm': 'Ferme'
    }
    return type ? (names[type] || type) : 'Bâtiment'
})

const positionText = computed(() => {
    if (!buildingData.value) return 'Inconnue'

    const pos = buildingData.value.getPosition()
    const tileX = Math.floor(pos.x / 16)
    const tileY = Math.floor(pos.y / 16)
    return `(${tileX}, ${tileY})`
})

const buildingDescription = computed(() => {
    const type = buildingData.value?.getType()
    const descriptions: Record<string, string> = {
        'house': 'La maison peut abriter des ouvriers et améliorer leur efficacité.',
        'sawmill': 'La scierie traite le bois brut et peut stocker les ressources récoltées. Les bûcherons peuvent y déposer leur bois automatiquement.',
        'mine': 'La mine extrait pierre et métaux du sous-sol.',
        'farm': 'La ferme produit de la nourriture pour nourrir vos ouvriers.'
    }
    return type ? (descriptions[type] || 'Bâtiment fonctionnel pour votre colonie.') : ''
})

const storedResources = computed(() => {
    if (!buildingData.value) return []

    const resources = buildingData.value.getAllBuildingResources()
    return Array.from(resources.entries()).filter(([_, amount]) => amount > 0)
})

const hasResources = computed(() => storedResources.value.length > 0)

const availableActions = computed((): BuildingAction[] => {
    if (!buildingData.value) return []

    const actions: BuildingAction[] = []
    const type = buildingData.value.getType()

    // Collect resources action for storage buildings
    if (type === 'sawmill' && hasResources.value) {
        const hasAnyResources = storedResources.value.some(([_, amount]) => amount > 0)
        actions.push({
            key: 'collect',
            label: 'Collecter tout',
            icon: 'plus',
            variant: 'success',
            disabled: !hasAnyResources
        })
    }

    return actions
})

// Methods
const getResourceCapacity = (resourceType: ResourceType): number => {
    if (!buildingData.value) return 0
    return buildingData.value.getBuildingResourceCapacity(resourceType)
}

const handleClose = () => {
    gameStore.hideBuildingInfo()
}

const handleOverlayClick = () => {
    handleClose()
}

const handleAction = (actionKey: string) => {
    if (!buildingData.value) return

    switch (actionKey) {
        case 'collect':
            collectAllResources()
            break
    }
}

const collectAllResources = () => {
    if (!buildingData.value) return

    const building = buildingData.value
    let totalCollected = 0

    storedResources.value.forEach(([resourceType, amount]) => {
        if (amount > 0) {
            const removed = building.removeResourceFromBuilding(resourceType, amount)
            gameStore.addResource(resourceType, removed)
            totalCollected += removed
        }
    })

    if (totalCollected > 0) {
        // Emit event to update the main scene
        window.dispatchEvent(new CustomEvent('game:resourcesCollected', {
            detail: { building, totalCollected }
        }))
    }
}

// Keyboard handling
watch(isVisible, (visible) => {
    if (visible) {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose()
            }
        }

        document.addEventListener('keydown', handleEscape)

        return () => {
            document.removeEventListener('keydown', handleEscape)
        }
    }
})
</script>

<style scoped>
.modal-overlay {
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
}

/* Modal transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
    transition: all 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
    opacity: 0;
}

.modal-fade-enter-from .modal-content,
.modal-fade-leave-to .modal-content {
    transform: scale(0.9) translateY(-20px);
}

.modal-content {
    transition: transform 0.3s ease;
}
</style>