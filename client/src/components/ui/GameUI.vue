<template>
    <div class="game-ui-overlay">
        <!-- Resource Display -->
        <ResourceDisplay :show-resource-list="true" :max-visible-resources="8" />

        <!-- Building UI -->
        <BuildingUI />

        <!-- Building FAB Button -->
        <BuildingFabButton />

        <!-- Building Info Modal -->
        <BuildingInfoModal />

        <!-- Notification System -->
        <NotificationSystem />

        <!-- Debug Panel (Development only) -->
        <DebugPanel v-if="isDevelopment" />
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import ResourceDisplay from './ResourceDisplay.vue'
import BuildingUI from './BuildingUI.vue'
import BuildingFabButton from './BuildingFabButton.vue'
import BuildingInfoModal from './BuildingInfoModal.vue'
import NotificationSystem from './NotificationSystem.vue'
import DebugPanel from './DebugPanel.vue'

const gameStore = useGameStore()

// Environment check
const isDevelopment = import.meta.env.DEV

// Game event handlers
const handleGameEvents = () => {
    // Resource updates
    const handleResourceUpdate = (event: CustomEvent) => {
        const { type, amount } = event.detail
        gameStore.updateResource(type, amount)
    }

    // Building events
    const handleBuildingPlaced = (event: CustomEvent) => {
        const { building } = event.detail
        gameStore.addBuilding(building)
    }

    const handleBuildingDestroyed = (event: CustomEvent) => {
        const { building } = event.detail
        gameStore.removeBuilding(building)
    }

    const handleBuildingInfo = (event: CustomEvent) => {
        const { building } = event.detail
        gameStore.showBuildingInfo(building)
    }

    // Worker events
    const handleWorkerCreated = (event: CustomEvent) => {
        const { worker } = event.detail
        gameStore.addWorker(worker)
    }

    const handleWorkerRemoved = (event: CustomEvent) => {
        const { worker } = event.detail
        gameStore.removeWorker(worker)
    }

    // Game ready
    const handleGameReady = () => {
        gameStore.setGameLoaded(true)
    }

    // Add event listeners
    window.addEventListener('game:resourceUpdate', handleResourceUpdate)
    window.addEventListener('game:buildingPlaced', handleBuildingPlaced)
    window.addEventListener('game:buildingDestroyed', handleBuildingDestroyed)
    window.addEventListener('game:buildingInfo', handleBuildingInfo)
    window.addEventListener('game:workerCreated', handleWorkerCreated)
    window.addEventListener('game:workerRemoved', handleWorkerRemoved)
    window.addEventListener('game:ready', handleGameReady)

    // Return cleanup function
    return () => {
        window.removeEventListener('game:resourceUpdate', handleResourceUpdate)
        window.removeEventListener('game:buildingPlaced', handleBuildingPlaced)
        window.removeEventListener('game:buildingDestroyed', handleBuildingDestroyed)
        window.removeEventListener('game:buildingInfo', handleBuildingInfo)
        window.removeEventListener('game:workerCreated', handleWorkerCreated)
        window.removeEventListener('game:workerRemoved', handleWorkerRemoved)
        window.removeEventListener('game:ready', handleGameReady)
    }
}

// Lifecycle
onMounted(() => {
    const cleanup = handleGameEvents()

    onUnmounted(() => {
        cleanup()
    })
})
</script>

<style scoped>
.game-ui-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1000;
}

.game-ui-overlay>* {
    pointer-events: auto;
}
</style>