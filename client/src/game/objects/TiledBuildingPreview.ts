import { Scene } from 'phaser';

interface LayerConfig {
    layer: Phaser.Tilemaps.TilemapLayer;
    hasCollision: boolean;
    isAbovePlayer: boolean;
}

export class TiledBuildingPreview {
    private scene: Scene;
    private layers: Phaser.Tilemaps.TilemapLayer[] = [];
    private map: Phaser.Tilemaps.Tilemap;
    private tileset: Phaser.Tilemaps.Tileset;
    private isValid: boolean = true;
    
    constructor(scene: Scene, templateKey: string) {
        this.scene = scene;
        
        this.map = scene.make.tilemap({ key: templateKey });
        
        const tilesetName = this.map.tilesets[0]?.name;
        if (!tilesetName) {
            throw new Error(`Aucun tileset trouvé dans le template ${templateKey}`);
        }
        
        this.tileset = this.map.addTilesetImage(tilesetName, 'tiles');
        if (!this.tileset) {
            throw new Error(`Impossible d'ajouter le tileset ${tilesetName}`);
        }
        
        this.map.layers.forEach(layerData => {
            const layer = this.map.createLayer(layerData.name, this.tileset, 0, 0);
            
            if (layer) {
                const depth = layerData.properties?.find(p => p.name === 'depth')?.value ?? 0;
                layer.setDepth(depth + 100);
                layer.setAlpha(0.6);
                
                this.layers.push(layer);
            }
        });
    }

    public checkPlacementValidity(map: Phaser.Tilemaps.Tilemap, mapLayers: Map<string, LayerConfig>): boolean {
        const { x, y } = this.layers[0];
        const tileX = Math.floor(x / 16);
        const tileY = Math.floor(y / 16);
        const { tilesWidth, tilesHeight } = this.getDimensions();

        // 1. Vérifier les limites de la carte
        if (tileX < 0 || tileY < 0 || 
            tileX + tilesWidth > map.width || 
            tileY + tilesHeight > map.height) {
            return false;
        }

        // 2. Vérifier les collisions
        for (let x = 0; x < tilesWidth; x++) {
            for (let y = 0; y < tilesHeight; y++) {
                const currentTileX = tileX + x;
                const currentTileY = tileY + y;

                for (const [_, config] of mapLayers.entries()) {
                    if (config.hasCollision) {
                        const tile = config.layer.getTileAt(currentTileX, currentTileY);
                        if (tile) {
                            // Vérifier les collisions standards
                            if (config.hasCollision && tile.properties && tile.properties.collides) {
                                return false;
                            }

                            // Vérifier les collisions personnalisées du Tile Collision Editor
                            if (tile.tileset) {
                                const collisionData = tile.tileset.getTileData(tile.index);
                                if (collisionData && collisionData.objectgroup) {
                                    return false;
                                }
                            }
                        }
                    }
                }
            }
        }

        return true;
    }

    public updatePosition(x: number, y: number): void {
        const snappedX = Math.floor(x / 16) * 16;
        const snappedY = Math.floor(y / 16) * 16;
        
        this.layers.forEach(layer => {
            layer.setPosition(snappedX, snappedY);
        });
    }

    public setValidPlacement(isValid: boolean): void {
        this.isValid = isValid;
        this.layers.forEach(layer => {
            layer.setTint(isValid ? 0xffffff : 0xff0000);
        });
    }

    public isValidPlacement(): boolean {
        return this.isValid;
    }

    public getDimensions() {
        return {
            tilesWidth: this.map.width,
            tilesHeight: this.map.height
        };
    }

    public destroy(): void {
        this.layers.forEach(layer => layer.destroy());
    }
}