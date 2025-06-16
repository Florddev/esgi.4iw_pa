<template>
  <!-- Modal Overlay -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isVisible" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
           @click="handleOverlayClick">
        <!-- Modal Content -->
        <div class="modal-content relative w-full max-w-2xl mx-auto" @click.stop>
          <div class="bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700/50 shadow-2xl">
            <!-- Header -->
            <div class="flex items-center justify-between p-6 border-b border-gray-700/50">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                  <BuildingIcon building-type="house" :size="24" />
                </div>
                <div>
                  <h2 class="text-xl font-bold text-white">
                    Bâtiments disponibles
                  </h2>
                  <p class="text-sm text-gray-400">
                    {{ totalBuildings }} bâtiment{{ totalBuildings > 1 ? 's' : '' }} sur la carte
                  </p>
                </div>
              </div>

              <button
                  class="w-8 h-8 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                  @click="handleClose">
                <ActionIcon icon="close" :size="16" />
              </button>
            </div>

            <!-- Body -->
            <div class="p-6">
              <!-- Building Grid -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BuildingCard v-for="building in availableBuildings" :key="building.key"
                              :building="building" :count="getBuildingCount(building.key)"
                              :can-afford="canAffordBuilding(building)" @select="handleBuildingSelect" />
              </div>

              <!-- Statistics Section -->
              <div class="mt-8 pt-6 border-t border-gray-700/50">
                <h3 class="text-lg font-semibold text-white mb-4">
                  Statistiques
                </h3>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Total bâtiments" :value="totalBuildings" icon="house"
                            color="blue" />
                  <StatCard title="Ressources stockées" :value="totalStoredResources" icon="plus"
                            color="green" />
                  <StatCard title="Ouvriers actifs" :value="totalWorkers" icon="worker"
                            color="purple" />
                  <StatCard title="Valeur totale" :value="totalValue" icon="info" color="yellow" />
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
import { ref, computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { BuildingConfig } from '@/game/types/BuildingTypes'
import BuildingIcon from './BuildingIcon.vue'
import ActionIcon from './ActionIcon.vue'
import BuildingCard from './BuildingCard.vue'
import StatCard from './StatCard.vue'

const gameStore = useGameStore()

// State
const isVisible = ref(false)

const buildingRegistry = computed(() => gameStore.getBuildingRegistry())

const availableBuildings = computed((): readonly BuildingConfig[] => {
  return buildingRegistry.value.getAllBuildings()
});

// Computed
const totalBuildings = computed(() => gameStore.buildingCount)

const totalWorkers = computed(() => gameStore.workerCount)

const totalStoredResources = computed(() => {
  // Calculate total resources stored in all buildings
  return gameStore.state.buildings?.reduce((total, building) => {
    const resources = building.getAllBuildingResources?.() || new Map()
    return total + Array.from(resources.values()).reduce((sum, amount) => sum + amount, 0)
  }, 0) || 0
})

const totalValue = computed(() => {
  // Calculate total value of all resources
  const resourceManager = gameStore.getResourceManager()
  return resourceManager.getGlobalInventory().getTotalValue()
})

// Methods
const show = () => {
  isVisible.value = true
}

const hide = () => {
  isVisible.value = false
}

const handleClose = () => {
  hide()
}

const handleOverlayClick = () => {
  hide()
}

const getBuildingCount = (buildingType: string): number => {
  return gameStore.state.buildings?.filter(building =>
      building.getType?.() === buildingType
  ).length || 0
}

const canAffordBuilding = (building: BuildingConfig): boolean => {
  return gameStore.canAffordBuilding(building.key, building.cost)
}

const handleBuildingSelect = (buildingKey: string) => {
  const building = availableBuildings.value.find(b => b.key === buildingKey);

  if (!building || !canAffordBuilding(building)) {
    // Afficher un message d'erreur si on ne peut pas se permettre le bâtiment
    window.dispatchEvent(new CustomEvent('game:notification', {
      detail: {
        type: 'error',
        title: 'Ressources insuffisantes',
        message: `Vous n'avez pas assez de ressources pour construire ${building?.name || 'ce bâtiment'}`
      }
    }))
    return
  }

  gameStore.selectBuilding(buildingKey)

  window.dispatchEvent(new CustomEvent('game:selectBuilding', {
    detail: buildingKey
  }))

  window.dispatchEvent(new CustomEvent('game:notification', {
    detail: {
      type: 'info',
      title: 'Mode construction activé',
      message: `Placez ${building.name} sur la carte`
    }
  }))

  // Close modal
  hide()
}

// Expose methods
defineExpose({
  show,
  hide
})
</script>