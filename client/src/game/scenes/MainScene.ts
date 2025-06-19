import { Scene } from 'phaser'
import EasyStar from 'easystarjs'
import { Player } from '../objects/Player'
import { DialogService } from '../services/DialogService'
import { BuildingPreview } from '../objects/BuildingPreview'
import { Building } from '../objects/Building'
import { BuildingManager } from '../services/BuildingManager'
import { TiledBuildingPreview } from '../objects/TiledBuildingPreview'
import type { TiledBuilding } from '../objects/TiledBuilding'
import { WorkerManager } from '../services/WorkerManager'
import { ResourceManager } from '../services/ResourceManager'
import { ResourceType } from '../types/ResourceSystemTypes'
import { BuildingRegistry } from '../services/BuildingRegistry'
import { AnimationRegistry } from '../services/AnimationRegistry'
import { AnimationUtils } from '../utils/AnimationUtils'
import { ResourceEntityManager } from '../services/ResourceEntityManager'
import {WorkerType} from "../types";
import type {WorkerPosition} from "../types";
import {Worker} from "../objects/workers";

interface LayerConfig {
  layer: Phaser.Tilemaps.TilemapLayer
  hasCollision: boolean
  isAbovePlayer: boolean
}

export class MainScene extends Scene {
  private STORAGE_KEY = 'BUILDINGS_STORAGE'
  private player!: Player
  private map!: Phaser.Tilemaps.Tilemap
  private mapLayers: Map<string, LayerConfig> = new Map()
  private woodCount: number = 0
  private woodText!: Phaser.GameObjects.Text
  private dialogService!: DialogService
  private targetWood: number = 5
  private hasShownCompletionDialog: boolean = false
  private buildingPreview: BuildingPreview | null = null
  private selectedBuildingType: string | null = null
  private lastSyncCheck: number = 0;
  private buildings: Building[] = []
  private buildingManager!: BuildingManager
  private resources = {
    wood: 0
  }
  private easyStar: EasyStar.js
  private tileWidth: number = 16
  private tileHeight: number = 16
  private baseGrid: number[][] = []
  private buildingRegistry!: BuildingRegistry
  private animationRegistry!: AnimationRegistry
  private resourceEntityManager!: ResourceEntityManager
  public resourceManager!: ResourceManager;

  private workerManager!: WorkerManager

  constructor() {
    super({ key: 'MainScene' })
    this.easyStar = new EasyStar.js()
  }

  preload() {
    this.load.setBaseURL('/assets/')

    // Initialize animation registry and validate textures will be loaded
    this.animationRegistry = AnimationRegistry.getInstance()

    // Use ResourceManager to load resource textures
    this.resourceManager = ResourceManager.getInstance()
    this.resourceManager.prepareSceneLoading(this)

    // Load game textures
    this.load.spritesheet('player-walk', 'sprites/player-walk.png', {
      frameWidth: 96,
      frameHeight: 64
    })
    this.load.spritesheet('player-idle', 'sprites/player-idle.png', {
      frameWidth: 96,
      frameHeight: 64
    })
    this.load.spritesheet('player-chop', 'sprites/player-chop.png', {
      frameWidth: 96,
      frameHeight: 64
    })
    this.load.spritesheet('leaves-hit', 'sprites/leaves-hit.png', {
      frameWidth: 64,
      frameHeight: 32
    })
    this.load.spritesheet('tree', 'sprites/tree.png', {
      frameWidth: 32,
      frameHeight: 34
    })
    this.load.spritesheet('rock', 'sprites/rock.png', {
      frameWidth: 26,
      frameHeight: 25
    })
    this.load.spritesheet('coal_vein', 'sprites/coal_vein.png', {
      frameWidth: 26,
      frameHeight: 25
    })
    this.load.spritesheet('health-bar', 'ui/health-bar.png', {
      frameWidth: 21,
      frameHeight: 13
    })
    this.load.image('tiles', 'tilesets/tileset.png')
    this.load.tilemapTiledJSON('map', 'maps/map.json')
    this.load.image('action-button', 'ui/action-button.png')
    this.load.image('cursor', 'ui/cursor.png')
    this.load.image('cursor-chopping', 'ui/cursor-chopping.png')

    this.load.image('house', 'buildings/house.png')
    this.load.image('sawmill', 'buildings/sawmill.png')

    this.load.tilemapTiledJSON('house-template', 'buildings/templates/house-template.json')
    this.load.tilemapTiledJSON('sawmill-template', 'buildings/templates/sawmill-template.json')

    // Load icons for UI
    this.load.image('house-icon', 'ui/icons/house.png')
    this.load.image('sawmill-icon', 'ui/icons/sawmill.png')
  }

  create() {
    // Initialize animation registry for this scene
    this.setupAnimations()
    this.setupVueResourceSync();

    // Create map
    this.map = this.make.tilemap({ key: 'map' })
    const tileset = this.map.addTilesetImage('tileset', 'tiles')

    if (!tileset) {
      console.error('Failed to load tileset')
      return
    }

    // Initialize dialog service
    // this.dialogService = new DialogService(this)

    /*
    // Show welcome message
    this.dialogService.showDialog({
      text: "Welcome to TinyTown! To start your adventure, you need to harvest wood.",
      duration: 4000,
      callback: () => {
        this.dialogService.showDialog({
          text: "Approach a tree and click on it to cut it down. Objective: 5 units of wood.",
          duration: 4000
        })
      }
    })

     */


    this.uiScene = this.scene.add('UIScene', {
      create: function () {
        this.defaultCursor = this.add.image(0, 0, 'cursor')
          .setDepth(100000)
          .setScale(2.5)
          .setOrigin(0, 0)

        this.hoverCursor = this.add.image(0, 0, 'cursor-chopping')
          .setDepth(100000)
          .setScale(2.5)
          .setVisible(false)
          .setOrigin(0, 0)

        this.input.on('pointermove', (pointer) => {
          this.defaultCursor.setPosition(pointer.x, pointer.y)
          this.hoverCursor.setPosition(pointer.x, pointer.y)
        })

        /*
        this.woodText = this.add.text(20, 20, 'Wood: 0', {
          fontSize: '32px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
          fontStyle: 'bold'
        }).setDepth(100000)
        */
      }
    }, true)

    // Hide default cursor
    this.input.setDefaultCursor('none')

    // Get all layers
    const allLayers = this.map.layers

    // Create player before layers that should appear above
    this.player = new Player(this, 830, 700)
    this.player.setScale(1)

    // Initialize resource manager and inventory
    this.resourceManager = ResourceManager.getInstance()
    this.resourceManager.prepareSceneLoading(this)

    this.buildingRegistry = BuildingRegistry.getInstance()

    // Launch resource UI
    //this.scene.launch('ResourceUI')

    /*
    this.events.on('addResource', (type: ResourceType, amount: number) => {
      this.resourceManager.addResource(type, amount, 'game_event')
    })
    */

    // Create and configure layers automatically
    allLayers.forEach(layerData => {
      const layer = this.map.createLayer(layerData.name, tileset, 0, 0)
      if (!layer) return

      const properties = this.getTiledProperties(layerData)
      const hasCollision = properties.hasCollision ?? false
      const isAbovePlayer = properties.isAbovePlayer ?? false

      if (hasCollision) {
        // SetCollisionByProperty => Activate collision on these tiles
        layer.setCollisionByProperty({ collides: true })
        //this.physics.add.collider(this.player, layer);
      }

      if (isAbovePlayer) {
        layer.setDepth(10)
      }

      this.mapLayers.set(layerData.name, {
        layer,
        hasCollision,
        isAbovePlayer
      })
    })

    // Player configuration
    this.player.setDepth(1)

    // Camera configuration
    this.cameras.main.startFollow(this.player)
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels)
    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels)

    const minDimension = Math.min(window.innerWidth, window.innerHeight)
    const zoomLevel = minDimension / 280 // Adjust 800 according to your needs
    this.cameras.main.setZoom(Math.min(3.3, zoomLevel)) // Limit maximum zoom to 2

    // World bounds configuration
    this.physics.world.bounds.width = this.map.widthInPixels
    this.physics.world.bounds.height = this.map.heightInPixels

    /*
    // Add semi-transparent background for better readability
    const padding = 8
    const textBg = this.add.rectangle(
      10,  // A bit to the left of text
      10,  // A bit above text
      200, // Approximate width
      50,  // Approximate height
      0x000000,
      0.5
    ).setScrollFactor(0).setDepth(9998)      // Just below text
    */
    /*
    // Listen for wood addition event
    this.events.on('addWood', (amount: number) => {
      this.resources.wood += amount
      this.events.emit('resourcesUpdated', this.resources)
    })
    */
    this.resourceEntityManager = new ResourceEntityManager(this)
    this.resourceEntityManager.spawnFromMap(this.map)

    /*
    this.game.events.on('selectBuilding', (buildingType: string) => {
      const buildingUI = this.scene.get('BuildingUI') as BuildingUI

      if (buildingUI.canAffordBuilding(buildingType, this.resources)) {
        this.selectedBuildingType = buildingType
        // Create preview based on Tiled template
        if (this.buildingPreview) {
          this.buildingPreview.destroy()
        }
        this.buildingPreview = new TiledBuildingPreview(
          this,
          buildingType
        )
      } else {
        // Show error message
        this.showResourceError()
      }
    })
    */


    // Listen for cleanup event
    this.game.events.on('clearBuildings', () => {
      this.buildingManager.clearAll()
    })

    this.initializeBuildingSystem()

    // Start building UI scene
    //this.scene.launch('BuildingUI')

    // Debug collision visualization in development
    /*
    if (process.env.NODE_ENV === 'development' && false) {
      this.mapLayers.forEach((config, name) => {
        if (config.hasCollision) {
          const layer = this.map.getLayer(name).tilemapLayer
          const debugGraphics = this.add.graphics().setAlpha(0.75)
          layer.renderDebug(debugGraphics, {
            tileColor: null,
            collidingTileColor: new Phaser.Display.Color(243, 134, 48, 255),
            faceColor: new Phaser.Display.Color(40, 39, 37, 255)
          })
        }
      })
    }*/

    this.buildingManager = new BuildingManager(this)
    this.workerManager = new WorkerManager(this)
    this.buildingManager.loadState()
    this.rebuildPathfindingGrid()

    this.baseGrid = Array.from(
      { length: this.map.height },
      () => Array(this.map.width).fill(0)
    )

    // Go through each layer with hasCollision = true

    this.mapLayers.forEach((layerConfig) => {
      if (!layerConfig.hasCollision) return // Ignore those without collision
      const layer = layerConfig.layer
      for (let y = 0; y < this.map.height; y++) {
        for (let x = 0; x < this.map.width; x++) {
          const tile = layer.getTileAt(x, y)
          if (!tile) continue

          // First criterion: the "collides" property at tile level
          const hasCollidesProp = !!(tile.properties && tile.properties.collides)

          // Second criterion: objectgroup in tileset (collision shapes)
          const tileData = tile.tileset.getTileData(tile.index)
          const hasCollisionShapes = tileData
            && tileData.objectgroup
            && tileData.objectgroup.objects
            && tileData.objectgroup.objects.length > 0

          if (hasCollidesProp || hasCollisionShapes) {
            this.baseGrid[y][x] = 1 // Mark tile as blocked
          }
        }
      }
    })

    // Then assign this global grid to easystar
    const fullGrid = this.copyGrid(this.baseGrid)
    this.easyStar.setGrid(fullGrid)
    this.easyStar.setAcceptableTiles([0])
    this.easyStar.enableDiagonals()
    this.easyStar.setIterationsPerCalculation(10000)
    this.easyStar.disableCornerCutting()

    // MOUSE CLICK LISTENER FOR MOVEMENT
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Convert click position to tile coordinate
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
      let targetTileX = Math.floor(worldPoint.x / this.tileWidth)
      let targetTileY = Math.floor(worldPoint.y / this.tileHeight)

      // Get player "tile" position
      const playerTileX = Math.floor(this.player.x / this.tileWidth)
      const playerTileY = Math.floor(this.player.y / this.tileHeight)

      // If target tile has collision, find nearest accessible tile
      if (this.baseGrid[targetTileY][targetTileX] === 1) {
        const nearestTile = this.findNearestWalkableTile(targetTileX, targetTileY)
        if (nearestTile) {
          targetTileX = nearestTile.x
          targetTileY = nearestTile.y
        } else {
          console.log('No accessible tile found nearby')
          return
        }
      }

      // Calculate path with EasyStar
      this.easyStar.findPath(
        playerTileX,
        playerTileY,
        targetTileX,
        targetTileY,
        (path) => {
          if (path === null) {
            console.log('No path found!')
          } else {
            this.player.setPath(path)
          }
        }
      )

      this.easyStar.calculate()
    })

    this.rebuildPathfindingGrid()
    this.setupVueEventListeners()

    /* TODO: Test a supprimer: */
    this.time.delayedCall(2000, () => {
      this.testWorkerSystem();
    });
    /* ----------------------- */
  }

  private setupVueResourceSync(): void {
    try {
      // Écouter les événements de changement de ressources du ResourceManager
      this.resourceManager.getGlobalInventory().on('change', (event: any) => {
        this.notifyVueResourceChange(event);
      });

      // Notifier Vue que le jeu est prêt avec les ressources initiales
      this.notifyGameReady();

      console.log('Vue resource sync configured successfully');
    } catch (error) {
      console.error('Error setting up Vue resource sync:', error);
    }
  }

  private notifyVueResourceChange(event: any): void {
    try {
      // Émettre vers Vue.js via window events
      window.dispatchEvent(new CustomEvent('game:resourceUpdate', {
        detail: {
          type: event.type,
          amount: event.newAmount,
          change: event.change,
          source: 'resource_manager'
        }
      }));

      console.log('Resource change notified to Vue:', event.type, event.newAmount);
    } catch (error) {
      console.error('Error notifying Vue of resource change:', error);
    }
  }

  public addResource(type: ResourceType, amount: number, source?: string): number {
    return this.resourceManager.addResource(type, amount, source || 'scene')
  }

  public removeResource(type: ResourceType, amount: number, target?: string): number {
    return this.resourceManager.removeResource(type, amount, target || 'scene')
  }

  public canAffordCost(cost: Partial<Record<ResourceType, number>>): boolean {
    return this.resourceManager.canAfford(cost)
  }

  private setupAnimations(): void {
    // Preload all necessary animations for this scene
    const entityTypes: Array<'player' | 'worker' | 'tree' | 'effects'> = ['player', 'worker', 'tree', 'effects']
    AnimationUtils.preloadSceneAnimations(this, entityTypes)

    // Validate that all required textures are loaded
    const validation = this.animationRegistry.validateTextures(this)
    if (!validation.isValid) {
      console.warn('Missing textures for animations:', validation.missingTextures)
    }

    // Log animation stats in development
    if (process.env.NODE_ENV === 'development') {
      AnimationUtils.logAnimationStats()
    }
  }

  public getResourceAmount(type: ResourceType): number {
    return this.resourceManager.getResource(type)
  }

  public getAllResources(): ResourceStack[] {
    return this.resourceManager.getGlobalInventory().getNonZeroResources();
  }

  private notifyGameReady(): void {
    try {
      // Synchroniser avec Vue.js
      window.dispatchEvent(new CustomEvent('game:ready', {
        detail: {
          resourceManager: this.resourceManager,
          totalResources: this.resourceManager.getGlobalInventory().getTotalItems(),
          allResources: Object.fromEntries(this.resourceManager.getGlobalInventory().getAllResources())
        }
      }));

      // Déclencher une mise à jour initiale des ressources
      this.triggerInitialResourceSync();

      console.log('Game ready notification sent to Vue with resources');
    } catch (error) {
      console.error('Error notifying game ready to Vue:', error);
    }
  }

  private triggerInitialResourceSync(): void {
    try {
      const inventory = this.resourceManager.getGlobalInventory();
      const allResources = inventory.getAllResources();

      // Notifier chaque ressource individuellement pour déclencher la réactivité
      allResources.forEach((amount, type) => {
        if (amount > 0) {
          window.dispatchEvent(new CustomEvent('game:resourceUpdate', {
            detail: {
              type,
              amount,
              change: amount,
              source: 'initial_sync'
            }
          }));
        }
      });

      console.log('Initial resource sync completed');
    } catch (error) {
      console.error('Error in initial resource sync:', error);
    }
  }

  private setupVueEventListeners(): void {
    // Listen for building selection from Vue.js
    const handleBuildingSelection = (event: CustomEvent) => {
      const buildingType = event.detail
      this.onBuildingSelectedFromVue(buildingType)
    }
  
    // Listen for building deselection
    const handleBuildingDeselection = () => {
      this.onBuildingDeselectedFromVue()
    }
  
    // Listen for worker creation
    const handleWorkerCreation = (event: CustomEvent) => {
      const { type, positionHint } = event.detail
      this.onWorkerCreationFromVue(type, positionHint)
    }
  
    window.addEventListener('game:selectBuilding', handleBuildingSelection)
    window.addEventListener('game:deselectBuilding', handleBuildingDeselection)
    window.addEventListener('game:createWorkerCommand', handleWorkerCreation)
  }


  private onBuildingSelectedFromVue(buildingType: string): void {
    console.log('Building selected from Vue:', buildingType)
    
    this.selectedBuildingType = buildingType
    
    // Clean up old preview if it exists
    if (this.buildingPreview) {
      this.buildingPreview.destroy()
      this.buildingPreview = null
    }
  
    // Create new preview based on Tiled template
    const templateKey = `${buildingType}-template`
    this.buildingPreview = new TiledBuildingPreview(this, templateKey)
  
    // Temporarily hide normal cursor
    if (this.uiScene) {
      this.uiScene.defaultCursor.setVisible(false)
      this.uiScene.hoverCursor.setVisible(false)
    }
  
    console.log('Building preview activated for:', buildingType)
  }

  private onBuildingDeselectedFromVue(): void {
    console.log('Building deselected from Vue')
    
    this.selectedBuildingType = null
    
    // Remove preview
    if (this.buildingPreview) {
      this.buildingPreview.destroy()
      this.buildingPreview = null
    }
  
    // Restore cursor
    if (this.uiScene) {
      this.uiScene.defaultCursor.setVisible(true)
    }
  }

  private onWorkerCreationFromVue(workerType: string, positionHint?: string | { x: number, y: number }): void {
    console.log('Worker creation requested from Vue:', workerType, positionHint)

    let spawnPosition = { x: 100, y: 100 }

    if (positionHint === 'near_player' && this.player) {
      spawnPosition = {
        x: this.player.x + 32 + Math.random() * 64 - 32,
        y: this.player.y + 32 + Math.random() * 64 - 32
      }
    } else if (typeof positionHint === 'object' && positionHint.x && positionHint.y) {
      spawnPosition = positionHint
    } else if (this.player) {
      spawnPosition = {
        x: this.player.x + 64,
        y: this.player.y
      }
    }

    let depositPoint: { x: number, y: number } | undefined = undefined

    if (this.buildingManager) {
      const buildings = this.buildingManager.getBuildings()
      const sawmills = buildings.filter(building => building.getType() === 'sawmill')

      if (sawmills.length > 0) {
        let closestSawmill = sawmills[0]
        let closestDistance = Phaser.Math.Distance.Between(
            spawnPosition.x, spawnPosition.y,
            closestSawmill.getPosition().x,
            closestSawmill.getPosition().y
        )

        for (let i = 1; i < sawmills.length; i++) {
          const distance = Phaser.Math.Distance.Between(
              spawnPosition.x, spawnPosition.y,
              sawmills[i].getPosition().x,
              sawmills[i].getPosition().y
          )
          if (distance < closestDistance) {
            closestSawmill = sawmills[i]
            closestDistance = distance
          }
        }

        const pos = closestSawmill.getPosition()
        const dim = closestSawmill.getDimensions()

        depositPoint = {
          x: pos.x + (dim.tilesWidth * 16) / 2,
          y: pos.y + dim.tilesHeight * 16 + 16
        }

        console.log('Deposit point configured at sawmill:', depositPoint)
      }
    }

    const worker = this.createWorkerAtPosition(workerType, spawnPosition.x, spawnPosition.y, depositPoint)

    if (worker) {
      // AMÉLIORATION: Notification avec plus de détails
      window.dispatchEvent(new CustomEvent('game:workerCreated', {
        detail: {
          worker,
          type: workerType,
          position: spawnPosition,
          depositPoint
        }
      }))

      console.log(`${workerType} created successfully at (${spawnPosition.x}, ${spawnPosition.y})`)
    } else {
      window.dispatchEvent(new CustomEvent('game:notification', {
        detail: {
          type: 'error',
          title: 'Erreur',
          message: `Impossible de créer ${workerType}`
        }
      }))
    }
  }

  public createWorker(type: WorkerType, x?: number, y?: number): Worker | null {
    const spawnX = x || this.player.x + 32;
    const spawnY = y || this.player.y;

    console.log(`MainScene: Creating worker ${type} at (${spawnX}, ${spawnY})`);

    // Trouver le point de dépôt le plus proche
    const depositPoint = this.findNearestDepositPoint(type, { x: spawnX, y: spawnY });

    const worker = this.workerManager.createWorker(type, spawnX, spawnY, depositPoint);

    if (worker) {
      console.log(`MainScene: Successfully created worker ${type}`);
    } else {
      console.error(`MainScene: Failed to create worker ${type}`);
    }

    return worker;
  }


// Méthode de test pour vérifier que tout fonctionne
  public testWorkerSystem(): void {
    console.log('=== TESTING WORKER SYSTEM ===');

    // Vérifier ResourceEntityManager
    if (this.resourceEntityManager) {
      const trees = this.resourceEntityManager.getEntitiesByType('tree');
      console.log(`Found ${trees.length} trees`);
      trees.forEach((tree, index) => {
        console.log(`Tree ${index}: (${tree.x}, ${tree.y})`);
      });
    } else {
      console.error('ResourceEntityManager not available!');
    }

    // Vérifier BuildingManager
    if (this.buildingManager) {
      const sawmills = this.buildingManager.getBuildingsByType('sawmill');
      console.log(`Found ${sawmills.length} sawmills`);
    } else {
      console.error('BuildingManager not available!');
    }

    // Vérifier WorkerManager
    if (this.workerManager) {
      console.log('WorkerManager is available');

      // Tester la création d'un worker
      const testWorker = this.createWorker(WorkerType.LUMBERJACK, this.player.x + 50, this.player.y);
      if (testWorker) {
        console.log('Test worker created successfully!');

        // Vérifier la configuration
        const config = testWorker.getConfig();
        console.log('Worker config:', config);
      } else {
        console.error('Failed to create test worker!');
      }
    } else {
      console.error('WorkerManager not available!');
    }

    console.log('=== END WORKER SYSTEM TEST ===');
  }

  private findNearestDepositPoint(workerType: WorkerType, position: WorkerPosition): WorkerPosition | undefined {
    // Pour l'instant, retourner une position par défaut
    // TODO: Améliorer avec la logique du BuildingManager
    return { x: position.x + 100, y: position.y };
  }


  private createWorkerAtPosition(
    workerType: string, 
    x: number, 
    y: number, 
    depositPoint?: { x: number, y: number }
  ): any {
    if (workerType === 'lumberjack') {
      return this.createLumberjack(x, y, depositPoint)
    }
    
    console.warn(`Worker type ${workerType} not implemented yet`)
    return null
  }

  public createLumberjack(x?: number, y?: number, depositPoint?: WorkerPosition): Worker | null {
    return this.createWorker(WorkerType.LUMBERJACK, x, y);
  }

  public pauseAllWorkers(): void {
    this.workerManager.pauseAllWorkers();
  }

  public resumeAllWorkers(): void {
    this.workerManager.resumeAllWorkers();
  }

  public getWorkerStats(): any {
    return this.workerManager.getWorkerStats();
  }

  private copyGrid(source: number[][]): number[][] {
    // Double "map" or slice to get deep copy
    return source.map(row => [...row])
  }

  private rebuildPathfindingGrid() {
    const fullGrid = this.copyGrid(this.baseGrid)

    // Add building collisions
    this.buildingManager.getBuildings().forEach(building => {
      const { x, y } = building.getPosition()
      const { tilesWidth, tilesHeight } = building.getDimensions()

      // Convert to tile indices
      const tileX = Math.floor(x / this.tileWidth)
      const tileY = Math.floor(y / this.tileHeight)

      // Get building's Tiled sub-map
      const buildingMap = building.getMap()

      buildingMap.layers.forEach(layerData => {
        const layer = buildingMap.getLayer(layerData.name)
        if (!layer) return

        for (let ty = 0; ty < layer.tilemapLayer.layer.height; ty++) {
          for (let tx = 0; tx < layer.tilemapLayer.layer.width; tx++) {
            const tile = layer.tilemapLayer.getTileAt(tx, ty)
            if (!tile) continue

            const hasCollidesProp = !!(tile.properties && tile.properties.collides)
            const tileData = tile.tileset.getTileData(tile.index)
            const hasCollisionShapes = tileData
              && tileData.objectgroup
              && tileData.objectgroup.objects
              && tileData.objectgroup.objects.length > 0

            if (hasCollidesProp || hasCollisionShapes) {
              const gx = tileX + tx
              const gy = tileY + ty

              if (gy >= 0 && gy < fullGrid.length && gx >= 0 && gx < fullGrid[0].length) {
                fullGrid[gy][gx] = 1
              }
            }
          }
        }
      })
    })

    this.resourceEntityManager.getAllEntities().forEach(entity => {
      if (entity.isBlockingPath()) {
        const pos = entity.getEntityTilePosition()
        if (pos.y >= 0 && pos.y < fullGrid.length &&
            pos.x >= 0 && pos.x < fullGrid[0].length) {
          fullGrid[pos.y][pos.x] = 1
        }
      }
    })

    this.easyStar.setGrid(fullGrid)
  }

  public showResourceError(message: string = 'Insufficient resources!'): void {
    // Show temporary error message
    const text = this.add.text(
      this.cameras.main.centerX,
      100,
      message,
      {
        fontSize: '24px',
        color: '#ff0000',
        backgroundColor: '#000000',
        padding: { x: 10, y: 5 }
      }
    )
      .setScrollFactor(0)
      .setOrigin(0.5)

    this.tweens.add({
      targets: text,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => text.destroy()
    })
  }

  private initializeBuildingSystem(): void {
    // Écouter les événements de sélection de bâtiment
    this.game.events.on('selectBuilding', this.onBuildingSelected, this);

    // Gérer le mouvement de la souris pour l'aperçu
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.buildingPreview) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.buildingPreview.updatePosition(worldPoint.x, worldPoint.y);
        this.checkPlacementValidity(worldPoint);
      }
    });

    // Gérer le clic pour placer le bâtiment
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.buildingPreview && this.buildingPreview.isValidPlacement()) {
        this.placeBuilding(pointer);
      }
    });
  }

  private markBuildingCollisions(building: TiledBuilding) {
    // Récupérer la sub-map Tiled du bâtiment
    const buildingMap = building.getMap();
    // Borne en tuiles dans la map principale
    const offsetX = Math.floor(building.getPosition().x / this.tileWidth);
    const offsetY = Math.floor(building.getPosition().y / this.tileHeight);

    // Pour chaque layer du buildingMap
    buildingMap.layers.forEach(layerData => {
      // Récupérer l'objet layer
      const layer = buildingMap.getLayer(layerData.name);
      if (!layer) return;

      // Parcourir toutes les tuiles
      for (let ty = 0; ty < layer.tilemapLayer.layer.height; ty++) {
        for (let tx = 0; tx < layer.tilemapLayer.layer.width; tx++) {
          const tile = layer.tilemapLayer.getTileAt(tx, ty);
          if (!tile) continue;

          // Si la tuile du bâtiment est bloquante
          const hasCollidesProp = !!(tile.properties && tile.properties.collides);
          const tileData = tile.tileset.getTileData(tile.index);
          const hasCollisionShapes = tileData
            && tileData.objectgroup
            && tileData.objectgroup.objects
            && tileData.objectgroup.objects.length > 0;

          if (hasCollidesProp || hasCollisionShapes) {
            // On convertit en coord. de la map globale
            const gx = offsetX + tx;
            const gy = offsetY + ty;

            // On marque dans baseGrid
            if (
              gy >= 0 && gy < this.baseGrid.length &&
              gx >= 0 && gx < this.baseGrid[0].length
            ) {
              this.baseGrid[gy][gx] = 1;
            }
          }
        }
      }
    });
  }


  private checkPlacementValidity(worldPoint: Phaser.Math.Vector2): void {
    if (!this.buildingPreview || !this.map) return;

    const tileX = Math.floor(worldPoint.x / 16);
    const tileY = Math.floor(worldPoint.y / 16);

    const { tilesWidth, tilesHeight } = this.buildingPreview.getDimensions();

    let isValid = true;

    // 1. Vérifier les limites de la carte
    if (tileX < 0 || tileY < 0 ||
      tileX + tilesWidth > this.map.width ||
      tileY + tilesHeight > this.map.height) {
      isValid = false;
    } else {
      // 2. Vérifier les collisions pour chaque tile dans la zone
      for (let x = 0; x < tilesWidth; x++) {
        for (let y = 0; y < tilesHeight; y++) {
          const currentTileX = tileX + x;
          const currentTileY = tileY + y;

          // Vérifier chaque layer
          for (const [layerName, config] of this.mapLayers.entries()) {
            const layer = config.layer;
            const tile = layer.getTileAt(currentTileX, currentTileY);

            if (tile) {
              // Vérifier les collisions standards (propriété collides)
              if (config.hasCollision && tile.properties && tile.properties.collides) {
                isValid = false;
                break;
              }

              // Vérifier si le tile a une collision personnalisée
              if (tile.tileset) {  // Vérifier que le tile a un tileset
                const customCollisions = tile.tileset.getTileData(tile.index);
                if (customCollisions && customCollisions.objectgroup) {
                  isValid = false;
                  break;
                }
              }
            }
          }

          if (!isValid) break;

          // 3. Vérifier les collisions avec les autres bâtiments
          const hasBuildingCollision = this.buildings.some(building => {
            const pos = building.getPosition();
            const buildingTileX = Math.floor(pos.x / 16);
            const buildingTileY = Math.floor(pos.y / 16);
            const dims = building.getDimensions();

            return currentTileX >= buildingTileX &&
              currentTileX < buildingTileX + dims.tilesWidth &&
              currentTileY >= buildingTileY &&
              currentTileY < buildingTileY + dims.tilesHeight;
          });

          if (hasBuildingCollision) {
            isValid = false;
            break;
          }
        }
        if (!isValid) break;
      }
    }

    // Debug en mode développement
    if (process.env.NODE_ENV === 'development') {
      const worldTileX = Math.floor(worldPoint.x / 16);
      const worldTileY = Math.floor(worldPoint.y / 16);
      console.debug('Placement check:', {
        position: { x: worldTileX, y: worldTileY },
        isValid,
        reason: !isValid ? 'Collision detected' : 'Valid placement'
      });
    }

    this.buildingPreview.setValidPlacement(isValid);
  }

  private onBuildingSelected(buildingType: string): void {
    this.selectedBuildingType = buildingType;

    // Supprimer l'ancien aperçu s'il existe
    if (this.buildingPreview) {
      this.buildingPreview.destroy();
    }

    // Créer un nouvel aperçu en utilisant le template Tiled
    const templateKey = `${buildingType}-template`;
    this.buildingPreview = new TiledBuildingPreview(this, templateKey);

    // Masquer temporairement le curseur normal
    if (this.uiScene) {
      this.uiScene.defaultCursor.setVisible(false);
      this.uiScene.hoverCursor.setVisible(false);
    }
  }

  private placeBuilding(pointer: Phaser.Input.Pointer): void {
    if (!this.buildingPreview || !this.selectedBuildingType) return

    if (this.buildingPreview.isValidPlacement()) {
      if (!this.canAffordBuilding(this.selectedBuildingType)) {
        console.log('Cannot afford building anymore')

        window.dispatchEvent(new CustomEvent('game:notification', {
          detail: {
            type: 'error',
            title: 'Ressources insuffisantes',
            message: 'Vous n\'avez plus assez de ressources pour ce bâtiment'
          }
        }))

        this.onBuildingDeselectedFromVue()
        window.dispatchEvent(new CustomEvent('game:buildingPlacementCancelled'))
        return
      }

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
      const snappedX = Math.floor(worldPoint.x / 16) * 16
      const snappedY = Math.floor(worldPoint.y / 16) * 16

      // Obtenir le coût avant déduction pour la notification
      const cost = this.getBuildingCost(this.selectedBuildingType)

      // Déduire les ressources
      this.deductBuildingCost(this.selectedBuildingType)

      const newBuilding = this.buildingManager.placeBuilding(
          this.selectedBuildingType,
          snappedX,
          snappedY
      )

      this.markBuildingCollisions(newBuilding)
      this.rebuildPathfindingGrid()

      // AMÉLIORATION: Notification détaillée avec coût
      window.dispatchEvent(new CustomEvent('game:buildingPlaced', {
        detail: {
          building: newBuilding,
          type: this.selectedBuildingType,
          cost: cost,
          position: { x: snappedX, y: snappedY }
        }
      }))

      window.dispatchEvent(new CustomEvent('game:buildingPlacementComplete', {
        detail: {
          buildingType: this.selectedBuildingType,
          resourcesDeducted: cost
        }
      }))

      this.buildingPreview.destroy()
      this.buildingPreview = null
      this.selectedBuildingType = null

      if (this.uiScene) {
        this.uiScene.defaultCursor.setVisible(true)
      }

      console.log('Building placed and resources deducted:', cost)
    } else {
      console.log('Invalid building placement')

      if (this.buildingPreview) {
        this.buildingPreview.flashInvalid()
      }
    }
  }

  public forceSyncWithVue(): void {
    try {
      this.triggerInitialResourceSync();
    } catch (error) {
      console.error('Error forcing sync with Vue:', error);
    }
  }

  public getResourcesSnapshot(): Record<string, number> {
    try {
      const inventory = this.resourceManager.getGlobalInventory();
      const resources: Record<string, number> = {};

      inventory.getAllResources().forEach((amount, type) => {
        resources[type] = amount;
      });

      return resources;
    } catch (error) {
      console.error('Error getting resources snapshot:', error);
      return {};
    }
  }

  private canAffordBuilding(buildingType: string): boolean {
    const buildingRegistry = BuildingRegistry.getInstance()
    const cost = buildingRegistry.getBuildingCost(buildingType)
    return this.resourceManager.canAfford(cost)
  }

  private deductBuildingCost(buildingType: string): void {
    const buildingRegistry = BuildingRegistry.getInstance()
    const cost = buildingRegistry.getBuildingCost(buildingType)
    this.resourceManager.deductCost(cost, 'building_construction')
  }

  public deductCost(cost: Partial<Record<ResourceType, number>>, source?: string): boolean {
    return this.resourceManager.deductCost(cost, source || 'building_purchase')
  }

  private getBuildingCost(buildingType: string): Record<string, number> {
    return this.buildingRegistry.getBuildingCost(buildingType);
  }

  private findNearestWalkableTile(targetX: number, targetY: number): { x: number, y: number } | null {
    // Distance maximale de recherche
    const maxSearchDistance = 5;

    // Explorer en spirale autour du point cible
    for (let d = 1; d <= maxSearchDistance; d++) {
      // Vérifier toutes les tuiles à la distance d
      for (let offsetY = -d; offsetY <= d; offsetY++) {
        for (let offsetX = -d; offsetX <= d; offsetX++) {
          // Ne vérifier que les tuiles sur le "périmètre" du carré actuel
          if (Math.abs(offsetX) === d || Math.abs(offsetY) === d) {
            const checkX = targetX + offsetX;
            const checkY = targetY + offsetY;

            // Vérifier que la tuile est dans les limites de la map
            if (checkX >= 0 && checkX < this.map.width &&
              checkY >= 0 && checkY < this.map.height) {

              // Vérifier si la tuile est marchable (= 0 dans notre grille)
              if (this.baseGrid[checkY][checkX] === 0) {
                return { x: checkX, y: checkY };
              }
            }
          }
        }
      }
    }

    return null; // Aucune tuile marchable trouvée dans le rayon de recherche
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

  destroy(): void {
    // Cleanup animations for this scene
    this.animationRegistry.cleanupSceneAnimations(this)
    super.destroy()
  }

  update() {
    this.player.update()
    this.resourceEntityManager.updateEntities()
    this.buildingManager.updateBuildings(this.player)
    this.workerManager.update();

    if (process.env.NODE_ENV === 'development') {
      this.debugResourceSync();
    }
  }

  private debugResourceSync(): void {
    // Vérifier la synchronisation toutes les 5 secondes en mode dev
    if (!this.lastSyncCheck) {
      this.lastSyncCheck = Date.now();
    }

    if (Date.now() - this.lastSyncCheck > 5000) {
      this.lastSyncCheck = Date.now();

      try {
        const totalResources = this.resourceManager.getGlobalInventory().getTotalItems();
        console.log('Current total resources:', totalResources);

        // Émettre un événement de debug
        window.dispatchEvent(new CustomEvent('game:resourceDebug', {
          detail: {
            totalResources,
            snapshot: this.getResourcesSnapshot()
          }
        }));
      } catch (error) {
        console.error('Error in resource sync debug:', error);
      }
    }
  }

}