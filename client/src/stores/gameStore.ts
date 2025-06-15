import { defineStore } from 'pinia'
import { ref, computed, readonly, type Ref } from 'vue'
import { ResourceType, type ResourceStack } from '@/game/types'
import { BuildingRegistry } from '@/game/services/BuildingRegistry'
import type { TiledBuilding } from '@/game/objects/TiledBuilding'
import type { Worker } from '@/game/objects/workers/Worker'

interface GameState {
  isGameLoaded: boolean
  selectedBuilding: string | null
  hoveredBuilding: TiledBuilding | null
  resources: Map<ResourceType, number>
  buildings: TiledBuilding[]
  workers: Worker[]
  showBuildingPreview: boolean
  showBuildingInfo: boolean
  currentBuildingInfo: TiledBuilding | null
}

export const useGameStore = defineStore('game', () => {
  // State
  const state: Ref<GameState> = ref({
    isGameLoaded: false,
    selectedBuilding: null,
    hoveredBuilding: null,
    resources: new Map(),
    buildings: [],
    workers: [],
    showBuildingPreview: false,
    showBuildingInfo: false,
    currentBuildingInfo: null
  })

  // Getters (computed)
  const isGameReady = computed(() => state.value.isGameLoaded)

  const resourceList = computed((): ResourceStack[] => {
    return Array.from(state.value.resources.entries())
      .filter(([_, amount]) => amount > 0)
      .map(([type, amount]) => ({ type, amount }))
  })

  const totalResources = computed(() => {
    return Array.from(state.value.resources.values())
      .reduce((sum, amount) => sum + amount, 0)
  })

  const buildingCount = computed(() => state.value.buildings.length)

  const workerCount = computed(() => state.value.workers.length)

  const canAffordBuilding = computed(() => (buildingType: string, cost?: Record<string, number>) => {
    const buildingRegistry = BuildingRegistry.getInstance()
    return buildingRegistry.canAffordBuilding(buildingType, state.value.resources)
  })

  // Actions
  const setGameLoaded = (loaded: boolean) => {
    state.value.isGameLoaded = loaded

    // Initialiser les ressources de base quand le jeu est chargé
    if (loaded && state.value.resources.size === 0) {
      // Donner quelques ressources de départ pour tester
      state.value.resources.set(ResourceType.WOOD, 25)
      state.value.resources.set(ResourceType.STONE, 10)
      state.value.resources.set(ResourceType.FOOD, 5)
    }
  }

  const updateResource = (type: ResourceType, amount: number) => {
    state.value.resources.set(type, Math.max(0, amount))
  }

  const addResource = (type: ResourceType, amount: number): number => {
    const current = state.value.resources.get(type) || 0
    const newAmount = current + amount
    state.value.resources.set(type, newAmount)
    return amount
  }

  const removeResource = (type: ResourceType, amount: number): number => {
    const current = state.value.resources.get(type) || 0
    const removed = Math.min(amount, current)
    state.value.resources.set(type, current - removed)
    return removed
  }

  const selectBuilding = (buildingType: string | null) => {
    state.value.selectedBuilding = buildingType
    state.value.showBuildingPreview = buildingType !== null
  }

  const showBuildingInfo = (building: TiledBuilding) => {
    state.value.currentBuildingInfo = building
    state.value.showBuildingInfo = true
  }

  const hideBuildingInfo = () => {
    state.value.currentBuildingInfo = null
    state.value.showBuildingInfo = false
  }

  const addBuilding = (building: TiledBuilding) => {
    state.value.buildings.push(building)
  }

  const removeBuilding = (building: TiledBuilding) => {
    const index = state.value.buildings.indexOf(building)
    if (index !== -1) {
      state.value.buildings.splice(index, 1)
    }
  }

  const clearBuildings = () => {
    state.value.buildings = []
  }

  const addWorker = (worker: Worker) => {
    state.value.workers.push(worker)
  }

  const removeWorker = (worker: Worker) => {
    const index = state.value.workers.indexOf(worker)
    if (index !== -1) {
      state.value.workers.splice(index, 1)
    }
  }

  // Reset entire state
  const resetGameState = () => {
    state.value = {
      isGameLoaded: false,
      selectedBuilding: null,
      hoveredBuilding: null,
      resources: new Map(),
      buildings: [],
      workers: [],
      showBuildingPreview: false,
      showBuildingInfo: false,
      currentBuildingInfo: null
    }
  }

  return {
    // State
    state: readonly(state),

    // Getters
    isGameReady,
    resourceList,
    totalResources,
    buildingCount,
    workerCount,
    canAffordBuilding,

    // Actions
    setGameLoaded,
    updateResource,
    addResource,
    removeResource,
    selectBuilding,
    showBuildingInfo,
    hideBuildingInfo,
    addBuilding,
    removeBuilding,
    clearBuildings,
    addWorker,
    removeWorker,
    resetGameState
  }
})