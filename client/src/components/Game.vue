<template>
  <div class="game-wrapper">
    <!-- Phaser Game Container -->
    <div id="game-container" ref="gameContainer"></div>

    <!-- Vue.js UI Overlay -->
    <GameUI v-if="isGameReady" />

    <!-- Loading Screen -->
    <LoadingScreen v-if="!isGameReady" :progress="loadingProgress" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Phaser from 'phaser'
import { gameConfig } from '@/game/config'
import { useGameState } from '@/game/ui/composables/useGameState'
import GameUI from './ui/GameUI.vue'
import LoadingScreen from './ui/LoadingScreen.vue'

// Refs
const gameContainer = ref<HTMLElement>()
const loadingProgress = ref(0)

// Game state composable
const { initializeGameIntegration, isInitialized } = useGameState()

// State
let game: Phaser.Game | null = null
const isGameReady = ref(false)

// Methods
const createGame = async () => {
  try {
    if (!gameContainer.value) {
      throw new Error('Game container not found')
    }

    // Update game config to target our container
    const config = {
      ...gameConfig,
      parent: gameContainer.value
    }

    // Create the game instance
    game = new Phaser.Game(config)

    // Wait for the game to be ready
    game.events.once('ready', () => {
      handleGameReady()
    })

    // Monitor loading progress
    game.events.on('preload.progress', (progress: number) => {
      loadingProgress.value = Math.round(progress * 100)
    })

    // Handle resize
    const handleResize = () => {
      if (game) {
        const width = window.innerWidth
        const height = window.innerHeight
        game.scale.resize(width, height)
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }

  } catch (error) {
    console.error('Error creating game instance:', error)
    throw error
  }
}

const handleGameReady = async () => {
  if (!game) return

  // Initialize game integration
  initializeGameIntegration(game)

  // Mark as ready
  isGameReady.value = true

  console.log('Game ready and UI integrated')
}

const destroyGame = () => {
  if (game) {
    game.destroy(true)
    game = null
  }
  isGameReady.value = false
}

// Lifecycle
onMounted(async () => {
  // Wait for DOM to be ready
  await nextTick()

  try {
    const cleanup = await createGame()

    onBeforeUnmount(() => {
      cleanup?.()
      destroyGame()
    })
  } catch (error) {
    console.error('Failed to initialize game:', error)
  }
})
</script>

<style scoped>
.game-wrapper {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: relative;
  background: #000;
}

#game-container {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  position: absolute;
  top: 0;
  left: 0;
}

/* Ensure Phaser canvas fits properly */
#game-container canvas {
  display: block;
  margin: 0 auto;
}
</style>