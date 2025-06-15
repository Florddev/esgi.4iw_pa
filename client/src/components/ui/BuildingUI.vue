<template>
    <div class="building-ui-container">
        <!-- Building Selection Panel -->
        <div class="fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-md border-t border-gray-700/50"
            :class="selectedBuilding ? 'border-blue-500/50' : ''">
            <div class="container mx-auto px-4 py-3">
                <!-- Selection Indicator -->
                <div v-if="selectedBuilding" class="mb-3 p-2 bg-blue-600/20 border border-blue-500/50 rounded-lg">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 bg-blue-500 rounded-full animate-pulse"></div>
                            <span class="text-blue-300 font-medium">
                                Mode construction: {{ getBuildingName(selectedBuilding) }}
                            </span>
                        </div>
                        <span class="text-xs text-blue-400">
                            Cliquez sur la carte pour placer le bâtiment
                        </span>
                    </div>
                </div>

                <div class="flex items-center justify-between">
                    <!-- Building Buttons -->
                    <div class="flex items-center gap-3">
                        <BuildingButton v-for="building in availableBuildings" :key="building.key" :building="building"
                            :selected="selectedBuilding === building.key" :can-afford="canAffordBuilding(building)"
                            @select="handleBuildingSelect" />
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex items-center gap-2">
                        <!-- Cancel Building Selection -->
                        <ActionButton v-if="selectedBuilding" icon="close" label="Annuler" variant="secondary"
                            @click="cancelBuildingSelection" />

                        <!-- Worker Creation -->
                        <ActionButton icon="worker" label="Bûcheron" variant="primary" @click="createLumberjack" />

                        <!-- Clear Buildings -->
                        <ActionButton icon="trash" label="Effacer" variant="danger" @click="handleClearBuildings" />
                    </div>
                </div>
            </div>
        </div>

        <!-- Error Messages -->
        <Transition name="error-fade">
            <div v-if="errorMessage"
                class="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg">
                {{ errorMessage }}
            </div>
        </Transition>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { BuildingRegistry } from '@/game/services/BuildingRegistry'
import type { BuildingConfig } from '@/game/types'
import BuildingButton from './BuildingButton.vue'
import ActionButton from './ActionButton.vue'

const gameStore = useGameStore()
const buildingRegistry = BuildingRegistry.getInstance()

// State
const errorMessage = ref<string>('')
const errorTimer = ref<NodeJS.Timeout | null>(null)

// Building configurations (centralisées)
const availableBuildings = computed((): readonly BuildingConfig[] => {
    return buildingRegistry.getAllBuildings()
})

// Computed
const selectedBuilding = computed(() => gameStore.state?.selectedBuilding || null)

// Methods
const canAffordBuilding = (building: BuildingConfig): boolean => {
    return gameStore.canAffordBuilding(building.key, building.cost)
}

const handleBuildingSelect = (buildingKey: string) => {
    const building = availableBuildings.find(b => b.key === buildingKey)
    if (!building) return

    if (canAffordBuilding(building)) {
        if (selectedBuilding.value === buildingKey) {
            // Deselect if already selected
            gameStore.selectBuilding(null)
        } else {
            gameStore.selectBuilding(buildingKey)
            emitGameEvent('selectBuilding', buildingKey)
        }
    } else {
        showError('Ressources insuffisantes pour ce bâtiment!')
    }
}

const createLumberjack = () => {
    emitGameEvent('createLumberjack')
}

const cancelBuildingSelection = () => {
    gameStore.selectBuilding(null)

    // Notifier le jeu pour désactiver l'aperçu
    window.dispatchEvent(new CustomEvent('game:deselectBuilding'))

    // Notification d'annulation
    window.dispatchEvent(new CustomEvent('game:notification', {
        detail: {
            type: 'info',
            title: 'Construction annulée',
            message: 'Mode construction désactivé - ressources conservées'
        }
    }))
}

const handleClearBuildings = () => {
    if (confirm('Voulez-vous vraiment supprimer tous les bâtiments ?')) {
        gameStore.clearBuildings()
        emitGameEvent('clearBuildings')
        showError('Tous les bâtiments ont été supprimés', 'success')
    }
}

const showError = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    errorMessage.value = message

    if (errorTimer.value) {
        clearTimeout(errorTimer.value)
    }

    errorTimer.value = setTimeout(() => {
        errorMessage.value = ''
    }, 3000)
}

const getBuildingName = (buildingType: string): string => {
    const building = availableBuildings.find(b => b.key === buildingType)
    return building?.name || buildingType
}

const emitGameEvent = (eventType: string, data?: any) => {
    // Emit to the game instance through window events
    window.dispatchEvent(new CustomEvent(`game:${eventType}`, {
        detail: data
    }))
}

// Lifecycle
onMounted(() => {
    // Listen for game events
    const handleGameReady = () => {
        gameStore.setGameLoaded(true)
    }

    window.addEventListener('game:ready', handleGameReady)

    return () => {
        window.removeEventListener('game:ready', handleGameReady)
        if (errorTimer.value) {
            clearTimeout(errorTimer.value)
        }
    }
})
</script>

<style scoped>
.building-ui-container {
    pointer-events: none;
}

.building-ui-container>* {
    pointer-events: auto;
}

/* Error message transitions */
.error-fade-enter-active,
.error-fade-leave-active {
    transition: all 0.3s ease;
}

.error-fade-enter-from,
.error-fade-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
}
</style>