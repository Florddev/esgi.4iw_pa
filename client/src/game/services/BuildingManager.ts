import { Scene } from 'phaser';
import { TiledBuilding } from '../objects/TiledBuilding';

interface StoredBuilding {
    type: string;
    x: number;
    y: number;
}

export class BuildingManager {
    private scene: Scene;
    private buildings: TiledBuilding[] = [];
    private readonly STORAGE_KEY = 'BUILDINGS_STORAGE';
    
    constructor(scene: Scene) {
        this.scene = scene;
    }

    public placeBuilding(type: string, x: number, y: number): TiledBuilding {
        const templateKey = `${type}-template`;
        const building = new TiledBuilding(this.scene, x, y, templateKey);
        
        // Configurer les collisions avec le joueur
        if (this.scene.player) {
            building.setupCollisions(this.scene.player);
        }
        
        this.buildings.push(building);
        this.saveState();
        
        return building;
    }
    
    private saveState(): void {
        const state: StoredBuilding[] = this.buildings.map(building => {
            const position = building.getPosition();
            return {
                type: building.getType(),
                x: position.x,
                y: position.y
            };
        });
        
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    }
    
    public updateBuildings(player: Phaser.Physics.Arcade.Sprite): void {
        this.buildings.forEach(building => building.update(player));
    }
    
    public loadState(): void {
        const stored = sessionStorage.getItem(this.STORAGE_KEY);
        if (!stored) return;
        
        try {
            const state: StoredBuilding[] = JSON.parse(stored);
            state.forEach(data => {
                this.placeBuilding(data.type, data.x, data.y);
            });
        } catch (error) {
            console.error('Erreur lors du chargement des bâtiments:', error);
        }
    }
    
    public clearAll(): void {
        this.buildings.forEach(building => building.destroy());
        this.buildings = [];
        sessionStorage.removeItem(this.STORAGE_KEY);
    }
}