<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ActionIcon from './ActionIcon.vue'
import NotificationIcon from './NotificationIcon.vue'

interface Notification {
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message?: string
    duration?: number
    persistent?: boolean
}

interface Props {
    notification: Notification
}

interface Emits {
    (e: 'close', id: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// State
const progressWidth = ref(100)
const startTime = ref(Date.now())
let progressInterval: NodeJS.Timeout | null = null

// Computed
const typeClasses = computed(() => {
    const classes = {
        success: 'bg-green-600/20 border-green-500/50 text-green-100',
        error: 'bg-red-600/20 border-red-500/50 text-red-100',
        warning: 'bg-yellow-600/20 border-yellow-500/50 text-yellow-100',
        info: 'bg-blue-600/20 border-blue-500/50 text-blue-100'
    }
    return classes[props.notification.type]
})

const iconContainerClasses = computed(() => {
    const classes = {
        success: 'bg-green-500/20 text-green-400',
        error: 'bg-red-500/20 text-red-400',
        warning: 'bg-yellow-500/20 text-yellow-400',
        info: 'bg-blue-500/20 text-blue-400'
    }
    return classes[props.notification.type]
})

// Methods
const handleClose = () => {
    emit('close', props.notification.id)
}

const startProgressAnimation = () => {
    if (!props.notification.duration || props.notification.persistent) return

    progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime.value
        const remaining = Math.max(0, props.notification.duration! - elapsed)
        progressWidth.value = (remaining / props.notification.duration!) * 100

        if (remaining <= 0) {
            if (progressInterval) {
                clearInterval(progressInterval)
                progressInterval = null
            }
        }
    }, 50)
}

// Lifecycle
onMounted(() => {
    startProgressAnimation()
})

onUnmounted(() => {
    if (progressInterval) {
        clearInterval(progressInterval)
    }
})
</script>
<template>
    <div class="notification-item relative" :class="[
        'flex items-start gap-3 p-4 rounded-lg backdrop-blur-md border shadow-lg',
        'transition-all duration-200 hover:scale-[1.02]',
        typeClasses
    ]">
        <!-- Icon -->
        <div class="notification-icon flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
            :class="iconContainerClasses">
            <NotificationIcon :type="notification.type" :size="16" />
        </div>

        <!-- Content -->
        <div class="notification-content flex-1 min-w-0">
            <h4 class="notification-title font-semibold text-sm text-white mb-1">
                {{ notification.title }}
            </h4>
            <p v-if="notification.message" class="notification-message text-xs text-gray-300 leading-relaxed">
                {{ notification.message }}
            </p>
        </div>

        <!-- Close Button -->
        <button v-if="!notification.persistent"
            class="close-button flex-shrink-0 w-6 h-6 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            @click="handleClose">
            <ActionIcon icon="close" :size="12" />
        </button>

        <!-- Progress Bar (for timed notifications) -->
        <div v-if="!notification.persistent && notification.duration"
            class="progress-bar absolute bottom-0 left-0 h-1 bg-white/30 rounded-b-lg transition-all duration-100"
            :style="{ width: progressWidth + '%' }" />
    </div>
</template>

<style scoped>
.notification-item {
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.notification-title {
    line-height: 1.2;
}

.notification-message {
    line-height: 1.4;
}

.progress-bar {
    background: linear-gradient(90deg,
            rgba(255, 255, 255, 0.4) 0%,
            rgba(255, 255, 255, 0.2) 100%);
}

.close-button {
    transition: all 0.2s ease;
}

.close-button:hover {
    transform: scale(1.1);
}
</style>