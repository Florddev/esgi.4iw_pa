import { Types } from 'phaser'
import { MainScene } from './scenes/MainScene'

export const gameConfig: Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
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
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
    autoCenter: Phaser.Scale.CENTER_BOTH
  },

  scene: [MainScene],
  backgroundColor: '#000000',

  input: {
    mouse: {
      preventDefaultWheel: false,
      preventDefaultDown: false,
      preventDefaultUp: false,
      preventDefaultMove: false
    }
  }
}