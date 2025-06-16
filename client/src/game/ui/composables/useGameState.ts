import { ref, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { ResourceType } from '@/game/types/ResourceSystemTypes'
import { ResourceManager } from '@/game/services/ResourceManager'

export interface GameInstance extends Phaser.Game {}

export const useGameState = () => {
  const gameStore = useGameStore()
  const gameInstance = ref<GameInstance | null>(null)
  const isInitialized = ref(false)

  // Game integration methods
  const initializeGameIntegration = (game: Phaser.Game) => {
    gameInstance.value = game
    isInitialized.value = true

    // Set up event listeners for game state synchronization
    setupGameEventListeners()

    // Initialize ResourceManager integration
    const resourceManager = ResourceManager.getInstance()

    // Notify that the game is ready
    gameStore.setGameLoaded(true)

    // Emit ready event
    window.dispatchEvent(new CustomEvent('game:ready', {
      detail: {
        resourceManager,
        gameInstance: game
      }
    }))
  }

  const setupGameEventListeners = () => {
    if (!gameInstance.value) {
      console.warn('Game instance not available for event setup')
      return
    }

    // Wait for the main scene to be available
    const waitForMainScene = () => {
      const mainScene = gameInstance.value?.scene?.getScene('MainScene')
      if (!mainScene) {
        console.log('MainScene not ready, retrying...')
        setTimeout(waitForMainScene, 100)
        return
      }

      console.log('MainScene found, setting up event listeners')

      // Listen for resource updates from the game - NOW USING RESOURCEMANAGER
      const handleResourceUpdate = (type: ResourceType, amount: number) => {
        const resourceManager = ResourceManager.getInstance()
        const current = resourceManager.getResource(type)
        if (current !== amount) {
          if (amount > current) {
            resourceManager.addResource(type, amount - current, 'game_sync')
          } else {
            resourceManager.removeResource(type, current - amount, 'game_sync')
          }
        }
      }

      // Listen for building placement
      const handleBuildingPlaced = (building: any) => {
        gameStore.addBuilding(building)
        
        // Emit event for notifications
        window.dispatchEvent(new CustomEvent('game:buildingPlaced', {
          detail: { building }
        }))
      }

      // Listen for building destruction
      const handleBuildingDestroyed = (building: any) => {
        gameStore.removeBuilding(building)
        
        window.dispatchEvent(new CustomEvent('game:buildingDestroyed', {
          detail: { building }
        }))
      }

      // Listen for worker creation
      const handleWorkerCreated = (event: CustomEvent) => {
        const { worker } = event.detail
        gameStore.addWorker(worker)
        
        window.dispatchEvent(new CustomEvent('game:workerCreated', {
          detail: { worker }
        }))
      }

      // Listen for worker removal
      const handleWorkerRemoved = (worker: any) => {
        gameStore.removeWorker(worker)
        
        window.dispatchEvent(new CustomEvent('game:workerRemoved', {
          detail: { worker }
        }))
      }

      // Set up event handlers on the main scene
      try {
        mainScene.events.on('resourceUpdate', handleResourceUpdate)
        mainScene.events.on('buildingPlaced', handleBuildingPlaced)
        mainScene.events.on('buildingDestroyed', handleBuildingDestroyed)
        mainScene.events.on('workerCreated', handleWorkerCreated)
        mainScene.events.on('workerRemoved', handleWorkerRemoved)
        
        console.log('Event listeners successfully attached to MainScene')
      } catch (error) {
        console.error('Error setting up event listeners:', error)
      }
    }

    // Start waiting for the main scene
    waitForMainScene()
  }

  // Game command methods
  const emitGameCommand = (command: string, data?: any) => {
    if (!gameInstance.value) {
      console.warn('Game instance not available for command:', command)
      return
    }

    console.log(`Emitting game command: ${command}`, data)
    window.dispatchEvent(new CustomEvent(`game:${command}`, {
      detail: data
    }))
  }

  const selectBuilding = (buildingType: string) => {
    gameStore.selectBuilding(buildingType)
    emitGameCommand('selectBuilding', buildingType)
  }

  const clearBuildings = () => {
    gameStore.clearBuildings()
    emitGameCommand('clearBuildings')
  }

  const createWorker = (workerType: string, positionHint?: string | { x: number, y: number }) => {
    console.log('createWorker called:', workerType, 'at position:', positionHint)
    const effectivePositionHint = positionHint || 'near_player'
    emitGameCommand('createWorker', { type: workerType, positionHint: effectivePositionHint })
  }

  const showBuildingInfo = (building: any) => {
    gameStore.showBuildingInfo(building)
  }

  const hideBuildingInfo = () => {
    gameStore.hideBuildingInfo()
  }

  // Resource management
  const addResource = (type: ResourceType, amount: number) => {
    const added = gameStore.addResource(type, amount)
    
    // Sync with game
    emitGameCommand('addResource', { type, amount: added })
    
    // Emit update event
    window.dispatchEvent(new CustomEvent('game:resourceUpdate', {
      detail: { type, amount: gameStore.state.value.resources.get(type) || 0 }
    }))
    
    return added
  }

  const removeResource = (type: ResourceType, amount: number) => {
    const removed = gameStore.removeResource(type, amount)
    
    // Sync with game
    emitGameCommand('removeResource', { type, amount: removed })
    
    // Emit update event
    window.dispatchEvent(new CustomEvent('game:resourceUpdate', {
      detail: { type, amount: gameStore.state.value.resources.get(type) || 0 }
    }))
    
    return removed
  }

  // External event handlers
  const setupExternalEventListeners = () => {
    // Listen for UI commands
    const handleSelectBuilding = (event: CustomEvent) => {
      selectBuilding(event.detail)
    }

    const handleClearBuildings = () => {
      clearBuildings()
    }

    const handleCreateWorker = (event: CustomEvent) => {
      console.log('handleCreateWorker called:', event.detail)
      const { type, positionHint } = event.detail
      createWorker(type, positionHint)
    }

    const handleRequestCreateWorker = (event: CustomEvent) => {
      console.log('handleRequestCreateWorker called:', event.detail)
      const { type, positionHint } = event.detail
      const effectivePositionHint = positionHint || 'near_player'

      // Émettre directement vers MainScene
      emitGameCommand('createWorkerCommand', { type, positionHint: effectivePositionHint })
    }

    const handleBuildingPlacementComplete = (event: CustomEvent) => {
      const { buildingType } = event.detail
      // Déselectionner le bâtiment après placement
      gameStore.selectBuilding(null)

      console.log('Building placement completed:', buildingType)
    }

    // Listen for building placement cancellation
    const handleBuildingPlacementCancelled = () => {
      // Déselectionner le bâtiment si l'annulation vient du jeu
      gameStore.selectBuilding(null)

      console.log('Building placement cancelled from game')
    }

    // Listen for resource updates from the game
    const handleResourceUpdate = (event: CustomEvent) => {
      const { type, amount } = event.detail
      gameStore.updateResource(type, amount)

      console.log(`Resource updated: ${type} = ${amount}`)
    }

    // Add event listeners
    window.addEventListener('game:selectBuilding', handleSelectBuilding)
    window.addEventListener('game:clearBuildings', handleClearBuildings)
    window.addEventListener('game:requestCreateWorker', handleRequestCreateWorker)
    window.addEventListener('game:resourceUpdate', handleResourceUpdate)
    window.addEventListener('game:buildingPlacementComplete', handleBuildingPlacementComplete)
    window.addEventListener('game:buildingPlacementCancelled', handleBuildingPlacementCancelled)

    return () => {
      window.removeEventListener('game:selectBuilding', handleSelectBuilding)
      window.removeEventListener('game:clearBuildings', handleClearBuildings)
      window.removeEventListener('game:requestCreateWorker', handleRequestCreateWorker)
      window.removeEventListener('game:resourceUpdate', handleResourceUpdate)
      window.removeEventListener('game:buildingPlacementComplete', handleBuildingPlacementComplete)
      window.removeEventListener('game:buildingPlacementCancelled', handleBuildingPlacementCancelled)
    }
  }

  // Lifecycle
  onMounted(() => {
    const cleanup = setupExternalEventListeners()
    
    onUnmounted(() => {
      cleanup()
      isInitialized.value = false
      gameInstance.value = null
    })
  })

  return {
    // State
    gameInstance,
    isInitialized,
    gameStore,

    // Methods
    initializeGameIntegration,
    selectBuilding,
    clearBuildings,
    createWorker,
    showBuildingInfo,
    hideBuildingInfo,
    addResource,
    removeResource,
    emitGameCommand
  }
}