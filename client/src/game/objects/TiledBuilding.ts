import { Scene } from 'phaser';

interface BuildingZone {
    zone: Phaser.GameObjects.Zone;
    layersToHide: string[];
    depthChanges: { [key: string]: number };
}

interface LayerState {
    baseDepth: number;
    currentDepth: number;
    currentAlpha: number;
    activeZones: Set<BuildingZone>;
}


export class TiledBuilding {
    private scene: Scene;
    private layers: Phaser.Tilemaps.TilemapLayer[] = [];
    private map: Phaser.Tilemaps.Tilemap;
    private tileset: Phaser.Tilemaps.Tileset;
    private position: { x: number, y: number };
    private buildingType: string;
    private collisionBodies: Phaser.Physics.Arcade.Body[] = [];
    private interactiveZones: BuildingZone[] = [];
    private layerStates: Map<string, LayerState> = new Map();
    private isPlayerInside: boolean = false;
    
    constructor(scene: Scene, x: number, y: number, templateKey: string) {
        this.scene = scene;
        this.position = { x, y };
        this.buildingType = templateKey.replace('-template', '');
        
        try {
            this.map = scene.make.tilemap({ key: templateKey });
            const tilesetName = this.map.tilesets[0]?.name;
            if (!tilesetName) {
                throw new Error(`Aucun tileset trouvé dans le template ${templateKey}`);
            }
            
            this.tileset = this.map.addTilesetImage(tilesetName, 'tiles');
            if (!this.tileset) {
                throw new Error(`Impossible d'ajouter le tileset ${tilesetName}`);
            }
            
            this.createLayers(x, y);
            this.setupInteractiveZones(x, y);
            
        } catch (error) {
            console.error('Erreur lors de la création du bâtiment:', error);
            throw error;
        }
    }

    private createLayers(x: number, y: number): void {
        this.map.layers.forEach(layerData => {
            const layer = this.map.createLayer(layerData.name, this.tileset, x, y);
            
            if (layer) {
                const properties = layerData.properties || [];
                const baseDepth = properties.find(p => p.name === 'depth')?.value ?? 0;
                const hasDynamicDepth = properties.find(p => p.name === 'dynamicDepth')?.value ?? false;
                
                layer.setDepth(baseDepth);
                
                this.layerStates.set(layerData.name, {
                    baseDepth: baseDepth,
                    currentDepth: baseDepth,
                    currentAlpha: 1,
                    activeZones: new Set()
                });
                
                this.layers.push(layer);
                this.setupTileCollisions(layer, x, y);
            }
        });
    }

    private setupInteractiveZones(x: number, y: number): void {
        const objectLayer = this.map.getObjectLayer('Zones');
        if (!objectLayer) return;

        objectLayer.objects.forEach(obj => {
            if (obj.type === 'entrance') {
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

                const depthChangesProp = obj.properties?.find(p => p.name === 'depthChanges')?.value;
                const depthChanges: { [key: string]: number } = {};
                
                if (depthChangesProp) {
                    depthChangesProp.split(',').forEach((change: string) => {
                        const [layerName, depth] = change.split(':');
                        depthChanges[layerName.trim()] = parseInt(depth);
                    });
                }

                const layersToHide = obj.properties?.find(p => p.name === 'hideLayerNames')?.value?.split(',') || [];

                this.interactiveZones.push({
                    zone,
                    layersToHide: layersToHide.map(name => name.trim()),
                    depthChanges
                });

                if (process.env.NODE_ENV === 'development') {
                    const debugRect = this.scene.add.rectangle(
                        zone.x,
                        zone.y,
                        zone.width,
                        zone.height,
                        //0xff0000,
                        //0.3
                    ).setOrigin(0.5, 0.5);
                }
            }
        });
    }

    public update(player: Phaser.Physics.Arcade.Sprite): void {
        // Réinitialiser l'état des zones actives pour chaque layer
        this.layerStates.forEach(state => {
            state.activeZones.clear();
        });

        // Vérifier chaque zone
        this.interactiveZones.forEach(zone => {
            const isOverlapping = this.scene.physics.overlap(player, zone.zone);
            
            if (isOverlapping) {
                // Pour chaque layer affecté par cette zone
                this.layers.forEach(layer => {
                    const layerState = this.layerStates.get(layer.layer.name);
                    if (layerState) {
                        layerState.activeZones.add(zone);
                    }
                });
            }
        });

        // Mettre à jour l'état de chaque layer en fonction des zones actives
        this.layers.forEach(layer => {
            const layerState = this.layerStates.get(layer.layer.name);
            if (!layerState) return;

            let shouldBeHidden = false;
            let highestDepthChange = layerState.baseDepth;

            // Appliquer les effets de toutes les zones actives
            layerState.activeZones.forEach(zone => {
                if (zone.layersToHide.includes(layer.layer.name)) {
                    shouldBeHidden = true;
                }
                if (zone.depthChanges[layer.layer.name] !== undefined) {
                    highestDepthChange = Math.max(highestDepthChange, zone.depthChanges[layer.layer.name]);
                }
            });

            // Mettre à jour l'alpha si nécessaire
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

            // Mettre à jour la profondeur si nécessaire
            if (layerState.currentDepth !== highestDepthChange) {
                layer.setDepth(highestDepthChange);
                layerState.currentDepth = highestDepthChange;
            }
        });
    }

    public getMap(): Phaser.Tilemaps.Tilemap {
        return this.map; 
    }

    private setupTileCollisions(layer: Phaser.Tilemaps.TilemapLayer, offsetX: number, offsetY: number): void {
        // Parcourir chaque tile du layer
        for (let y = 0; y < layer.layer.height; y++) {
            for (let x = 0; x < layer.layer.width; x++) {
                const tile = layer.getTileAt(x, y);
                if (!tile) continue;

                // Récupérer les collisions personnalisées de la tile depuis le tileset
                const collisionData = this.tileset.getTileCollisionGroup(tile.index);
                
                if (collisionData && collisionData.objects && collisionData.objects.length > 0) {
                    collisionData.objects.forEach(collisionObject => {
                        // Position absolue de la collision
                        const collisionX = offsetX + x * this.map.tileWidth + collisionObject.x;
                        const collisionY = offsetY + y * this.map.tileHeight + collisionObject.y;

                        let collisionBody;
                        
                        if (collisionObject.rectangle) {
                            // Collision rectangulaire
                            collisionBody = this.scene.add.rectangle(
                                collisionX + collisionObject.width / 2,
                                collisionY + collisionObject.height / 2,
                                collisionObject.width,
                                collisionObject.height
                            );
                        } else if (collisionObject.polygon) {
                            // Collision polygonale
                            const points = collisionObject.polygon.map(point => 
                                new Phaser.Geom.Point(point.x, point.y)
                            );
                            collisionBody = this.scene.add.polygon(
                                collisionX,
                                collisionY,
                                points,
                                0x000000,
                                0
                            );
                        }

                        if (collisionBody) {
                            this.scene.physics.add.existing(collisionBody, true);
                            const body = collisionBody.body as Phaser.Physics.Arcade.Body;
                            this.collisionBodies.push(body);

                            // Debug visual en mode développement
                            // if (process.env.NODE_ENV === 'development') {
                            //     const debugGraphics = this.scene.add.graphics()
                            //         .setAlpha(0.5)
                            //         .lineStyle(2, 0xff0000)
                            //         .strokeRectShape(collisionBody);
                            // }
                        }
                    });
                }
            }
        }
    }
    
    public setupCollisions(player: Phaser.Physics.Arcade.Sprite): void {
        this.collisionBodies.forEach(body => {
            //this.scene.physics.add.collider(player, body);
        });
    }

    public getPosition(): { x: number, y: number } {
        return this.position;
    }

    public getType(): string {
        return this.buildingType;
    }

    public getDimensions() {
        return {
            tilesWidth: this.map.width,
            tilesHeight: this.map.height
        };
    }
    
    public destroy(): void {
        this.layers.forEach(layer => layer.destroy());
        this.interactiveZones.forEach(zone => zone.zone.destroy());
        this.collisionBodies.forEach(body => {
            if (body.gameObject) {
                body.gameObject.destroy();
            }
        });
        this.collisionBodies = [];
        this.layerStates.clear();
    }

}