import { defineStore } from 'pinia'

export const useGameStore = defineStore('game', {
  state: () => ({
    playerPosition: { x: 0, y: 0 },
    gameState: 'idle',
    score: 0
  }),
  actions: {
    updatePlayerPosition(x: number, y: number) {
      this.playerPosition = { x, y }
    },
    setGameState(state: string) {
      this.gameState = state
    },
    updateScore(points: number) {
      this.score += points
    }
  }
})