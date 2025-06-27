import { Scene } from 'phaser';
import type { BuildingDimensions, Position } from '../types';

interface LayerConfig {
    readonly layer: Phaser.Tilemaps.TilemapLayer;
    readonly hasCollision: boolean;
    readonly isAbovePlayer: boolean;
}

interface PreviewConfig {
    readonly validTint: number;
    readonly invalidTint: number;
    readonly previewAlpha: number;
    readonly previewDepthOffset: number;
}

export class TiledBuildingPreview {
    private readonly scene: Scene;
    private readonly layers: Phaser.Tilemaps.TilemapLayer[] = [];
    private readonly map: Phaser.Tilemaps.Tilemap;
    private readonly tileset: Phaser.Tilemaps.Tileset;
    private readonly config: PreviewConfig;
    
    private isValid: boolean = true;
    private currentPosition: Position = { x: 0, y: 0 };
    
    constructor(scene: Scene, templateKey: string) {
        this.scene = scene;
        
        this.config = {
            validTint: 0xffffff,
            invalidTint: 0xff0000,
            previewAlpha: 0.6,
            previewDepthOffset: 100
        };
        
        try {
            this.map = scene.make.tilemap({ key: templateKey });
            this.tileset = this.initializeTileset(templateKey);
            this.createPreviewLayers();
        } catch (error) {
            console.error(`Erreur lors de la création du preview pour ${templateKey}:`, error);
            throw error;
        }
    }

    private initializeTileset(templateKey: string): Phaser.Tilemaps.Tileset {
        const tilesetName = this.map.tilesets[0]?.name;
        if (!tilesetName) {
            throw new Error(`Aucun tileset trouvé dans le template ${templateKey}`);
        }
        
        const tileset = this.map.addTilesetImage(tilesetName, 'tiles');
        if (!tileset) {
            throw new Error(`Impossible d'ajouter le tileset ${tilesetName} pour le preview`);
        }
        
        return tileset;
    }

    private createPreviewLayers(): void {
        this.map.layers.forEach(layerData => {
            const layer = this.map.createLayer(layerData.name, this.tileset, 0, 0);
            
            if (layer) {
                this.setupPreviewLayer(layer, layerData);
                this.layers.push(layer);
            }
        });
    }

    private setupPreviewLayer(layer: Phaser.Tilemaps.TilemapLayer, layerData: Phaser.Tilemaps.LayerData): void {
        const baseDepth = this.extractLayerDepth(layerData);
        
        layer.setDepth(baseDepth + this.config.previewDepthOffset);
        layer.setAlpha(this.config.previewAlpha);
        layer.setTint(this.config.validTint);
    }

    private extractLayerDepth(layerData: Phaser.Tilemaps.LayerData): number {
        const properties = layerData.properties;
        if (properties && Array.isArray(properties)) {
            const depthProperty = properties.find(p => p.name === 'depth');
            return depthProperty?.value ?? 0;
        }
        return 0;
    }

    public checkPlacementValidity(
        map: Phaser.Tilemaps.Tilemap, 
        mapLayers: Map<string, LayerConfig>
    ): boolean {
        const tilePosition = this.worldToTilePosition(this.currentPosition);
        const dimensions = this.getDimensions();

        return this.isWithinMapBounds(map, tilePosition, dimensions) &&
               this.hasNoCollisions(mapLayers, tilePosition, dimensions);
    }

    private worldToTilePosition(worldPos: Position): Position {
        return {
            x: Math.floor(worldPos.x / 16),
            y: Math.floor(worldPos.y / 16)
        };
    }

    private isWithinMapBounds(
        map: Phaser.Tilemaps.Tilemap, 
        tilePos: Position, 
        dimensions: BuildingDimensions
    ): boolean {
        return tilePos.x >= 0 && 
               tilePos.y >= 0 && 
               tilePos.x + dimensions.tilesWidth <= map.width && 
               tilePos.y + dimensions.tilesHeight <= map.height;
    }

    private hasNoCollisions(
        mapLayers: Map<string, LayerConfig>, 
        tilePos: Position, 
        dimensions: BuildingDimensions
    ): boolean {
        for (let x = 0; x < dimensions.tilesWidth; x++) {
            for (let y = 0; y < dimensions.tilesHeight; y++) {
                const checkPos = {
                    x: tilePos.x + x,
                    y: tilePos.y + y
                };

                if (this.hasCollisionAtPosition(mapLayers, checkPos)) {
                    return false;
                }
            }
        }
        return true;
    }

    private hasCollisionAtPosition(mapLayers: Map<string, LayerConfig>, pos: Position): boolean {
        for (const [_, config] of mapLayers.entries()) {
            if (!config.hasCollision) continue;

            const tile = config.layer.getTileAt(pos.x, pos.y);
            if (!tile) continue;

            if (this.tileHasCollision(tile)) {
                return true;
            }
        }
        return false;
    }

    private tileHasCollision(tile: Phaser.Tilemaps.Tile): boolean {
        if (tile.properties?.collides) {
            return true;
        }

        if (tile.tileset) {
            const collisionData = tile.tileset.getTileData(tile.index);
            if (collisionData?.objectgroup?.objects?.length > 0) {
                return true;
            }
        }

        return false;
    }

    public updatePosition(x: number, y: number): void {
        const snappedPosition = this.snapToGrid({ x, y });
        
        if (this.positionChanged(snappedPosition)) {
            this.currentPosition = snappedPosition;
            this.updateLayerPositions();
        }
    }

    private snapToGrid(position: Position): Position {
        return {
            x: Math.floor(position.x / 16) * 16,
            y: Math.floor(position.y / 16) * 16
        };
    }

    private positionChanged(newPosition: Position): boolean {
        return this.currentPosition.x !== newPosition.x || 
               this.currentPosition.y !== newPosition.y;
    }

    private updateLayerPositions(): void {
        this.layers.forEach(layer => {
            layer.setPosition(this.currentPosition.x, this.currentPosition.y);
        });
    }

    public setValidPlacement(isValid: boolean): void {
        if (this.isValid === isValid) return;

        this.isValid = isValid;
        const tint = isValid ? this.config.validTint : this.config.invalidTint;
        
        this.layers.forEach(layer => {
            layer.setTint(tint);
        });
    }

    public isValidPlacement(): boolean {
        return this.isValid;
    }

    public getDimensions(): BuildingDimensions {
        return {
            tilesWidth: this.map.width,
            tilesHeight: this.map.height
        };
    }

    public getPosition(): Position {
        return { ...this.currentPosition };
    }

    public getWorldBounds(): Phaser.Geom.Rectangle {
        const dimensions = this.getDimensions();
        return new Phaser.Geom.Rectangle(
            this.currentPosition.x,
            this.currentPosition.y,
            dimensions.tilesWidth * 16,
            dimensions.tilesHeight * 16
        );
    }

    public setVisible(visible: boolean): void {
        this.layers.forEach(layer => {
            layer.setVisible(visible);
        });
    }

    public setAlpha(alpha: number): void {
        const clampedAlpha = Phaser.Math.Clamp(alpha, 0, 1);
        this.layers.forEach(layer => {
            layer.setAlpha(clampedAlpha);
        });
    }

    public flashInvalid(): void {
        this.scene.tweens.add({
            targets: this.layers,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
                this.layers.forEach(layer => {
                    layer.setAlpha(this.config.previewAlpha);
                });
            }
        });
    }

    public destroy(): void {
        this.layers.forEach(layer => {
            try {
                layer.destroy();
            } catch (error) {
                console.error('Erreur lors de la destruction d\'une layer de preview:', error);
            }
        });

        this.layers.length = 0;
    }
}