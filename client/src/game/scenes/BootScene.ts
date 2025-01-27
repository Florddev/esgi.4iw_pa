import { Scene } from 'phaser'

export class BootScene extends Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    // Chargement des assets nécessaires au chargement
    this.load.image('loading-bg', 'assets/ui/loading-bg.png')
    this.load.image('loading-bar', 'assets/ui/loading-bar.png')
  }

  create(): void {
    this.scene.start('LoadingScene')
  }
}