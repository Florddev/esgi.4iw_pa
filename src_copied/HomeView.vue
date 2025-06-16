<template>
  <GameComponent />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import GameComponent from '../components/Game.vue'

export default defineComponent({
  name: 'App',
  components: {
    GameComponent
  }
})
</script>

<style>
.app {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

/* Réinitialisation des styles par défaut */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
</style>