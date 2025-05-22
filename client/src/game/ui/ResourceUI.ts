import { ResourceManager } from '../services/ResourceManager';
import type { PlayerInventory, ResourceStack } from '../types/PlayerInventory';

export class ResourceUI extends Phaser.Scene {
    private container: Phaser.GameObjects.Container | null = null;
    private resourceManager: ResourceManager;
    private playerInventory: PlayerInventory | null = null;
    
    constructor() {
        super({ key: 'ResourceUI' });
        this.resourceManager = ResourceManager.getInstance();
    }
    
    create(): void {
        this.playerInventory = (this.scene.get('MainScene') as any).playerInventory;
        this.createResourceDisplay();
    }
    
    private createResourceDisplay(): void {
        this.container = this.add.container(20, 60);
        this.container.setScrollFactor(0);
        this.container.setDepth(1000);
        
        this.updateResourceDisplay();
    }
    
    public updateResourceDisplay(): void {
        if (!this.container || !this.playerInventory) return;
        
        this.container.removeAll(true);
        
        const nonZeroResources = this.playerInventory.getNonZeroResources();
        const showNames = nonZeroResources.length <= 6;
        
        nonZeroResources.forEach((stack: ResourceStack, index: number) => {
            const y = index * 40;
            this.container?.add(
                this.resourceManager.createResourceDisplay(
                    this,
                    0,
                    y,
                    stack.type,
                    stack.amount,
                    {
                        iconSize: 28,
                        fontSize: '16px',
                        showName: showNames,
                        backgroundColor: 0x000000,
                        backgroundAlpha: 0.7
                    }
                )
            );
        });
    }
}