import { Scene } from 'phaser'
import { Player } from '../objects/Player'
import { Tree } from '../objects/Tree';
import { DialogService } from '../services/DialogService';

interface LayerConfig {
  layer: Phaser.Tilemaps.TilemapLayer;
  hasCollision: boolean;
  isAbovePlayer: boolean;
}

export class MainScene extends Scene {
  private player!: Player
  // private interactionZones: InteractionZone[] = []
  private map!: Phaser.Tilemaps.Tilemap
  private mapLayers: Map<string, LayerConfig> = new Map()
  private trees: Tree[] = []
  private woodCount: number = 0
  private woodText!: Phaser.GameObjects.Text
  private dialogService!: DialogService;
  private targetWood: number = 5;
  private hasShownCompletionDialog: boolean = false;

  constructor() {
    super({ key: 'MainScene' })
  }

  preload() {
    this.load.setBaseURL('/assets/')
    this.load.spritesheet('player-walk', 'sprites/player-walk.png', {
      frameWidth: 96,
      frameHeight: 64
    });
    this.load.spritesheet('player-idle', 'sprites/player-idle.png', {
      frameWidth: 96,
      frameHeight: 64
    });
    this.load.spritesheet('player-chop', 'sprites/player-chop.png', {
      frameWidth: 96,
      frameHeight: 64
    });
    this.load.spritesheet('leaves-hit', 'sprites/leaves-hit.png', {
        frameWidth: 64, 
        frameHeight: 32
    });
    this.load.spritesheet('tree', 'sprites/tree.png', {
      frameWidth: 32,
      frameHeight: 34
    });
    this.load.spritesheet('health-bar', 'ui/health-bar.png', {
        frameWidth: 21, 
        frameHeight: 13
    });
    this.load.image('tiles', 'tilesets/tileset.png')
    this.load.tilemapTiledJSON('map', 'maps/map.json')
    this.load.image('action-button', 'ui/action-button.png')
    this.load.image('cursor', 'ui/cursor.png')
    this.load.image('cursor-chopping', 'ui/cursor-chopping.png')
  }

  create() {
    // Création de la map
    this.map = this.make.tilemap({ key: 'map' })
    const tileset = this.map.addTilesetImage('tileset', 'tiles')

    if (!tileset) {
      console.error('Failed to load tileset')
      return
    }

    // Initialiser le service de dialogue
    this.dialogService = new DialogService(this);

    // Afficher le message de bienvenue
    this.dialogService.showDialog({
      text: "Bienvenue dans TinyTown! Pour commencer votre aventure, vous devez récolter du bois.",
      duration: 4000,
      callback: () => {
        this.dialogService.showDialog({
          text: "Approchez-vous d'un arbre et cliquez dessus pour le couper. Objectif: 5 unités de bois.",
          duration: 4000
        });
      }
    });

    this.uiScene = this.scene.add('UIScene', {
      create: function () {
        this.defaultCursor = this.add.image(0, 0, 'cursor')
          .setDepth(100000)
          .setScale(2.5)
          .setOrigin(0, 0);
        
        this.hoverCursor = this.add.image(0, 0, 'cursor-chopping')
          .setDepth(100000)
          .setScale(2.5)
          .setVisible(false)
          .setOrigin(0, 0);

        this.input.on('pointermove', (pointer) => {
          this.defaultCursor.setPosition(pointer.x, pointer.y);
          this.hoverCursor.setPosition(pointer.x, pointer.y);
        });

        this.woodText = this.add.text(20, 20, 'Bois: 0', {
          fontSize: '32px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
          fontStyle: 'bold'
        }).setDepth(100000);
      }
    }, true);

    // Cacher le curseur par défaut
    this.input.setDefaultCursor('none');

    // Récupération de tous les layers
    const allLayers = this.map.layers

    // Création du joueur avant les layers qui doivent apparaître au-dessus
    this.player = new Player(this, 230, 200)
    this.player.setScale(1)

    // Création et configuration automatique des layers
    allLayers.forEach(layerData => {
      // Création du layer
      const layer = this.map.createLayer(layerData.name, tileset, 0, 0)
      if (!layer) return

      // Lecture des propriétés personnalisées du layer depuis Tiled
      const properties = this.getTiledProperties(layerData)

      const hasCollision = properties.hasCollision ?? false
      const isAbovePlayer = properties.isAbovePlayer ?? false

      // Configuration des collisions si nécessaire
      if (hasCollision) {
        // Collisions basées sur les propriétés de Tiled
        layer.setCollisionByProperty({ collides: true })
        this.physics.add.collider(this.player, layer)
      }

      // Gestion de la profondeur si le layer doit être au-dessus du joueur
      if (isAbovePlayer) {
        layer.setDepth(10) // Le joueur aura une profondeur de 1
      }

      // Stockage de la configuration du layer
      this.mapLayers.set(layerData.name, {
        layer,
        hasCollision,
        isAbovePlayer
      })
    })

    // Configuration du joueur
    this.player.setDepth(1)

    // Configuration de la caméra
    this.cameras.main.startFollow(this.player)
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels)

    const minDimension = Math.min(window.innerWidth, window.innerHeight)
    const zoomLevel = minDimension / 300 // Ajustez 800 selon vos besoins
    this.cameras.main.setZoom(Math.min(4.1, zoomLevel)) // Limite le zoom maximum à 2

    // Configuration des limites du monde
    this.physics.world.bounds.width = this.map.widthInPixels
    this.physics.world.bounds.height = this.map.heightInPixels

    // const woodZone = new InteractionZone(this, 312, 135, 32, 16)
    // woodZone.setupPlayerCollision(this.player)
    // this.interactionZones.push(woodZone)

    // On peut aussi ajouter un fond semi-transparent pour une meilleure lisibilité
    const padding = 8
    const textBg = this.add.rectangle(
      10,  // Un peu à gauche du texte
      10,  // Un peu au-dessus du texte
      200, // Largeur approximative
      50,  // Hauteur approximative
      0x000000,
      0.5
    )
      .setScrollFactor(0)
      .setDepth(9998)      // Juste en-dessous du texte

    // Spawner les arbres à partir du layer d'objets
    this.spawnTreesFromObjectLayer()

    // Écouter l'événement d'ajout de bois
    this.events.on('addWood', this.addWood, this)
  }

  private spawnTreesFromObjectLayer(): void {
    const treeLayer = this.map.getObjectLayer('Trees')

    if (!treeLayer) {
      console.warn('No "Trees" object layer found in the map')
      return
    }

    treeLayer.objects.forEach(obj => {
      const tree = new Tree(
        this,
        obj.x! + (obj.width! / 2),
        obj.y! - (obj.height!),
        obj // Passer l'objet complet pour les dimensions
      )

      tree.setupPlayerCollision(this.player)
      this.trees.push(tree)

      if (obj.properties) {
        obj.properties.forEach(prop => {
          switch (prop.name) {
            case 'respawnTime':
              tree.setRespawnTime(prop.value)
              break
            case 'woodValue':
              tree.setWoodValue(prop.value)
              break
            case 'scale':
              tree.setScale(prop.value)
              break
          }
        })
      }
    })
  }

  // private addTree(x: number, y: number): void {
  //   const tree = new Tree(this, x, y)
  //   tree.setupPlayerCollision(this.player)
  //   this.trees.push(tree)
  // }

  private addWood(amount: number): void {
    this.woodCount += amount;
    const newText = `Bois: ${this.woodCount}`;
    this.uiScene.woodText.setText(newText);

    // Vérifier si l'objectif est atteint
    if (this.woodCount >= this.targetWood && !this.hasShownCompletionDialog) {
      this.hasShownCompletionDialog = true;
      this.dialogService.showDialog({
        text: "Excellent travail! Vous avez collecté suffisamment de bois.",
        duration: 3000
      });
    }
  }

  private getTiledProperties(layerData: Phaser.Tilemaps.LayerData): Record<string, any> {
    const properties: Record<string, any> = {}

    if (layerData.properties && Array.isArray(layerData.properties)) {
      layerData.properties.forEach(prop => {
        properties[prop.name] = prop.value
      })
    }

    return properties
  }

  getLayer(name: string): Phaser.Tilemaps.TilemapLayer | undefined {
    return this.mapLayers.get(name)?.layer
  }

  update() {
    this.player.update()
    this.trees.forEach(tree => tree.update())
    this.trees = this.trees.filter(tree => tree.scene)
  }
}