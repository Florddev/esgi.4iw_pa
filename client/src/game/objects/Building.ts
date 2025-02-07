import { Scene } from 'phaser';

interface BuildingData {
    x: number;
    y: number;
    type: string;
}

export class Building extends Phaser.Physics.Arcade.Sprite {
    private type: string;
    private gridSize: number = 16;
    private tilesWidth: number;
    private tilesHeight: number;

    constructor(scene: Scene, x: number, y: number, buildingType: string) {
        super(scene, x, y, buildingType);
        this.type = buildingType;
        
        // Calcul des dimensions en tiles
        const texture = scene.textures.get(buildingType);
        const sourceWidth = texture.source[0].width;
        const sourceHeight = texture.source[0].height;
        
        this.tilesWidth = Math.ceil(sourceWidth / this.gridSize);
        this.tilesHeight = Math.ceil(sourceHeight / this.gridSize);
        
        // Ajout à la scène
        scene.add.existing(this);
        scene.physics.add.existing(this, true);
        
        // Définir l'origine au coin supérieur gauche pour un meilleur alignement
        this.setOrigin(0, 0);
        
        // Ajuster la position pour aligner avec la grille
        this.setPosition(
            Math.floor(x / this.gridSize) * this.gridSize,
            Math.floor(y / this.gridSize) * this.gridSize
        );
    }

    public getDimensions() {
        return {
            tilesWidth: this.tilesWidth,
            tilesHeight: this.tilesHeight
        };
    }

    public serialize(): BuildingData {
        const data = {
            x: this.x,
            y: this.y,
            type: this.type
        };
        console.log('Serializing building:', data);
        return data;
    }
}
