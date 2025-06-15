<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { ResourceType, ResourceStack } from '@/game/types'
import ResourceItem from './ResourceItem.vue'
import ResourceBar from './ResourceBar.vue'

interface ResourceBarData {
    type: ResourceType
    current: number
    max: number
    width?: number
}

interface Props {
    showResourceList?: boolean
    showResourceBar?: boolean
    resourceBarData?: ResourceBarData
    maxVisibleResources?: number
    forceShowNames?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    showResourceList: true,
    showResourceBar: false,
    resourceBarData: undefined,
    maxVisibleResources: 6,
    forceShowNames: false
})

const gameStore = useGameStore()

const visibleResources = computed((): ResourceStack[] => {
    return gameStore.resourceList.slice(0, props.maxVisibleResources)
})

const shouldShowNames = computed((): boolean => {
    return props.forceShowNames || visibleResources.value.length <= 4
})
</script>

<template>
    <div class="resource-display-container">
        <!-- Resource List -->
        <div v-if="showResourceList" class="fixed top-4 left-4 z-50 space-y-2">
            <TransitionGroup name="resource-fade" tag="div" class="space-y-2">
                <ResourceItem v-for="resource in visibleResources" :key="resource.type" :resource="resource"
                    :show-name="shouldShowNames" class="resource-item-enter" />
            </TransitionGroup>
        </div>

        <!-- Resource Bar (for building storage) -->
        <div v-if="showResourceBar && resourceBarData" class="resource-bar-container">
            <ResourceBar :resource-type="resourceBarData.type" :current="resourceBarData.current"
                :max="resourceBarData.max" :width="resourceBarData.width" />
        </div>
    </div>
</template>

<style scoped>
.resource-display-container {
    pointer-events: none;
}

.resource-display-container>* {
    pointer-events: auto;
}

/* Transition animations */
.resource-fade-enter-active,
.resource-fade-leave-active {
    transition: all 0.3s ease;
}

.resource-fade-enter-from {
    opacity: 0;
    transform: translateX(-20px);
}

.resource-fade-leave-to {
    opacity: 0;
    transform: translateX(-20px);
}

.resource-fade-move {
    transition: transform 0.3s ease;
}
</style>