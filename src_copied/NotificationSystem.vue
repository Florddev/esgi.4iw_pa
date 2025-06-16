<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import NotificationItem from './NotificationItem.vue'

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  persistent?: boolean
}

// FIX: Initialiser notifications comme un array vide
const notifications = ref<Notification[]>([])

let notificationId = 0

// Methods
const addNotification = (notification: Omit<Notification, 'id'>) => {
  const id = `notification-${++notificationId}`
  const newNotification: Notification = {
    id,
    duration: 4000,
    ...notification
  }

  notifications.value.push(newNotification)

  // Auto-remove if not persistent
  if (!newNotification.persistent && newNotification.duration) {
    setTimeout(() => {
      removeNotification(id)
    }, newNotification.duration)
  }
}

const removeNotification = (id: string) => {
  const index = notifications.value.findIndex(n => n.id === id)
  if (index !== -1) {
    notifications.value.splice(index, 1)
  }
}

const clearAllNotifications = () => {
  notifications.value = []
}

// Game event handlers
const handleGameEvents = () => {
  const handleNotification = (event: CustomEvent) => {
    addNotification(event.detail)
  }

  const handleResourceCollected = (event: CustomEvent) => {
    const { totalCollected } = event.detail
    addNotification({
      type: 'success',
      title: 'Ressources collectées',
      message: `${totalCollected} ressources récupérées`,
      duration: 2000
    })
  }

  const handleBuildingPlaced = (event: CustomEvent) => {
    const { building } = event.detail
    const buildingName = getBuildingDisplayName(building.getType())
    addNotification({
      type: 'success',
      title: 'Bâtiment construit',
      message: `${buildingName} a été construit avec succès`,
      duration: 3000
    })
  }

  const handleWorkerCreated = () => {
    addNotification({
      type: 'info',
      title: 'Ouvrier créé',
      message: 'Un nouveau bûcheron a rejoint votre équipe',
      duration: 3000
    })
  }

  const handleResourceInsufficient = (event: CustomEvent) => {
    const { resource, required, available } = event.detail
    addNotification({
      type: 'error',
      title: 'Ressources insuffisantes',
      message: `${resource}: ${available}/${required} requis`,
      duration: 4000
    })
  }

  // Add event listeners
  window.addEventListener('game:notification', handleNotification)
  window.addEventListener('game:resourcesCollected', handleResourceCollected)
  window.addEventListener('game:buildingPlaced', handleBuildingPlaced)
  window.addEventListener('game:workerCreated', handleWorkerCreated)
  window.addEventListener('game:resourceInsufficient', handleResourceInsufficient)

  return () => {
    window.removeEventListener('game:notification', handleNotification)
    window.removeEventListener('game:resourcesCollected', handleResourceCollected)
    window.removeEventListener('game:buildingPlaced', handleBuildingPlaced)
    window.removeEventListener('game:workerCreated', handleWorkerCreated)
    window.removeEventListener('game:resourceInsufficient', handleResourceInsufficient)
  }
}

const getBuildingDisplayName = (type: string): string => {
  const names: Record<string, string> = {
    'house': 'Maison',
    'sawmill': 'Scierie',
    'mine': 'Mine',
    'farm': 'Ferme'
  }
  return names[type] || type
}

// Lifecycle
onMounted(() => {
  const cleanup = handleGameEvents()

  onUnmounted(() => {
    cleanup()
  })
})

// Expose methods for external use
defineExpose({
  addNotification,
  removeNotification,
  clearAllNotifications
})
</script>

<template>
  <div class="notification-system fixed top-4 right-4 z-60 space-y-2 max-w-sm">
    <TransitionGroup name="notification-slide" tag="div" class="space-y-2">
      <NotificationItem v-for="notification in notifications" :key="notification.id" :notification="notification"
                        @close="removeNotification" />
    </TransitionGroup>
  </div>
</template>

<style scoped>
/* Notification transitions */
.notification-slide-enter-active,
.notification-slide-leave-active {
  transition: all 0.3s ease;
}

.notification-slide-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-slide-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.notification-slide-move {
  transition: transform 0.3s ease;
}
</style>