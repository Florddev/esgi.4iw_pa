import { defineStore } from 'pinia';
import { ref, computed, readonly, type Ref, watch, nextTick } from 'vue';
import { ResourceType, type ResourceStack } from '@/game/types/ResourceSystemTypes';
import { ResourceManager } from '@/game/services/ResourceManager';
import { BuildingRegistry } from '@/game/services/BuildingRegistry';
import type { TiledBuilding } from '@/game/objects/TiledBuilding';
import type { Worker } from '@/game/objects/workers/Worker';

interface GameState {
  isGameLoaded: boolean;
  selectedBuilding: string | null;
  hoveredBuilding: TiledBuilding | null;
  buildings: TiledBuilding[];
  workers: Worker[];
  showBuildingPreview: boolean;
  showBuildingInfo: boolean;
  currentBuildingInfo: TiledBuilding | null;
}

export const useGameStore = defineStore('game', () => {
  // State
  const state: Ref<GameState> = ref({
    isGameLoaded: false,
    selectedBuilding: null,
    hoveredBuilding: null,
    buildings: [],
    workers: [],
    showBuildingPreview: false,
    showBuildingInfo: false,
    currentBuildingInfo: null
  });

  // NOUVEAU: État réactif des ressources avec Vue ref
  const resourcesMap = ref<Map<ResourceType, number>>(new Map());

  // NOUVEAU: Trigger pour forcer la réactivité
  const resourceUpdateTrigger = ref(0);

  // Managers avec initialisation lazy
  let resourceManager: ResourceManager | null = null;
  let buildingRegistry: BuildingRegistry | null = null;

  const initializeManagers = () => {
    try {
      if (!resourceManager) {
        resourceManager = ResourceManager.getInstance();
      }
      if (!buildingRegistry) {
        buildingRegistry = BuildingRegistry.getInstance();
      }
      return true;
    } catch (error) {
      console.error('Error initializing game store managers:', error);
      return false;
    }
  };

  // AMÉLIORATION: Synchronisation bidirectionnelle avec ResourceManager
  const initializeResourceSync = () => {
    if (!initializeManagers() || !resourceManager) {
      console.error('ResourceManager not available for sync');
      return;
    }

    try {
      // NOUVEAU: Setup listener pour les changements ResourceManager
      resourceManager.getGlobalInventory().on('change', (event: any) => {
        console.log('ResourceManager change detected:', event.type, event.newAmount);

        // Mettre à jour la Map réactive Vue
        resourcesMap.value.set(event.type, event.newAmount);

        // IMPORTANT: Forcer la réactivité Vue en créant une nouvelle Map
        resourcesMap.value = new Map(resourcesMap.value);

        // Trigger supplémentaire pour les computed qui en dépendent
        resourceUpdateTrigger.value++;

        // Notifier Vue dans nextTick pour s'assurer de la réactivité
        nextTick(() => {
          console.log('Vue reactivity updated for resource:', event.type, event.newAmount);
        });
      });

      // Synchronisation initiale
      syncResourcesFromManager();

      console.log('Resource sync initialized successfully');
    } catch (error) {
      console.error('Error setting up resource sync:', error);
    }
  };

  const syncResourcesFromManager = () => {
    if (!resourceManager) return;

    try {
      const allResources = resourceManager.getGlobalInventory().getAllResources();
      resourcesMap.value = new Map(allResources);
      resourceUpdateTrigger.value++;

      console.log('Resources synced from manager:', Object.fromEntries(resourcesMap.value));
    } catch (error) {
      console.error('Error syncing resources from manager:', error);
    }
  };

  // NOUVEAU: Méthode pour forcer la mise à jour des ressources
  const forceResourceUpdate = () => {
    if (!resourceManager) return;

    try {
      syncResourcesFromManager();
      console.log('Forced resource update completed');
    } catch (error) {
      console.error('Error forcing resource update:', error);
    }
  };

  // Getters (computed) - AMÉLIORÉS pour la réactivité
  const isGameReady = computed(() => state.value.isGameLoaded);

  // AMÉLIORÉ: Liste des ressources réactive
  const resourceList = computed((): ResourceStack[] => {
    // Dépendre du trigger pour forcer la réactivité
    resourceUpdateTrigger.value;

    if (!resourceManager) return [];

    try {
      const resources = resourceManager.getGlobalInventory().getNonZeroResources();
      console.log('Computed resourceList updated:', resources.length, 'resources');
      return resources;
    } catch (error) {
      console.error('Error getting resource list:', error);
      return [];
    }
  });

  // AMÉLIORÉ: Total des ressources réactif
  const totalResources = computed(() => {
    resourceUpdateTrigger.value; // Force reactivity

    if (!resourceManager) return 0;

    try {
      const total = resourceManager.getGlobalInventory().getTotalItems();
      console.log('Computed totalResources updated:', total);
      return total;
    } catch (error) {
      console.error('Error getting total resources:', error);
      return 0;
    }
  });

  const buildingCount = computed(() => state.value.buildings.length);
  const workerCount = computed(() => state.value.workers.length);

  // AMÉLIORÉ: canAffordBuilding réactif
  const canAffordBuilding = computed(() => (buildingType: string, cost?: Record<string, number>) => {
    // Forcer la dépendance au trigger de ressources
    resourceUpdateTrigger.value;

    if (!initializeManagers() || !resourceManager || !buildingRegistry) {
      return false;
    }

    try {
      if (cost) {
        const typedCost: Partial<Record<ResourceType, number>> = {};
        Object.entries(cost).forEach(([resource, amount]) => {
          if (Object.values(ResourceType).includes(resource as ResourceType)) {
            typedCost[resource as ResourceType] = amount;
          }
        });
        const canAfford = resourceManager.canAfford(typedCost);
        console.log(`Can afford ${buildingType} (custom cost):`, canAfford);
        return canAfford;
      } else {
        const canAfford = buildingRegistry.canAffordBuilding(buildingType);
        console.log(`Can afford ${buildingType} (registry):`, canAfford);
        return canAfford;
      }
    } catch (error) {
      console.error('Error checking if can afford building:', error);
      return false;
    }
  });

  // NOUVEAU: Computed pour obtenir une ressource spécifique
  const getResourceAmount = computed(() => (type: ResourceType): number => {
    resourceUpdateTrigger.value; // Force reactivity

    if (!resourceManager) return 0;

    try {
      const amount = resourceManager.getResource(type);
      return amount;
    } catch (error) {
      console.error(`Error getting resource ${type}:`, error);
      return 0;
    }
  });

  // Getters robustes
  const getResourceManager = () => {
    if (!initializeManagers() || !resourceManager) {
      console.error('ResourceManager not available');
      return null;
    }
    return resourceManager;
  };

  const getBuildingRegistry = () => {
    if (!initializeManagers() || !buildingRegistry) {
      console.error('BuildingRegistry not available');
      return null;
    }
    return buildingRegistry;
  };

  // Actions
  const setGameLoaded = (loaded: boolean) => {
    state.value.isGameLoaded = loaded;

    if (loaded) {
      if (initializeManagers()) {
        initializeResourceSync();

        // Give some starting resources for testing
        if (resourceManager) {
          resourceManager.addResource(ResourceType.WOOD, 25, 'initial_resources');
          resourceManager.addResource(ResourceType.STONE, 10, 'initial_resources');
          resourceManager.addResource(ResourceType.FOOD, 5, 'initial_resources');
        }
      }
    }
  };

  // AMÉLIORÉ: Actions avec vérifications de réactivité
  const updateResource = (type: ResourceType, amount: number) => {
    if (!resourceManager) {
      console.error('ResourceManager not available for updateResource');
      return;
    }

    try {
      const current = resourceManager.getResource(type);
      if (current !== amount) {
        if (amount > current) {
          resourceManager.addResource(type, amount - current, 'vue_sync');
        } else {
          resourceManager.removeResource(type, current - amount, 'vue_sync');
        }
      }

      // Force la mise à jour de la réactivité Vue
      forceResourceUpdate();
    } catch (error) {
      console.error('Error updating resource:', error);
    }
  };

  const addResource = (type: ResourceType, amount: number): number => {
    if (!resourceManager) {
      console.error('ResourceManager not available for addResource');
      return 0;
    }
    try {
      const added = resourceManager.addResource(type, amount, 'game_store');
      // La réactivité se déclenche automatiquement via les événements
      return added;
    } catch (error) {
      console.error('Error adding resource:', error);
      return 0;
    }
  };

  const removeResource = (type: ResourceType, amount: number): number => {
    if (!resourceManager) {
      console.error('ResourceManager not available for removeResource');
      return 0;
    }
    try {
      const removed = resourceManager.removeResource(type, amount, 'game_store');
      // La réactivité se déclenche automatiquement via les événements
      return removed;
    } catch (error) {
      console.error('Error removing resource:', error);
      return 0;
    }
  };

  // Actions pour les bâtiments
  const purchaseBuilding = (buildingType: string): boolean => {
    if (!initializeManagers() || !buildingRegistry) {
      console.error('BuildingRegistry not available for purchase');
      return false;
    }

    try {
      const canAfford = buildingRegistry.canAffordBuilding(buildingType);
      if (!canAfford) {
        console.log(`Cannot afford building: ${buildingType}`);
        return false;
      }

      const success = buildingRegistry.deductBuildingCost(buildingType, 'building_purchase');
      if (success) {
        console.log(`Successfully purchased building: ${buildingType}`);
        // La réactivité se déclenche automatiquement
      }
      return success;
    } catch (error) {
      console.error(`Error purchasing building ${buildingType}:`, error);
      return false;
    }
  };

  const getBuildingAffordability = (buildingType: string) => {
    if (!initializeManagers() || !buildingRegistry) {
      return { canAfford: false, missing: [] };
    }

    try {
      return buildingRegistry.getAffordabilityDetails(buildingType);
    } catch (error) {
      console.error(`Error getting affordability for ${buildingType}:`, error);
      return { canAfford: false, missing: [] };
    }
  };

  // Actions existantes...
  const selectBuilding = (buildingType: string | null) => {
    state.value.selectedBuilding = buildingType;
    state.value.showBuildingPreview = buildingType !== null;
  };

  const showBuildingInfo = (building: TiledBuilding) => {
    state.value.currentBuildingInfo = building;
    state.value.showBuildingInfo = true;
  };

  const hideBuildingInfo = () => {
    state.value.currentBuildingInfo = null;
    state.value.showBuildingInfo = false;
  };

  const addBuilding = (building: TiledBuilding) => {
    state.value.buildings.push(building);
  };

  const removeBuilding = (building: TiledBuilding) => {
    const index = state.value.buildings.indexOf(building);
    if (index !== -1) {
      state.value.buildings.splice(index, 1);
    }
  };

  const clearBuildings = () => {
    state.value.buildings = [];
  };

  const addWorker = (worker: Worker) => {
    state.value.workers.push(worker);
  };

  const removeWorker = (worker: Worker) => {
    const index = state.value.workers.indexOf(worker);
    if (index !== -1) {
      state.value.workers.splice(index, 1);
    }
  };

  const resetGameState = () => {
    state.value = {
      isGameLoaded: false,
      selectedBuilding: null,
      hoveredBuilding: null,
      buildings: [],
      workers: [],
      showBuildingPreview: false,
      showBuildingInfo: false,
      currentBuildingInfo: null
    };

    if (resourceManager) {
      try {
        resourceManager.getGlobalInventory().clear();
      } catch (error) {
        console.error('Error clearing resource manager:', error);
      }
    }

    resourcesMap.value.clear();
    resourceUpdateTrigger.value++;
  };

  // NOUVEAU: Watcher pour debug
  if (process.env.NODE_ENV === 'development') {
    watch(resourceUpdateTrigger, (newVal) => {
      console.log('Resource update trigger changed:', newVal);
    });

    watch(resourcesMap, (newMap) => {
      console.log('Resources map updated:', Object.fromEntries(newMap));
    }, { deep: true });
  }

  return {
    // State
    state: readonly(state),
    resourcesMap: readonly(resourcesMap),

    // Getters
    isGameReady,
    resourceList,
    totalResources,
    buildingCount,
    workerCount,
    canAffordBuilding,
    getResourceAmount,

    // Actions
    setGameLoaded,
    updateResource,
    addResource,
    removeResource,
    purchaseBuilding,
    getBuildingAffordability,
    forceResourceUpdate, // NOUVEAU
    selectBuilding,
    showBuildingInfo,
    hideBuildingInfo,
    addBuilding,
    removeBuilding,
    clearBuildings,
    addWorker,
    removeWorker,
    resetGameState,
    syncResourcesFromManager,

    // Resource Manager access
    getResourceManager,
    getBuildingRegistry
  };
});