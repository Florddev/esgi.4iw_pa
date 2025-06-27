<template>
    <div class="building-icon-wrapper" :style="{ width: `${size}px`, height: `${size}px` }">
        <svg :width="size" :height="size" viewBox="0 0 24 24" class="building-icon-svg" fill="currentColor">
            <component :is="iconComponent" />
        </svg>
    </div>
</template>

<script setup lang="ts">
import { computed, defineComponent } from 'vue'

interface Props {
    buildingType: string
    size?: number
}

const props = withDefaults(defineProps<Props>(), {
    size: 24
})

// Building Icon Components
const HouseIcon = defineComponent({
    name: 'HouseIcon',
    template: `
      <g>
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        <rect x="14" y="15" width="1.5" height="2"/>
        <rect x="16" y="15" width="1.5" height="2"/>
      </g>
    `
})

const SawmillIcon = defineComponent({
    name: 'SawmillIcon',
    template: `
      <g>
        <rect x="2" y="18" width="20" height="3" rx="1"/>
        <path d="M4 18V8l8-6 8 6v10"/>
        <circle cx="12" cy="12" r="3"/>
        <path d="M9 12h6M12 9v6"/>
        <rect x="6" y="14" width="2" height="4"/>
        <rect x="16" y="14" width="2" height="4"/>
      </g>
    `
})

const MineIcon = defineComponent({
    name: 'MineIcon',
    template: `
      <g>
        <path d="M12 2L2 22h20L12 2z"/>
        <path d="M12 8v8M8 12h8"/>
        <circle cx="12" cy="16" r="1"/>
        <path d="M6 18h12"/>
      </g>
    `
})

const FarmIcon = defineComponent({
    name: 'FarmIcon',
    template: `
      <g>
        <rect x="3" y="20" width="18" height="2"/>
        <path d="M6 20V10l3-3 3 3v10M12 20V10l3-3 3 3v10"/>
        <circle cx="7.5" cy="6" r="1"/>
        <circle cx="13.5" cy="6" r="1"/>
        <path d="M7.5 7v2M13.5 7v2"/>
      </g>
    `
})

const UnknownBuildingIcon = defineComponent({
    name: 'UnknownBuildingIcon',
    template: `
      <g>
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M9 9a3 3 0 0 1 6 0c0 2-3 3-3 3"/>
        <circle cx="12" cy="17" r="1"/>
      </g>
    `
})

// Component mapping
const iconComponents = {
    house: HouseIcon,
    sawmill: SawmillIcon,
    mine: MineIcon,
    farm: FarmIcon
} as const

// Computed icon component
const iconComponent = computed(() => {
    return iconComponents[props.buildingType as keyof typeof iconComponents] || UnknownBuildingIcon
})
</script>

<style scoped>
.building-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
}

.building-icon-svg {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}
</style>