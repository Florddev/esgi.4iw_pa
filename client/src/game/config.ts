import { Types } from 'phaser'
import { MainScene } from './scenes/MainScene'
import { BuildingUI } from './ui/BuildingUI'
import { BuildingInfoUI } from './ui/BuildingInfoUI'
import { ResourceUI } from './ui/ResourceUI'

export const gameConfig: Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  // Taille de base du jeu (sera redimensionnée)
  width: window.innerWidth,
  height: window.innerHeight,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.RESIZE, // Redimensionne automatiquement
    width: '100%',
    height: '100%',
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [MainScene, BuildingUI, BuildingInfoUI, ResourceUI],
  backgroundColor: '#000000'
}