<template>
    <div class="building-fab-container fixed bottom-6 right-6 z-40">
        <!-- Floating Action Button -->
        <button
            class="fab-button group relative w-14 h-14 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center text-white"
            @click="toggleModal">
            <!-- Icon -->
            <div class="transition-transform duration-300 group-hover:scale-110">
                <BuildingIcon building-type="house" :size="24" />
            </div>

            <!-- Ripple effect -->
            <div
                class="absolute inset-0 rounded-full bg-white/20 scale-0 group-active:scale-100 transition-transform duration-150" />

            <!-- Notification badge -->
            <div v-if="buildingCount > 0"
                class="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                {{ buildingCount > 9 ? '9+' : buildingCount }}
            </div>
        </button>

        <!-- Tooltip -->
        <div
            class="tooltip absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            Construire des bâtiments
            <div class="tooltip-arrow absolute top-full right-4 border-4 border-transparent border-t-gray-900" />
        </div>

        <!-- Building List Modal -->
        <BuildingListModal ref="buildingModal" />
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import BuildingIcon from './BuildingIcon.vue'
import BuildingListModal from './BuildingListModal.vue'

const gameStore = useGameStore()
const buildingModal = ref<InstanceType<typeof BuildingListModal>>()

// Computed
const buildingCount = computed(() => gameStore.buildingCount)

// Methods
const toggleModal = () => {
    if (buildingModal.value) {
        buildingModal.value.show()
    }
}
</script>

<style scoped>
.fab-button {
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
}

.fab-button:hover {
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.6);
    transform: translateY(-2px);
}

.fab-button:active {
    transform: translateY(0);
}

.tooltip-arrow {
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2));
}

/* Floating animation */
@keyframes float {

    0%,
    100% {
        transform: translateY(0);
    }

    50% {
        transform: translateY(-4px);
    }
}

.fab-button {
    animation: float 3s ease-in-out infinite;
}

.fab-button:hover {
    animation: none;
}
</style>