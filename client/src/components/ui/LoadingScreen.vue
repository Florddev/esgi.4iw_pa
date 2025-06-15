<!-- src/components/ui/LoadingScreen.vue -->
<template>
    <div class="loading-screen fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <!-- Background Pattern -->
      <div class="absolute inset-0 opacity-10">
        <div class="absolute inset-0 bg-pattern"></div>
      </div>
  
      <!-- Loading Content -->
      <div class="relative text-center text-white space-y-8">
        <!-- Game Logo/Title -->
        <div class="space-y-4">
          <div class="text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            TinyTown
          </div>
          <div class="text-xl text-gray-300 font-medium">
            Building your digital empire...
          </div>
        </div>
  
        <!-- Progress Bar -->
        <div class="w-80 mx-auto space-y-3">
          <div class="flex justify-between text-sm text-gray-400">
            <span>Loading</span>
            <span>{{ progress }}%</span>
          </div>
          
          <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              class="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300 ease-out relative"
              :style="{ width: `${progress}%` }"
            >
              <!-- Shimmer effect -->
              <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 animate-shimmer"></div>
            </div>
          </div>
        </div>
  
        <!-- Loading Messages -->
        <div class="text-gray-400 text-sm min-h-[1.25rem]">
          <Transition name="fade" mode="out-in">
            <div :key="currentMessage">{{ currentMessage }}</div>
          </Transition>
        </div>
  
        <!-- Animated Icons -->
        <div class="flex justify-center space-x-4">
          <div 
            v-for="(icon, index) in loadingIcons"
            :key="index"
            class="w-8 h-8 text-gray-500 animate-bounce"
            :style="{ animationDelay: `${index * 0.2}s` }"
          >
            <BuildingIcon :building-type="icon" :size="32" />
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue'
  import BuildingIcon from './BuildingIcon.vue'
  
  interface Props {
    progress: number
  }
  
  const props = defineProps<Props>()
  
  // Loading messages
  const loadingMessages = [
    'Initializing game engine...',
    'Loading textures and sprites...',
    'Building the world...',
    'Placing trees and resources...',
    'Setting up user interface...',
    'Preparing your adventure...',
    'Almost ready!'
  ]
  
  const loadingIcons = ['house', 'sawmill', 'mine', 'farm']
  
  // State
  const currentMessageIndex = ref(0)
  let messageInterval: NodeJS.Timeout | null = null
  
  // Computed
  const currentMessage = computed(() => {
    return loadingMessages[currentMessageIndex.value] || 'Loading...'
  })
  
  // Methods
  const cycleMessages = () => {
    messageInterval = setInterval(() => {
      currentMessageIndex.value = (currentMessageIndex.value + 1) % loadingMessages.length
    }, 1500)
  }
  
  // Lifecycle
  onMounted(() => {
    cycleMessages()
  })
  
  onUnmounted(() => {
    if (messageInterval) {
      clearInterval(messageInterval)
    }
  })
  </script>
  
  <style scoped>
  /* Background pattern using CSS */
  .bg-pattern {
    background-image: radial-gradient(circle at 30px 30px, rgba(255, 255, 255, 0.1) 2px, transparent 2px);
    background-size: 60px 60px;
  }
  
  /* Shimmer animation */
  @keyframes shimmer {
    0% {
      transform: translateX(-100%) skewX(-12deg);
    }
    100% {
      transform: translateX(400%) skewX(-12deg);
    }
  }
  
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
  
  /* Fade transition for messages */
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s ease;
  }
  
  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
  
  /* Bounce animation with different delays */
  @keyframes bounce {
    0%, 20%, 53%, 80%, 100% {
      transform: translate3d(0, 0, 0);
    }
    40%, 43% {
      transform: translate3d(0, -8px, 0);
    }
    70% {
      transform: translate3d(0, -4px, 0);
    }
    90% {
      transform: translate3d(0, -2px, 0);
    }
  }
  
  .animate-bounce {
    animation: bounce 2s infinite;
  }
  </style>