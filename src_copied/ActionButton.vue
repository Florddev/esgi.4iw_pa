<script setup lang="ts">
import { computed } from 'vue'
import ActionIcon from './ActionIcon.vue'

interface Props {
    icon: string
    label?: string
    variant?: 'primary' | 'secondary' | 'danger' | 'success'
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
    loading?: boolean
}

interface Emits {
    (e: 'click'): void
}

const props = withDefaults(defineProps<Props>(), {
    variant: 'secondary',
    size: 'md',
    disabled: false,
    loading: false
})

const emit = defineEmits<Emits>()

// Computed styles
const variantClasses = computed(() => {
    if (props.disabled) {
        return 'bg-gray-700/50 border-gray-600 text-gray-500 cursor-not-allowed'
    }

    const variants = {
        primary: 'bg-blue-600/20 border-blue-500 text-blue-300 hover:bg-blue-600/30 hover:border-blue-400',
        secondary: 'bg-gray-600/20 border-gray-500 text-gray-300 hover:bg-gray-600/30 hover:border-gray-400',
        danger: 'bg-red-600/20 border-red-500 text-red-300 hover:bg-red-600/30 hover:border-red-400',
        success: 'bg-green-600/20 border-green-500 text-green-300 hover:bg-green-600/30 hover:border-green-400'
    }

    return variants[props.variant]
})

const sizeClasses = computed(() => {
    const sizes = {
        sm: 'text-xs px-2 py-1',
        md: 'text-sm px-4 py-2',
        lg: 'text-base px-6 py-3'
    }

    return sizes[props.size]
})

const iconSizeClasses = computed(() => {
    const sizes = {
        sm: 'w-3 h-3',
        md: 'w-4 h-4',
        lg: 'w-5 h-5'
    }

    return sizes[props.size]
})

const iconSize = computed(() => {
    const sizes = {
        sm: 12,
        md: 16,
        lg: 20
    }

    return sizes[props.size]
})

// Methods
const handleClick = () => {
    if (!props.disabled && !props.loading) {
        emit('click')
    }
}
</script>
<template>
    <button class="action-button group relative" :class="[
        'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200',
        'backdrop-blur-sm border',
        variantClasses,
        sizeClasses
    ]" :disabled="disabled" @click="handleClick">
        <!-- Icon -->
        <div class="icon-container" :class="iconSizeClasses">
            <ActionIcon :icon-type="icon" :size="iconSize" />
        </div>

        <!-- Label -->
        <span v-if="label" class="label">
            {{ label }}
        </span>

        <!-- Loading Spinner -->
        <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
            <div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
        </div>
    </button>
</template>



<style scoped>
.action-button {
    user-select: none;
    position: relative;
    overflow: hidden;
}

.action-button:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.action-button:not(:disabled):active {
    transform: translateY(0);
}

.action-button::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%);
    transform: translateX(-100%);
    transition: transform 0.6s;
}

.action-button:hover::before {
    transform: translateX(100%);
}
</style>