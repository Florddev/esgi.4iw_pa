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

    <!-- Debug resource info -->
    <div v-if="isDevelopment" class="fixed bottom-4 left-4 bg-black/80 text-white p-2 rounded text-xs">
      Resources: {{ totalResources }} | Updates: {{ resourceUpdateCount }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { ResourceType } from '@/game/types/ResourceSystemTypes'
import ResourceDisplay from './ResourceDisplay.vue'
import BuildingUI from './BuildingUI.vue'
import BuildingFabButton from './BuildingFabButton.vue'
import BuildingInfoModal from './BuildingInfoModal.vue'
import NotificationSystem from './NotificationSystem.vue'
import DebugPanel from './DebugPanel.vue'

const gameStore = useGameStore()

// Environment check
const isDevelopment = import.meta.env.DEV

// Debug state
const resourceUpdateCount = ref(0)
const totalResources = ref(0)

// AMÉLIORATION: Game event handlers avec logging pour debug
const handleGameEvents = () => {
  console.log('Setting up game event handlers in GameUI')

  // AMÉLIORÉ: Resource updates avec debug
  const handleResourceUpdate = (event: CustomEvent) => {
    const { type, amount, change, source } = event.detail

    console.log('GameUI received resource update:', { type, amount, change, source })

    try {
      gameStore.updateResource(type as ResourceType, amount)
      resourceUpdateCount.value++
      totalResources.value = gameStore.totalResources

      console.log('Resource updated in store:', type, amount)
    } catch (error) {
      console.error('Error updating resource in GameUI:', error)
    }
  }

  // NOUVEAU: Gestion spéciale des récoltes de ressources
  const handleResourceHarvested = (event: CustomEvent) => {
    const { type, amount, source } = event.detail

    console.log('Resource harvested event:', { type, amount, source })

    // Ne pas dupliquer - le ResourceManager gère déjà l'ajout
    // Juste forcer une mise à jour de l'UI
    gameStore.forceResourceUpdate()

    // Notification visuelle
    window.dispatchEvent(new CustomEvent('game:notification', {
      detail: {
        type: 'success',
        title: 'Ressource récoltée',
        message: `+${amount} ${getResourceName(type)}`,
        duration: 2000
      }
    }))
  }

  // NOUVEAU: Debug des ressources
  const handleResourceDebug = (event: CustomEvent) => {
    if (isDevelopment) {
      const { totalResources: total, snapshot } = event.detail
      console.log('Resource debug update:', total, snapshot)
      totalResources.value = total
    }
  }

  // Building events
  const handleBuildingPlaced = (event: CustomEvent) => {
    const { building, cost } = event.detail

    console.log('Building placed event:', building.getType(), cost)

    gameStore.addBuilding(building)

    // Forcer la mise à jour des ressources après placement
    gameStore.forceResourceUpdate()
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
  const handleGameReady = (event: CustomEvent) => {
    console.log('Game ready event received:', event.detail)

    gameStore.setGameLoaded(true)

    // Force une synchronisation initiale
    if (event.detail.allResources) {
      Object.entries(event.detail.allResources).forEach(([type, amount]) => {
        gameStore.updateResource(type as ResourceType, amount as number)
      })
    }

    totalResources.value = event.detail.totalResources || 0
  }

  // NOUVEAU: Écouter les événements de placement de bâtiment
  const handleBuildingPlacementComplete = (event: CustomEvent) => {
    const { buildingType, resourcesDeducted } = event.detail

    console.log('Building placement completed:', buildingType, resourcesDeducted)

    // Forcer la mise à jour après déduction des ressources
    gameStore.forceResourceUpdate()

    // Notification
    window.dispatchEvent(new CustomEvent('game:notification', {
      detail: {
        type: 'success',
        title: 'Bâtiment construit',
        message: `${getBuildingName(buildingType)} placé avec succès`,
        duration: 3000
      }
    }))
  }

  const handleBuildingPlacementCancelled = () => {
    console.log('Building placement cancelled')
    gameStore.selectBuilding(null)
  }

  // Fonction helper pour obtenir le nom d'une ressource
  const getResourceName = (type: string): string => {
    try {
      const resourceManager = gameStore.getResourceManager()
      return resourceManager?.getName(type as ResourceType) || type
    } catch (error) {
      return type
    }
  }

  // Fonction helper pour obtenir le nom d'un bâtiment
  const getBuildingName = (type: string): string => {
    try {
      const buildingRegistry = gameStore.getBuildingRegistry()
      return buildingRegistry?.getBuildingName(type) || type
    } catch (error) {
      return type
    }
  }

  // Add event listeners
  console.log('Adding event listeners...')

  window.addEventListener('game:resourceUpdate', handleResourceUpdate)
  window.addEventListener('game:resourceHarvested', handleResourceHarvested)
  window.addEventListener('game:resourceDebug', handleResourceDebug)
  window.addEventListener('game:buildingPlaced', handleBuildingPlaced)
  window.addEventListener('game:buildingDestroyed', handleBuildingDestroyed)
  window.addEventListener('game:buildingInfo', handleBuildingInfo)
  window.addEventListener('game:buildingPlacementComplete', handleBuildingPlacementComplete)
  window.addEventListener('game:buildingPlacementCancelled', handleBuildingPlacementCancelled)
  window.addEventListener('game:workerCreated', handleWorkerCreated)
  window.addEventListener('game:workerRemoved', handleWorkerRemoved)
  window.addEventListener('game:ready', handleGameReady)

  console.log('Event listeners added successfully')

  // Return cleanup function
  return () => {
    console.log('Cleaning up event listeners...')

    window.removeEventListener('game:resourceUpdate', handleResourceUpdate)
    window.removeEventListener('game:resourceHarvested', handleResourceHarvested)
    window.removeEventListener('game:resourceDebug', handleResourceDebug)
    window.removeEventListener('game:buildingPlaced', handleBuildingPlaced)
    window.removeEventListener('game:buildingDestroyed', handleBuildingDestroyed)
    window.removeEventListener('game:buildingInfo', handleBuildingInfo)
    window.removeEventListener('game:buildingPlacementComplete', handleBuildingPlacementComplete)
    window.removeEventListener('game:buildingPlacementCancelled', handleBuildingPlacementCancelled)
    window.removeEventListener('game:workerCreated', handleWorkerCreated)
    window.removeEventListener('game:workerRemoved', handleWorkerRemoved)
    window.removeEventListener('game:ready', handleGameReady)

    console.log('Event listeners cleaned up')
  }
}

// NOUVEAU: Watchers pour surveiller les changements du store
const setupStoreWatchers = () => {
  // Surveiller les changements de totalResources
  watch(() => gameStore.totalResources, (newTotal) => {
    totalResources.value = newTotal
    console.log('Store totalResources changed:', newTotal)
  }, { immediate: true })

  // Surveiller les changements de resourceList
  watch(() => gameStore.resourceList, (newList) => {
    console.log('Store resourceList changed:', newList.length, 'resources')
    resourceUpdateCount.value++
  }, { deep: true, immediate: true })

  // Surveiller les changements de l'état de jeu
  watch(() => gameStore.isGameReady, (isReady) => {
    console.log('Game ready state changed:', isReady)
    if (isReady) {
      // Force une synchronisation quand le jeu est prêt
      gameStore.forceResourceUpdate()
    }
  })
}

// NOUVEAU: Log périodique pour debug
const setupDebugLogging = () => {
  if (!isDevelopment) return

  setInterval(() => {
    const currentTotal = gameStore.totalResources
    const resourceCount = gameStore.resourceList.length

    console.log('GameUI Debug - Total resources:', currentTotal, 'Resource types:', resourceCount)

    // Log des ressources individuelles
    gameStore.resourceList.forEach(resource => {
      console.log(`  ${resource.type}: ${resource.amount}`)
    })
  }, 10000) // Toutes les 10 secondes
}

// Lifecycle
onMounted(() => {
  console.log('GameUI mounted, setting up event handlers and watchers')

  const cleanup = handleGameEvents()
  setupStoreWatchers()

  if (isDevelopment) {
    setupDebugLogging()
  }

  onUnmounted(() => {
    console.log('GameUI unmounting, cleaning up...')
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