import { Scene } from 'phaser'

export class LoadingScene extends Scene {
  constructor() {
    super({ key: 'LoadingScene' })
  }

  preload(): void {
    // Création de la barre de chargement
    const loadingBar = this.add.sprite(400, 300, 'loading-bar')
    this.load.on('progress', (value: number) => {
      loadingBar.setScale(value, 1)
    })

    // Chargement des assets du jeu
    this.load.tilemapTiledJSON('map', 'assets/maps/map.json')
    this.load.image('tiles', 'assets/tilesets/main.png')
    this.load.spritesheet('player', 'assets/sprites/player.png', {
      frameWidth: 32,
      frameHeight: 48
    })
  }

  create(): void {
    this.scene.start('MainScene')
  }
}