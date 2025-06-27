<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { ResourceManager } from '@/game/services/ResourceManager'
import { ResourceType } from '@/game/types'
import ActionIcon from './ActionIcon.vue'

const gameStore = useGameStore()
const resourceManager = ResourceManager.getInstance()

// State
const isVisible = ref(false)
const fps = ref(0)
const memoryUsage = ref(0)

// Performance monitoring
let fpsInterval: NodeJS.Timeout | null = null
let frameCount = 0
let lastTime = performance.now()

// Computed
const fpsColor = computed(() => {
    if (fps.value >= 55) return 'text-green-400'
    if (fps.value >= 30) return 'text-yellow-400'
    return 'text-red-400'
})

const buildingCounts = computed(() => {
    const counts: Record<string, number> = {}
    gameStore.state.value.buildings.forEach(building => {
        const type = building.getType()
        counts[type] = (counts[type] || 0) + 1
    })
    return counts
})

const workerCounts = computed(() => {
    const counts: Record<string, number> = {}
    gameStore.state.value.workers.forEach(worker => {
        const type = worker.constructor.name.toLowerCase()
        counts[type] = (counts[type] || 0) + 1
    })
    return counts
})

// Methods
const toggleVisibility = () => {
    isVisible.value = !isVisible.value
}

const getResourceName = (type: ResourceType): string => {
    return resourceManager.getResourceName(type)
}

const getBuildingName = (type: string): string => {
    const names: Record<string, string> = {
        'house': 'Houses',
        'sawmill': 'Sawmills',
        'mine': 'Mines',
        'farm': 'Farms'
    }
    return names[type] || type
}

const getWorkerName = (type: string): string => {
    const names: Record<string, string> = {
        'lumberjack': 'Lumberjacks',
        'miner': 'Miners',
        'farmer': 'Farmers'
    }
    return names[type] || type
}

const addTestResources = () => {
    gameStore.addResource(ResourceType.WOOD, 100)
    gameStore.addResource(ResourceType.STONE, 50)
    gameStore.addResource(ResourceType.FOOD, 25)

    window.dispatchEvent(new CustomEvent('game:notification', {
        detail: {
            type: 'success',
            title: 'Debug',
            message: 'Test resources added'
        }
    }))
}

const clearAllData = () => {
    if (confirm('Clear all game data? This cannot be undone.')) {
        gameStore.resetGameState()
        sessionStorage.clear()

        window.dispatchEvent(new CustomEvent('game:notification', {
            detail: {
                type: 'warning',
                title: 'Debug',
                message: 'All game data cleared'
            }
        }))
    }
}

const exportGameState = () => {
    const gameState = {
        resources: Object.fromEntries(gameStore.state.value.resources),
        buildings: gameStore.state.value.buildings.map(b => ({
            type: b.getType(),
            position: b.getPosition()
        })),
        workers: gameStore.state.value.workers.map(w => ({
            type: w.constructor.name,
            position: { x: w.x, y: w.y }
        })),
        timestamp: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(gameState, null, 2)], {
        type: 'application/json'
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `game-state-${Date.now()}.json`
    a.click()

    URL.revokeObjectURL(url)

    window.dispatchEvent(new CustomEvent('game:notification', {
        detail: {
            type: 'info',
            title: 'Debug',
            message: 'Game state exported'
        }
    }))
}

const updatePerformanceMetrics = () => {
    frameCount++
    const currentTime = performance.now()

    if (currentTime >= lastTime + 1000) {
        fps.value = Math.round((frameCount * 1000) / (currentTime - lastTime))
        frameCount = 0
        lastTime = currentTime

        // Memory usage (if available)
        if ('memory' in performance) {
            const memory = (performance as any).memory
            memoryUsage.value = Math.round(memory.usedJSHeapSize / 1024 / 1024)
        }
    }

    requestAnimationFrame(updatePerformanceMetrics)
}

// Lifecycle
onMounted(() => {
    // Start performance monitoring
    updatePerformanceMetrics()

    // Keyboard shortcut to toggle debug panel
    const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'D')) {
            e.preventDefault()
            toggleVisibility()
        }
    }

    document.addEventListener('keydown', handleKeydown)

    onUnmounted(() => {
        document.removeEventListener('keydown', handleKeydown)
    })
})
</script>
<template>
    <div v-if="isVisible"
        class="debug-panel fixed top-4 right-4 w-80 bg-black/90 backdrop-blur-md rounded-lg border border-gray-600 text-white z-50">
        <!-- Header -->
        <div class="flex items-center justify-between p-3 border-b border-gray-600">
            <h3 class="text-sm font-semibold">Debug Panel</h3>
            <button class="text-gray-400 hover:text-white" @click="toggleVisibility">
                <ActionIcon icon="close" :size="14" />
            </button>
        </div>

        <!-- Content -->
        <div class="p-3 space-y-4 max-h-96 overflow-y-auto">
            <!-- Game State -->
            <div class="space-y-2">
                <h4 class="text-xs font-semibold text-gray-300 uppercase">Game State</h4>
                <div class="text-xs space-y-1">
                    <div class="flex justify-between">
                        <span>Game Loaded:</span>
                        <span :class="gameStore.isGameReady ? 'text-green-400' : 'text-red-400'">
                            {{ gameStore.isGameReady ? 'Yes' : 'No' }}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span>Selected Building:</span>
                        <span class="text-yellow-400">{{ gameStore.state.value.selectedBuilding || 'None' }}</span>
                    </div>
                </div>
            </div>

            <!-- Resources -->
            <div class="space-y-2">
                <h4 class="text-xs font-semibold text-gray-300 uppercase">Resources</h4>
                <div class="text-xs space-y-1">
                    <div class="flex justify-between">
                        <span>Total Resources:</span>
                        <span class="text-blue-400">{{ gameStore.totalResources }}</span>
                    </div>
                    <div v-for="resource in gameStore.resourceList" :key="resource.type"
                        class="flex justify-between pl-2">
                        <span>{{ getResourceName(resource.type) }}:</span>
                        <span class="text-green-400">{{ resource.amount }}</span>
                    </div>
                </div>
            </div>

            <!-- Buildings -->
            <div class="space-y-2">
                <h4 class="text-xs font-semibold text-gray-300 uppercase">Buildings</h4>
                <div class="text-xs space-y-1">
                    <div class="flex justify-between">
                        <span>Total Buildings:</span>
                        <span class="text-blue-400">{{ gameStore.buildingCount }}</span>
                    </div>
                    <div v-for="(count, type) in buildingCounts" :key="type" class="flex justify-between pl-2">
                        <span>{{ getBuildingName(type) }}:</span>
                        <span class="text-yellow-400">{{ count }}</span>
                    </div>
                </div>
            </div>

            <!-- Workers -->
            <div class="space-y-2">
                <h4 class="text-xs font-semibold text-gray-300 uppercase">Workers</h4>
                <div class="text-xs space-y-1">
                    <div class="flex justify-between">
                        <span>Total Workers:</span>
                        <span class="text-blue-400">{{ gameStore.workerCount }}</span>
                    </div>
                    <div v-for="(count, type) in workerCounts" :key="type" class="flex justify-between pl-2">
                        <span>{{ getWorkerName(type) }}:</span>
                        <span class="text-purple-400">{{ count }}</span>
                    </div>
                </div>
            </div>

            <!-- Performance -->
            <div class="space-y-2">
                <h4 class="text-xs font-semibold text-gray-300 uppercase">Performance</h4>
                <div class="text-xs space-y-1">
                    <div class="flex justify-between">
                        <span>FPS:</span>
                        <span :class="fpsColor">{{ fps }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Memory:</span>
                        <span class="text-cyan-400">{{ memoryUsage }}MB</span>
                    </div>
                </div>
            </div>

            <!-- Debug Actions -->
            <div class="space-y-2">
                <h4 class="text-xs font-semibold text-gray-300 uppercase">Debug Actions</h4>
                <div class="space-y-2">
                    <button
                        class="w-full px-2 py-1 text-xs bg-blue-600/20 border border-blue-500/50 rounded hover:bg-blue-600/30 transition-colors"
                        @click="addTestResources">
                        Add Test Resources
                    </button>
                    <button
                        class="w-full px-2 py-1 text-xs bg-red-600/20 border border-red-500/50 rounded hover:bg-red-600/30 transition-colors"
                        @click="clearAllData">
                        Clear All Data
                    </button>
                    <button
                        class="w-full px-2 py-1 text-xs bg-green-600/20 border border-green-500/50 rounded hover:bg-green-600/30 transition-colors"
                        @click="exportGameState">
                        Export Game State
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Toggle Button -->
    <button v-if="!isVisible"
        class="fixed top-4 right-4 w-10 h-10 bg-black/70 backdrop-blur-md rounded-lg border border-gray-600 text-white hover:bg-black/80 transition-colors z-50 flex items-center justify-center"
        @click="toggleVisibility" title="Open Debug Panel">
        <ActionIcon icon="settings" :size="16" />
    </button>
</template>

<style scoped>
.debug-panel {
    font-family: 'Courier New', monospace;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.debug-panel::-webkit-scrollbar {
    width: 4px;
}

.debug-panel::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
}

.debug-panel::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
}

.debug-panel::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
}
</style>