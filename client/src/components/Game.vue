<template>
    <div class="game-wrapper">
      <div id="game-container"></div>
    </div>
  </template>
  
  <script lang="ts">
  import { defineComponent, onMounted, onUnmounted, onBeforeUnmount } from 'vue'
  import Phaser from 'phaser'
  import { gameConfig } from '../game/config'
  
  export default defineComponent({
    name: 'GameComponent',
    setup() {
      let game: Phaser.Game | null = null
  
      // Gestionnaire de redimensionnement
      const handleResize = () => {
        if (game) {
          const width = window.innerWidth
          const height = window.innerHeight
          game.scale.resize(width, height)
        }
      }
  
      onMounted(() => {
        try {
          game = new Phaser.Game(gameConfig)
          // Ajout de l'écouteur de redimensionnement
          window.addEventListener('resize', handleResize)
        } catch (error) {
          console.error('Error creating game instance:', error)
        }
      })
  
      onBeforeUnmount(() => {
        // Nettoyage de l'écouteur
        window.removeEventListener('resize', handleResize)
        if (game) {
          game.destroy(true)
          game = null
        }
      })
  
      return {}
    }
  })
  </script>
  
  <style>
  .game-wrapper {
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  
  #game-container {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
  }
  
  /* Styles globaux nécessaires */
  :root {
    margin: 0;
    padding: 0;
  }
  
  body {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  </style>