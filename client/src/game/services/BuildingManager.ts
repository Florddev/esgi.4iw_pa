import { Scene } from 'phaser';
type Scene = typeof Scene;

import { TiledBuilding } from '../objects/TiledBuilding';
import type { BuildingPosition, BuildingConfig } from '../types';

interface StoredBuilding {
    readonly type: string;
    readonly x: number;
    readonly y: number;
}

interface BuildingManagerEvents {
    'buildingPlaced': (building: TiledBuilding) => void;
    'buildingDestroyed': (building: TiledBuilding) => void;
    'allBuildingsCleared': () => void;
}

export class BuildingManager {
    private readonly scene: Scene;
    private readonly buildings: TiledBuilding[] = [];
    private readonly eventCallbacks = new Map<keyof BuildingManagerEvents, Set<Function>>();
    private readonly STORAGE_KEY = 'BUILDINGS_STORAGE';
    
    constructor(scene: Scene) {
        this.scene = scene;
    }

    public placeBuilding(type: string, x: number, y: number): TiledBuilding {
        const templateKey = `${type}-template`;
        const building = new TiledBuilding(this.scene, x, y, templateKey);

        const player = (this.scene as any).player;
        if (player) {
            building.setupCollisions(player);
        }
        
        this.buildings.push(building);
        this.saveState();
        this.rebuildPathfindingGrid();

        this.emit('buildingPlaced', building);
        
        return building;
    }
    
    public removeBuilding(building: TiledBuilding): boolean {
        const index = this.buildings.indexOf(building);
        if (index === -1) return false;
        
        this.buildings.splice(index, 1);
        building.destroy();
        this.saveState();
        this.rebuildPathfindingGrid();

        this.emit('buildingDestroyed', building);
        
        return true;
    }
    
    public getBuildingAt(x: number, y: number): TiledBuilding | null {
        return this.buildings.find(building => {
            const pos = building.getPosition();
            const dim = building.getDimensions();
            
            return x >= pos.x && 
                   x < pos.x + (dim.tilesWidth * 16) &&
                   y >= pos.y && 
                   y < pos.y + (dim.tilesHeight * 16);
        }) ?? null;
    }
    
    public getBuildingsByType(type: string): readonly TiledBuilding[] {
        return this.buildings.filter(building => building.getType() === type);
    }
    
    public getClosestBuilding(position: BuildingPosition, type?: string): TiledBuilding | null {
        let candidates = this.buildings;
        
        if (type) {
            candidates = this.buildings.filter(building => building.getType() === type);
        }
        
        if (candidates.length === 0) return null;
        
        return candidates.reduce((closest, current) => {
            const closestPos = closest.getPosition();
            const currentPos = current.getPosition();
            
            const closestDist = Phaser.Math.Distance.Between(
                position.x, position.y, 
                closestPos.x, closestPos.y
            );
            
            const currentDist = Phaser.Math.Distance.Between(
                position.x, position.y, 
                currentPos.x, currentPos.y
            );
            
            return currentDist < closestDist ? current : closest;
        });
    }
    
    private saveState(): void {
        try {
            const state: StoredBuilding[] = this.buildings.map(building => {
                const position = building.getPosition();
                return {
                    type: building.getType(),
                    x: position.x,
                    y: position.y
                };
            });
            
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.error('Erreur lors de la sauvegarde des bâtiments:', error);
        }
    }
    
    public loadState(): void {
        try {
            const stored = sessionStorage.getItem(this.STORAGE_KEY);
            if (!stored) return;

            const state: StoredBuilding[] = JSON.parse(stored);

            const validBuildings = state.filter(data => 
                typeof data.type === 'string' &&
                typeof data.x === 'number' &&
                typeof data.y === 'number' &&
                !isNaN(data.x) &&
                !isNaN(data.y)
            );
            
            validBuildings.forEach(data => {
                this.placeBuilding(data.type, data.x, data.y);
            });
            
            console.log(`Chargés ${validBuildings.length} bâtiments`);
            
        } catch (error) {
            console.error('Erreur chargement bâtiments:', error);
            sessionStorage.removeItem(this.STORAGE_KEY);
        }
    }

    public updateBuildings(player: Phaser.Physics.Arcade.Sprite): void {
        this.buildings.forEach(building => {
            try {
                building.update(player);
            } catch (error) {
                console.error('Erreur lors de la mise à jour du bâtiment:', error);
            }
        });
    }

    public getBuildings(): readonly TiledBuilding[] {
        return [...this.buildings];
    }

    public clearAll(): void {
        const buildingsToDestroy = [...this.buildings];
        
        buildingsToDestroy.forEach(building => {
            try {
                building.destroy();
            } catch (error) {
                console.error('Erreur lors de la destruction du bâtiment:', error);
            }
        });
        
        this.buildings.length = 0;
        
        try {
            sessionStorage.removeItem(this.STORAGE_KEY);
        } catch (error) {
            console.error('Erreur lors du nettoyage du storage:', error);
        }
        
        this.rebuildPathfindingGrid();

        this.emit('allBuildingsCleared');
    }
    
    private rebuildPathfindingGrid(): void {
        try {
            const mainScene = this.scene as any;
            if (mainScene.rebuildPathfindingGrid) {
                mainScene.rebuildPathfindingGrid();
            }
        } catch (error) {
            console.error('Erreur lors de la reconstruction de la grille de pathfinding:', error);
        }
    }

    public on<K extends keyof BuildingManagerEvents>(
        event: K, 
        callback: BuildingManagerEvents[K]
    ): void {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, new Set());
        }
        this.eventCallbacks.get(event)!.add(callback);
    }
    
    public off<K extends keyof BuildingManagerEvents>(
        event: K, 
        callback: BuildingManagerEvents[K]
    ): void {
        const callbacks = this.eventCallbacks.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }
    
    private emit<K extends keyof BuildingManagerEvents>(
        event: K, 
        ...args: Parameters<BuildingManagerEvents[K]>
    ): void {
        const callbacks = this.eventCallbacks.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    (callback as Function)(...args);
                } catch (error) {
                    console.error(`Erreur dans le callback ${event}:`, error);
                }
            });
        }
    }

    public getBuildingCount(): number {
        return this.buildings.length;
    }
    
    public getBuildingCountByType(type: string): number {
        return this.buildings.filter(building => building.getType() === type).length;
    }
    
    public hasBuildings(): boolean {
        return this.buildings.length > 0;
    }
    
    public canPlaceBuildingAt(x: number, y: number, width: number, height: number): boolean {
        return !this.buildings.some(building => {
            const pos = building.getPosition();
            const dim = building.getDimensions();

            return !(x >= pos.x + (dim.tilesWidth * 16) ||
                    x + (width * 16) <= pos.x ||
                    y >= pos.y + (dim.tilesHeight * 16) ||
                    y + (height * 16) <= pos.y);
        });
    }

    public destroy(): void {
        this.clearAll();
        this.eventCallbacks.clear();
    }
}