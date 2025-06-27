import { ResourceManager } from '../../services/ResourceManager';
import { ResourceType } from '../../types/ResourceSystemTypes';

export class ResourceDisplay {
    private scene: Phaser.Scene;
    private resourceManager: ResourceManager;
    
    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.resourceManager = ResourceManager.getInstance();
    }

    public createResourceItem(
        x: number, 
        y: number, 
        resourceType: ResourceType, 
        amount: number,
        options: {
            iconSize?: number;
            fontSize?: string;
            showName?: boolean;
            backgroundColor?: number;
            backgroundAlpha?: number;
        } = {}
    ): Phaser.GameObjects.Container {
        return this.resourceManager.createResourceDisplay(
            this.scene,
            x,
            y,
            resourceType,
            amount,
            options
        );
    }
    
    /**
     * Crée une barre de progression pour une ressource (utile pour les stockages)
     */
    public createResourceBar(
        x: number,
        y: number,
        resourceType: ResourceType,
        current: number,
        max: number,
        width: number = 150
    ): Phaser.GameObjects.Container {
        
        const resource = this.resourceManager.getResource(resourceType);
        if (!resource) {
            return this.scene.add.container(x, y);
        }
        
        const container = this.scene.add.container(x, y);

        const iconImage = this.scene.add.image(-width/2 - 20, 0, resource.iconTexture);
        iconImage.setDisplaySize(20, 20);
        iconImage.setOrigin(0.5, 0.5);

        const barBg = this.scene.add.rectangle(0, 0, width, 12, 0x333333);

        const fillWidth = Math.max(0, (current / max) * width);
        const barFill = this.scene.add.rectangle(-width/2 + fillWidth/2, 0, fillWidth, 12, resource.color);

        const quantityText = this.scene.add.text(0, 0, `${current}/${max}`, {
            fontSize: '10px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);
        
        container.add([iconImage, barBg, barFill, quantityText]);
        
        return container;
    }
}