export class BuildingPreview extends Phaser.GameObjects.Sprite {
    private isValid: boolean = true;
    private gridSize: number = 16;
    private tilesWidth: number;
    private tilesHeight: number;

    constructor(scene: Scene, buildingType: string) {
        super(scene, 0, 0, buildingType);
        
        // Calcul des dimensions en tiles
        const texture = scene.textures.get(buildingType);
        const sourceWidth = texture.source[0].width;
        const sourceHeight = texture.source[0].height;
        
        this.tilesWidth = Math.ceil(sourceWidth / this.gridSize);
        this.tilesHeight = Math.ceil(sourceHeight / this.gridSize);
        
        scene.add.existing(this);
        
        // Définir l'origine au coin supérieur gauche
        this.setOrigin(0, 0);
        this.setAlpha(0.6);
        this.setDepth(100);
    }

    public updatePosition(x: number, y: number): void {
        // Aligner sur la grille
        const snappedX = Math.floor(x / this.gridSize) * this.gridSize;
        const snappedY = Math.floor(y / this.gridSize) * this.gridSize;
        this.setPosition(snappedX, snappedY);
    }

    public setValidPlacement(isValid: boolean): void {
        this.isValid = isValid;
        this.setTint(isValid ? 0xffffff : 0xff0000);
    }

    public isValidPlacement(): boolean {
        return this.isValid;
    }

    public getDimensions() {
        return {
            tilesWidth: this.tilesWidth,
            tilesHeight: this.tilesHeight
        };
    }
}