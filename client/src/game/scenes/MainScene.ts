import { Scene } from 'phaser'
import EasyStar from 'easystarjs'
import { Player } from '../objects/Player'
import { Tree } from '../objects/Tree';
import { DialogService } from '../services/DialogService';
import { BuildingPreview } from '../objects/BuildingPreview';
import { Building } from '../objects/Building';
import { BuildingManager } from '../services/BuildingManager';
import { TiledBuildingPreview } from '../objects/TiledBuildingPreview';
import type { TiledBuilding } from '../objects/TiledBuilding';
import { WorkerManager } from '../services/WorkerManager';
import { Lumberjack } from '../objects/workers/Lumberjack';
import { PlayerInventory } from '../services/PlayerInventory';
import { ResourceManager } from '../services/ResourceManager';
import { ResourceType } from '../types/ResourceTypes';

interface LayerConfig {
  layer: Phaser.Tilemaps.TilemapLayer;
  hasCollision: boolean;
  isAbovePlayer: boolean;
}

export class MainScene extends Scene {
  private STORAGE_KEY = 'BUILDINGS_STORAGE';
  private player!: Player;
  private map!: Phaser.Tilemaps.Tilemap;
  private mapLayers: Map<string, LayerConfig> = new Map();
  private trees: Tree[] = [];
  private woodCount: number = 0;
  private woodText!: Phaser.GameObjects.Text;
  private dialogService!: DialogService;
  private targetWood: number = 5;
  private hasShownCompletionDialog: boolean = false;
  private buildingPreview: BuildingPreview | null = null;
  private selectedBuildingType: string | null = null;
  private buildings: Building[] = [];
  private buildingManager!: BuildingManager;
  private resources = {
    wood: 0
  };
  private easyStar: EasyStar.js;
  private tileWidth: number = 16;
  private tileHeight: number = 16;
  private baseGrid: number[][] = [];
  public playerInventory!: PlayerInventory;
  private resourceManager!: ResourceManager;

  private workerManager!: WorkerManager;

  constructor() {
    super({ key: 'MainScene' })
    this.easyStar = new EasyStar.js();
  }

  preload() {
    this.load.setBaseURL('/assets/')
    
    // Utiliser le ResourceManager pour charger les textures des ressources
    const resourceManager = ResourceManager.getInstance();
    resourceManager.prepareSceneLoading(this);

    // Ensuite charger les autres assets
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

    this.load.image('house', 'buildings/house.png');
    this.load.image('sawmill', 'buildings/sawmill.png');

    this.load.tilemapTiledJSON('house-template', 'buildings/templates/house-template.json');
    this.load.tilemapTiledJSON('sawmill-template', 'buildings/templates/sawmill-template.json');

    // Charger les icônes pour l'UI
    this.load.image('house-icon', 'ui/icons/house.png');
    this.load.image('sawmill-icon', 'ui/icons/sawmill.png');
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
    this.player = new Player(this, 830, 700)
    this.player.setScale(1)

    // Initialiser le gestionnaire de ressources et l'inventaire
    this.resourceManager = ResourceManager.getInstance();
    this.playerInventory = new PlayerInventory();

    // Lancer l'UI des ressources
    this.scene.launch('ResourceUI');

    // Écouter l'événement d'ajout de bois (adapter pour le nouveau système)
    this.events.on('addWood', (amount: number) => {
      const added = this.playerInventory.addResource(ResourceType.WOOD, amount);

      // Mettre à jour l'UI des ressources
      const resourceUI = this.scene.get('ResourceUI') as any;
      if (resourceUI) {
        resourceUI.updateResourceDisplay();
      }

      console.log(`Ajouté ${added} bois. Total: ${this.playerInventory.getResource(ResourceType.WOOD)}`);
    });

    // Création et configuration automatique des layers
    allLayers.forEach(layerData => {
      const layer = this.map.createLayer(layerData.name, tileset, 0, 0);
      if (!layer) return;

      const properties = this.getTiledProperties(layerData);
      const hasCollision = properties.hasCollision ?? false;
      const isAbovePlayer = properties.isAbovePlayer ?? false;

      if (hasCollision) {
        // SetCollisionByProperty => On active la collision sur ces tuiles
        layer.setCollisionByProperty({ collides: true });
        //this.physics.add.collider(this.player, layer);
      }

      if (isAbovePlayer) {
        layer.setDepth(10);
      }

      this.mapLayers.set(layerData.name, {
        layer,
        hasCollision,
        isAbovePlayer
      });
    });

    // Configuration du joueur
    this.player.setDepth(1)

    // Configuration de la caméra
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

    const minDimension = Math.min(window.innerWidth, window.innerHeight)
    const zoomLevel = minDimension / 280 // Ajustez 800 selon vos besoins
    this.cameras.main.setZoom(Math.min(3.3, zoomLevel)) // Limite le zoom maximum à 2

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
    this.events.on('addWood', (amount: number) => {
      this.resources.wood += amount;
      this.events.emit('resourcesUpdated', this.resources);
    });

    this.game.events.on('selectBuilding', (buildingType: string) => {
      const buildingUI = this.scene.get('BuildingUI') as BuildingUI;

      if (buildingUI.canAffordBuilding(buildingType, this.resources)) {
        this.selectedBuildingType = buildingType;
        // Créer l'aperçu basé sur le template Tiled
        if (this.buildingPreview) {
          this.buildingPreview.destroy();
        }
        this.buildingPreview = new TiledBuildingPreview(
          this,
          buildingType
        );
      } else {
        // Afficher un message d'erreur
        this.showResourceError();
      }
    });

    // Écouter l'événement de nettoyage
    this.game.events.on('clearBuildings', () => {
      this.buildingManager.clearAll();
    });


    this.initializeBuildingSystem();

    // Démarrer la scène UI des bâtiments
    this.scene.launch('BuildingUI');

    // Dans la méthode create() de MainScene
    if (process.env.NODE_ENV === 'development' && false) {
      this.mapLayers.forEach((config, name) => {
        if (config.hasCollision) {
          const layer = this.map.getLayer(name).tilemapLayer;
          const debugGraphics = this.add.graphics().setAlpha(0.75);
          layer.renderDebug(debugGraphics, {
            tileColor: null,
            collidingTileColor: new Phaser.Display.Color(243, 134, 48, 255),
            faceColor: new Phaser.Display.Color(40, 39, 37, 255)
          });
        }
      });
    }

    this.buildingManager = new BuildingManager(this);
    this.workerManager = new WorkerManager(this);
    this.buildingManager.loadState();
    this.rebuildPathfindingGrid();

    this.baseGrid = Array.from(
      { length: this.map.height },
      () => Array(this.map.width).fill(0)
    );

    // Parcourt chaque layer ayant hasCollision = true
    this.mapLayers.forEach((layerConfig) => {
      if (!layerConfig.hasCollision) return; // On ignore ceux sans collision
      const layer = layerConfig.layer;
      for (let y = 0; y < this.map.height; y++) {
        for (let x = 0; x < this.map.width; x++) {
          const tile = layer.getTileAt(x, y);
          if (!tile) continue;

          // Premier critère : la propriété "collides" au niveau de la tuile
          const hasCollidesProp = !!(tile.properties && tile.properties.collides);

          // Deuxième critère : objectgroup dans le tileset (collision shapes)
          const tileData = tile.tileset.getTileData(tile.index);
          const hasCollisionShapes = tileData
            && tileData.objectgroup
            && tileData.objectgroup.objects
            && tileData.objectgroup.objects.length > 0;

          if (hasCollidesProp || hasCollisionShapes) {
            this.baseGrid[y][x] = 1; // On marque la tuile comme bloquée
          }
        }
      }
    });


    // Ensuite on assigne cette grille globale à easystar
    const fullGrid = this.copyGrid(this.baseGrid);
    this.easyStar.setGrid(fullGrid);
    this.easyStar.setAcceptableTiles([0]);
    this.easyStar.enableDiagonals();
    this.easyStar.setIterationsPerCalculation(10000);
    //this.easyStar.enableCornerCutting();
    this.easyStar.disableCornerCutting();

    // ----------------- ÉCOUTE DU CLIC SOURIS POUR LE DÉPLACEMENT -----------------
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Convertir la position du clic en coordonnée de tuile
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      let targetTileX = Math.floor(worldPoint.x / this.tileWidth);
      let targetTileY = Math.floor(worldPoint.y / this.tileHeight);

      // Récupérer la position "tuile" du joueur
      const playerTileX = Math.floor(this.player.x / this.tileWidth);
      const playerTileY = Math.floor(this.player.y / this.tileHeight);

      // Si la tuile cible a une collision, chercher la plus proche tuile accessible
      if (this.baseGrid[targetTileY][targetTileX] === 1) {
        const nearestTile = this.findNearestWalkableTile(targetTileX, targetTileY);
        if (nearestTile) {
          targetTileX = nearestTile.x;
          targetTileY = nearestTile.y;
        } else {
          console.log('Aucune tuile accessible trouvée à proximité');
          return;
        }
      }

      // Calculer un chemin avec EasyStar
      this.easyStar.findPath(
        playerTileX,
        playerTileY,
        targetTileX,
        targetTileY,
        (path) => {
          if (path === null) {
            console.log('Aucun chemin trouvé !');
          } else {
            this.player.setPath(path);
          }
        }
      );

      this.easyStar.calculate();
    });

    this.rebuildPathfindingGrid()
  }

  // Méthode utilitaire pour ajouter des ressources
  public addResource(type: ResourceType, amount: number): void {
    const added = this.playerInventory.addResource(type, amount);

    // Mettre à jour l'UI
    const resourceUI = this.scene.get('ResourceUI') as any;
    if (resourceUI) {
      resourceUI.updateResourceDisplay();
    }

    // Émettre un événement pour les autres systèmes
    this.events.emit('resourceChanged', type, this.playerInventory.getResource(type));
  }

  public createLumberjack(x: number, y: number, depositPoint?: { x: number, y: number }): void {
    this.workerManager.createLumberjack(x, y, depositPoint);
  }

  private copyGrid(source: number[][]): number[][] {
    // Double "map" ou slice pour avoir une copie en profondeur
    return source.map(row => [...row]);
  }

  private rebuildPathfindingGrid() {
    const fullGrid = this.copyGrid(this.baseGrid);

    // Ajouter les collisions des bâtiments
    this.buildingManager.getBuildings().forEach(building => {
      const { x, y } = building.getPosition();
      const { tilesWidth, tilesHeight } = building.getDimensions();

      // Convertir en indices de tuiles
      const tileX = Math.floor(x / this.tileWidth);
      const tileY = Math.floor(y / this.tileHeight);

      // Récupérer la sub-map Tiled du bâtiment
      const buildingMap = building.getMap();

      buildingMap.layers.forEach(layerData => {
        const layer = buildingMap.getLayer(layerData.name);
        if (!layer) return;

        for (let ty = 0; ty < layer.tilemapLayer.layer.height; ty++) {
          for (let tx = 0; tx < layer.tilemapLayer.layer.width; tx++) {
            const tile = layer.tilemapLayer.getTileAt(tx, ty);
            if (!tile) continue;

            const hasCollidesProp = !!(tile.properties && tile.properties.collides);
            const tileData = tile.tileset.getTileData(tile.index);
            const hasCollisionShapes = tileData
              && tileData.objectgroup
              && tileData.objectgroup.objects
              && tileData.objectgroup.objects.length > 0;

            if (hasCollidesProp || hasCollisionShapes) {
              const gx = tileX + tx;
              const gy = tileY + ty;

              if (gy >= 0 && gy < fullGrid.length && gx >= 0 && gx < fullGrid[0].length) {
                fullGrid[gy][gx] = 1;
              }
            }
          }
        }
      });
    });

    // Ajouter les collisions des arbres (vivants ou souches)
    this.trees.forEach(tree => {
      // Récupérer la position en tuiles
      const pos = tree.getTreeTilePosition();

      // Si l'entité bloque le passage (arbre ou souche)
      if (tree.isBlockingPath()) {
        // Ajouter la collision dans la grille
        if (pos.y >= 0 && pos.y < fullGrid.length &&
          pos.x >= 0 && pos.x < fullGrid[0].length) {
          fullGrid[pos.y][pos.x] = 1;
        }
      }
    });

    this.easyStar.setGrid(fullGrid);
  }

  public showResourceError(message: string = 'Ressources insuffisantes!'): void {
    // Afficher un message d'erreur temporaire
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
      .setOrigin(0.5);

    this.tweens.add({
      targets: text,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
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
    if (!this.buildingPreview || !this.selectedBuildingType) return;

    if (this.buildingPreview.isValidPlacement()) {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const snappedX = Math.floor(worldPoint.x / 16) * 16;
      const snappedY = Math.floor(worldPoint.y / 16) * 16;

      // Placer le bâtiment une seule fois
      const newBuilding = this.buildingManager.placeBuilding(
        this.selectedBuildingType,
        snappedX,
        snappedY
      );

      // Marquer les collisions et mettre à jour la grille de pathfinding
      this.markBuildingCollisions(newBuilding);
      this.rebuildPathfindingGrid();

      // Réinitialiser l'aperçu 
      this.buildingPreview.destroy();
      this.buildingPreview = null;
      this.selectedBuildingType = null;

      // Restaurer le curseur
      if (this.uiScene) {
        this.uiScene.defaultCursor.setVisible(true);
      }
    }
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

  update() {
    this.player.update()
    this.trees.forEach(tree => tree.update())
    this.trees = this.trees.filter(tree => tree.scene)
    this.buildingManager.updateBuildings(this.player);
    this.workerManager.updateWorkers();
  }
}