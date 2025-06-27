import { Scene } from 'phaser';
type Scene = typeof Scene;

import { BuildingInfoUI } from '../ui/BuildingInfoUI';
import {
    ResourceType,
    type ResourceStorage,
    createResourceStorage,
    type BuildingPosition,
    type BuildingDimensions
} from '../types';
import { ResourceManager } from '../services/ResourceManager';

interface BuildingZone {
    readonly zone: Phaser.GameObjects.Zone;
    readonly layersToHide: readonly string[];
    readonly depthChanges: Readonly<Record<string, number>>;
}

interface LayerState {
    baseDepth: number;
    currentDepth: number;
    currentAlpha: number;
    readonly activeZones: Set<BuildingZone>;
}

interface BuildingInteractionConfig {
    readonly playerStationaryTime: number;
    readonly movementTolerance: number;
    readonly interactionCooldown: number;
}

export class TiledBuilding {
    private readonly scene: Scene;
    private readonly buildingType: string;
    private readonly position: BuildingPosition;
    private readonly resourceManager: ResourceManager;
    private readonly config: BuildingInteractionConfig;

    private readonly layers: Phaser.Tilemaps.TilemapLayer[] = [];
    private readonly map: Phaser.Tilemaps.Tilemap;
    private readonly tileset: Phaser.Tilemaps.Tileset;
    private readonly collisionBodies: Phaser.Physics.Arcade.Body[] = [];
    private readonly interactiveZones: BuildingZone[] = [];
    private readonly layerStates = new Map<string, LayerState>();

    private playerInside: boolean = false;
    private playerStationaryTimer: Phaser.Time.TimerEvent | null = null;
    private lastPlayerPosition: BuildingPosition | null = null;
    private lastInteractionTime: number = 0;

    private readonly resourceStorage: ResourceStorage;

    constructor(scene: Scene, x: number, y: number, templateKey: string) {
        this.scene = scene;
        this.position = { x, y };
        this.buildingType = templateKey.replace('-template', '');
        this.resourceManager = ResourceManager.getInstance();
        
        this.config = {
            playerStationaryTime: 500,
            movementTolerance: 8,
            interactionCooldown: 1000
        };

        try {
            this.map = scene.make.tilemap({ key: templateKey });
            this.tileset = this.initializeTileset();
            this.resourceStorage = this.initializeStorage();
            
            this.createLayers(x, y);
            this.setupInteractiveZones(x, y);
            
        } catch (error) {
            console.error('Erreur lors de la création du bâtiment:', error);
            throw error;
        }
    }

    private initializeTileset(): Phaser.Tilemaps.Tileset {
        const tilesetName = this.map.tilesets[0]?.name;
        if (!tilesetName) {
            throw new Error(`Aucun tileset trouvé dans le template ${this.buildingType}`);
        }
        
        const tileset = this.map.addTilesetImage(tilesetName, 'tiles');
        if (!tileset) {
            throw new Error(`Impossible d'ajouter le tileset ${tilesetName}`);
        }
        
        return tileset;
    }

    private initializeStorage(): ResourceStorage {
        const storageConfig = this.getStorageConfig();
        return createResourceStorage(storageConfig);
    }

    private getStorageConfig(): Record<ResourceType, number> {
        const configs: Record<string, Record<ResourceType, number>> = {
            sawmill: {
                [ResourceType.WOOD]: 200,
                [ResourceType.PLANKS]: 100
            },
            house: {
                [ResourceType.FOOD]: 50
            },
            mine: {
                [ResourceType.STONE]: 150,
                [ResourceType.METAL]: 50
            }
        };

        return configs[this.buildingType] || {};
    }

    private createLayers(x: number, y: number): void {
        this.map.layers.forEach(layerData => {
            const layer = this.map.createLayer(layerData.name, this.tileset, x, y);
            
            if (layer) {
                const properties = this.extractLayerProperties(layerData);
                const baseDepth = properties.depth ?? 0;
                
                layer.setDepth(baseDepth);
                
                this.layerStates.set(layerData.name, {
                    baseDepth,
                    currentDepth: baseDepth,
                    currentAlpha: 1,
                    activeZones: new Set()
                });
                
                this.layers.push(layer);
                this.setupTileCollisions(layer, x, y);
            }
        });
    }

    private extractLayerProperties(layerData: Phaser.Tilemaps.LayerData): Record<string, any> {
        const properties: Record<string, any> = {};
        
        if (layerData.properties && Array.isArray(layerData.properties)) {
            layerData.properties.forEach(prop => {
                properties[prop.name] = prop.value;
            });
        }
        
        return properties;
    }

    private setupInteractiveZones(x: number, y: number): void {
        const objectLayer = this.map.getObjectLayer('Zones');
        if (!objectLayer) return;

        objectLayer.objects.forEach(obj => {
            if (obj.type === 'entrance') {
                const zone = this.createZone(obj, x, y);
                const buildingZone = this.createBuildingZone(obj, zone);
                
                this.interactiveZones.push(buildingZone);
                this.setupZoneDebugVisual(zone, obj);
            }
        });
    }

    private createZone(obj: any, x: number, y: number): Phaser.GameObjects.Zone {
        const zone = this.scene.add.zone(
            x + obj.x! + obj.width! / 2,
            y + obj.y! + obj.height! / 2,
            obj.width,
            obj.height
        );

        this.scene.physics.world.enable(zone);
        const body = zone.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.moves = false;

        return zone;
    }

    private createBuildingZone(obj: any, zone: Phaser.GameObjects.Zone): BuildingZone {
        const depthChanges = this.parseDepthChanges(obj);
        const layersToHide = this.parseLayersToHide(obj);

        return {
            zone,
            layersToHide,
            depthChanges
        };
    }

    private parseDepthChanges(obj: any): Record<string, number> {
        const depthChanges: Record<string, number> = {};
        const depthChangesProp = obj.properties?.find(p => p.name === 'depthChanges')?.value;
        
        if (depthChangesProp) {
            depthChangesProp.split(',').forEach((change: string) => {
                const [layerName, depth] = change.split(':');
                const layerKey = layerName.trim();
                const depthValue = parseInt(depth);
                
                if (!isNaN(depthValue)) {
                    depthChanges[layerKey] = depthValue;
                }
            });
        }

        return depthChanges;
    }

    private parseLayersToHide(obj: any): string[] {
        return obj.properties?.find(p => p.name === 'hideLayerNames')?.value?.split(',')?.map((name: string) => name.trim()) || [];
    }

    private setupZoneDebugVisual(zone: Phaser.GameObjects.Zone, obj: any): void {
        if (process.env.NODE_ENV === 'development') {
            this.scene.add.rectangle(
                zone.x,
                zone.y,
                zone.width,
                zone.height,
                0xff0000,
                0.2
            ).setOrigin(0.5, 0.5);
        }
    }

    private setupTileCollisions(layer: Phaser.Tilemaps.TilemapLayer, offsetX: number, offsetY: number): void {
        for (let y = 0; y < layer.layer.height; y++) {
            for (let x = 0; x < layer.layer.width; x++) {
                const tile = layer.getTileAt(x, y);
                if (!tile) continue;

                const collisionData = this.tileset.getTileCollisionGroup(tile.index);
                this.processTileCollisions(collisionData, tile, x, y, offsetX, offsetY);
            }
        }
    }

    private processTileCollisions(
        collisionData: any, 
        tile: Phaser.Tilemaps.Tile, 
        tileX: number, 
        tileY: number, 
        offsetX: number, 
        offsetY: number
    ): void {
        if (!collisionData?.objects?.length) return;

        collisionData.objects.forEach((collisionObject: any) => {
            const collisionX = offsetX + tileX * this.map.tileWidth + collisionObject.x;
            const collisionY = offsetY + tileY * this.map.tileHeight + collisionObject.y;

            const collisionBody = this.createCollisionBody(collisionObject, collisionX, collisionY);
            if (collisionBody) {
                this.collisionBodies.push(collisionBody);
            }
        });
    }

    private createCollisionBody(collisionObject: any, x: number, y: number): Phaser.Physics.Arcade.Body | null {
        let gameObject: Phaser.GameObjects.GameObject | null = null;

        if (collisionObject.rectangle) {
            gameObject = this.scene.add.rectangle(
                x + collisionObject.width / 2,
                y + collisionObject.height / 2,
                collisionObject.width,
                collisionObject.height
            );
        } else if (collisionObject.polygon) {
            const points = collisionObject.polygon.map((point: any) => 
                new Phaser.Geom.Point(point.x, point.y)
            );
            gameObject = this.scene.add.polygon(x, y, points, 0x000000, 0);
        }

        if (gameObject) {
            this.scene.physics.add.existing(gameObject, true);
            return gameObject.body as Phaser.Physics.Arcade.Body;
        }

        return null;
    }

    public update(player: Phaser.Physics.Arcade.Sprite): void {
        this.resetActiveZones();
        
        const playerCurrentlyInside = this.checkPlayerInZones(player);
        this.updatePlayerInteraction(player, playerCurrentlyInside);
        this.updateLayerEffects();
    }

    private resetActiveZones(): void {
        this.layerStates.forEach(state => {
            state.activeZones.clear();
        });
    }

    private checkPlayerInZones(player: Phaser.Physics.Arcade.Sprite): boolean {
        let playerInside = false;
        
        this.interactiveZones.forEach(zone => {
            const isOverlapping = this.scene.physics.overlap(player, zone.zone);
            
            if (isOverlapping) {
                playerInside = true;
                this.activateZoneEffects(zone);
                
                if (!this.playerInside && zone.layersToHide.length > 0) {
                    this.onPlayerEnter(player);
                }
                
                this.checkPlayerStationary(player);
            }
        });

        return playerInside;
    }

    private activateZoneEffects(zone: BuildingZone): void {
        this.layers.forEach(layer => {
            const layerState = this.layerStates.get(layer.layer.name);
            if (layerState) {
                layerState.activeZones.add(zone);
            }
        });
    }

    private updatePlayerInteraction(player: Phaser.Physics.Arcade.Sprite, playerCurrentlyInside: boolean): void {
        if (!playerCurrentlyInside && this.playerInside) {
            this.onPlayerExit();
        }
        
        this.playerInside = playerCurrentlyInside;
    }

    private updateLayerEffects(): void {
        this.layers.forEach(layer => {
            const layerState = this.layerStates.get(layer.layer.name);
            if (!layerState) return;

            this.updateLayerVisibility(layer, layerState);
            this.updateLayerDepth(layer, layerState);
        });
    }

    private updateLayerVisibility(layer: Phaser.Tilemaps.TilemapLayer, layerState: LayerState): void {
        const shouldBeHidden = Array.from(layerState.activeZones).some(zone => 
            zone.layersToHide.includes(layer.layer.name)
        );

        const targetAlpha = shouldBeHidden ? 0 : 1;
        
        if (layerState.currentAlpha !== targetAlpha) {
            this.scene.tweens.add({
                targets: layer,
                alpha: targetAlpha,
                duration: 150,
                onUpdate: () => {
                    layerState.currentAlpha = layer.alpha;
                }
            });
        }
    }

    private updateLayerDepth(layer: Phaser.Tilemaps.TilemapLayer, layerState: LayerState): void {
        let highestDepthChange = layerState.baseDepth;

        layerState.activeZones.forEach(zone => {
            const depthChange = zone.depthChanges[layer.layer.name];
            if (depthChange !== undefined) {
                highestDepthChange = Math.max(highestDepthChange, depthChange);
            }
        });

        if (layerState.currentDepth !== highestDepthChange) {
            layer.setDepth(highestDepthChange);
            layerState.currentDepth = highestDepthChange;
        }
    }

    private onPlayerEnter(player: Phaser.Physics.Arcade.Sprite): void {
        this.lastPlayerPosition = { x: player.x, y: player.y };
    }
    
    private onPlayerExit(): void {
        this.scene.time.delayedCall(200, () => {
            if (!this.isPlayerStillInside()) {
                this.cleanupPlayerInteraction();
                this.closeBuildingInterface();
            }
        });
    }

    private isPlayerStillInside(): boolean {
        const player = (this.scene as any).player;
        if (!player) return false;

        return this.interactiveZones.some(zone => 
            this.scene.physics.overlap(player, zone.zone)
        );
    }

    private cleanupPlayerInteraction(): void {
        this.playerStationaryTimer?.destroy();
        this.playerStationaryTimer = null;
        this.lastPlayerPosition = null;
    }

    private closeBuildingInterface(): void {
        window.dispatchEvent(new CustomEvent('game:hideBuildingInfo'));
    }
    
    private checkPlayerStationary(player: Phaser.Physics.Arcade.Sprite): void {
        if (!this.lastPlayerPosition) {
            this.lastPlayerPosition = { x: player.x, y: player.y };
            return;
        }
        
        const distance = Phaser.Math.Distance.Between(
            this.lastPlayerPosition.x,
            this.lastPlayerPosition.y,
            player.x,
            player.y
        );
        
        if (distance > this.config.movementTolerance) {
            this.lastPlayerPosition = { x: player.x, y: player.y };
            this.resetStationaryTimer();
        } else if (!this.playerStationaryTimer) {
            this.startStationaryTimer();
        }
    }

    private resetStationaryTimer(): void {
        this.playerStationaryTimer?.destroy();
        this.playerStationaryTimer = null;
    }

    private startStationaryTimer(): void {
        this.playerStationaryTimer = this.scene.time.delayedCall(
            this.config.playerStationaryTime, 
            () => this.openBuildingInterface()
        );
    }
    
    private openBuildingInterface(): void {
        const currentTime = Date.now();
        if (currentTime - this.lastInteractionTime < this.config.interactionCooldown) {
            return;
        }
    
        this.lastInteractionTime = currentTime;

        window.dispatchEvent(new CustomEvent('game:buildingInfo', {
            detail: { building: this }
        }));
    }

    private createBuildingUIScene(): void {
        this.scene.scene.add('BuildingInfoUI', BuildingInfoUI, true);
        
        this.scene.time.delayedCall(100, () => {
            const newBuildingUI = this.scene.scene.get('BuildingInfoUI') as BuildingInfoUI;
            newBuildingUI?.showBuildingInfo(this);
        });
    }

    public setupCollisions(player: Phaser.Physics.Arcade.Sprite): void {
        this.collisionBodies.forEach(body => {
            // Les collisions sont désactivées pour permettre le passage
            // this.scene.physics.add.collider(player, body);
        });
    }

    // API publique pour les ressources
    public addResourceToBuilding(type: ResourceType, amount: number): number {
        const currentStored = this.resourceStorage.stored.get(type) || 0;
        const capacity = this.resourceStorage.capacity.get(type) || 0;
        const canAdd = Math.min(amount, capacity - currentStored);
        
        if (canAdd > 0) {
            this.resourceStorage.stored.set(type, currentStored + canAdd);
        }
        
        return canAdd;
    }
    
    public removeResourceFromBuilding(type: ResourceType, amount: number): number {
        const currentStored = this.resourceStorage.stored.get(type) || 0;
        const canRemove = Math.min(amount, currentStored);
        
        if (canRemove > 0) {
            this.resourceStorage.stored.set(type, currentStored - canRemove);
        }
        
        return canRemove;
    }
    
    public getBuildingResource(type: ResourceType): number {
        return this.resourceStorage.stored.get(type) || 0;
    }
    
    public getBuildingResourceCapacity(type: ResourceType): number {
        return this.resourceStorage.capacity.get(type) || 0;
    }
    
    public getAllBuildingResources(): ReadonlyMap<ResourceType, number> {
        return new Map(this.resourceStorage.stored);
    }

    public getMap(): Phaser.Tilemaps.Tilemap {
        return this.map;
    }

    public getPosition(): BuildingPosition {
        return { ...this.position };
    }

    public getType(): string {
        return this.buildingType;
    }

    public getDimensions(): BuildingDimensions {
        return {
            tilesWidth: this.map.width,
            tilesHeight: this.map.height
        };
    }

    public getBuildingName(): string {
        const names: Record<string, string> = {
            'house': 'Maison',
            'sawmill': 'Scierie',
            'mine': 'Mine',
            'farm': 'Ferme'
        };
        return names[this.buildingType] || this.buildingType;
    }

    public destroy(): void {
        this.layers.forEach(layer => layer.destroy());
        this.interactiveZones.forEach(zone => zone.zone.destroy());
        
        this.collisionBodies.forEach(body => {
            if (body.gameObject) {
                body.gameObject.destroy();
            }
        });
        
        this.cleanupPlayerInteraction();
        this.layerStates.clear();
    }
}