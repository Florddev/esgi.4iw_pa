import { ResourceManager } from '../services/ResourceManager';
import { ResourceType } from '../types/ResourceSystemTypes';
import { ResourceDisplay } from './components/ResourceDisplay';

export class BuildingInfoUI extends Phaser.Scene {
    private currentBuilding: any = null;
    private container: Phaser.GameObjects.Container | null = null;
    private backgroundPanel: Phaser.GameObjects.Rectangle | null = null;
    private titleText: Phaser.GameObjects.Text | null = null;
    private infoText: Phaser.GameObjects.Text | null = null;
    private resourcesText: Phaser.GameObjects.Text | null = null;
    private closeButton: Phaser.GameObjects.Container | null = null;
    private resourceManager: ResourceManager;
    private resourceDisplay: ResourceDisplay | null = null;
    
    constructor() {
        super({ key: 'BuildingInfoUI' });
        this.resourceManager = ResourceManager.getInstance();
    }

    create(): void {
        if (this.input.keyboard) {
            this.input.keyboard.on('keydown-ESC', () => {
                this.hideBuildingInfo();
            });
        }
        this.resourceDisplay = new ResourceDisplay(this);
    }
    
    public showBuildingInfo(building: any): void {
        this.currentBuilding = building;
        
        if (!this.scene.isActive()) {
            this.scene.start();
        }
        
        this.createInterface();
        this.scene.setVisible(true);
        this.scene.bringToTop();
    }
    
    public hideBuildingInfo(): void {
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        this.currentBuilding = null;
        this.scene.setVisible(false);
    }
    
    private createInterface(): void {
        if (this.container) {
            this.container.destroy();
        }
        
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
        
        this.container = this.add.container(centerX, centerY);
        
        const overlay = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.5);
        overlay.setOrigin(0.5);
        this.container.add(overlay);
        
        this.backgroundPanel = this.add.rectangle(0, 0, 400, 300, 0x2c3e50, 0.95);
        this.container.add(this.backgroundPanel);
        
        const buildingName = this.getBuildingDisplayName(this.currentBuilding.getType());
        this.titleText = this.add.text(0, -120, buildingName, {
            fontSize: '24px',
            color: '#ecf0f1',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.container.add(this.titleText);
        
        const separator = this.add.rectangle(0, -90, 350, 2, 0x34495e);
        this.container.add(separator);
        
        this.infoText = this.add.text(0, -50, this.getBuildingInfo(), {
            fontSize: '16px',
            color: '#bdc3c7',
            align: 'center',
            wordWrap: { width: 350 }
        }).setOrigin(0.5);
        this.container.add(this.infoText);
        
        this.resourcesText = this.add.text(0, 20, this.getResourcesInfo(), {
            fontSize: '14px',
            color: '#f39c12',
            align: 'center'
        }).setOrigin(0.5);
        this.container.add(this.resourcesText);
        
        this.createBuildingActions();
        this.createCloseButton();
        
        if (this.backgroundPanel) {
            this.backgroundPanel.setInteractive();
        }
        
        overlay.setInteractive();
        if (this.backgroundPanel) {
            this.backgroundPanel.on('pointerdown', (event: any) => {
                event.stopPropagation();
            });
        }
    }
    
    private getBuildingDisplayName(type: string): string {
        const names: { [key: string]: string } = {
            'house': 'Maison',
            'sawmill': 'Scierie',
            'mine': 'Mine',
            'farm': 'Ferme'
        };
        return names[type] || type.charAt(0).toUpperCase() + type.slice(1);
    }
    
    private getBuildingInfo(): string {
        const type = this.currentBuilding.getType();
        const position = this.currentBuilding.getPosition();
        
        let info = `Type: ${this.getBuildingDisplayName(type)}\n`;
        info += `Position: (${Math.floor(position.x/16)}, ${Math.floor(position.y/16)})`;
        
        switch (type) {
            case 'sawmill':
                info += '\n\nLa scierie traite le bois brut et\npeut stocker les ressources récoltées.\n';
                info += 'Les bûcherons peuvent y déposer\nleur bois automatiquement.';
                break;
            case 'house':
                info += '\n\nLa maison peut abriter des ouvriers\net améliorer leur efficacité.';
                break;
            default:
                info += '\n\nBâtiment fonctionnel pour\nvotre colonie.';
        }
        
        return info;
    }
    
    private getResourcesInfo(): string {
        const type = this.currentBuilding.getType();
        let resourcesInfo = '=== RESSOURCES STOCKÉES ===\n';
        
        const buildingResources = this.currentBuilding.getAllBuildingResources();
        
        if (buildingResources.size === 0) {
            resourcesInfo += 'Aucune ressource stockée';
        } else {
            buildingResources.forEach((amount: number, resourceType: ResourceType) => {
                const resource = this.resourceManager.getResource(resourceType);
                const capacity = this.currentBuilding.getBuildingResourceCapacity(resourceType);
                
                if (resource && capacity > 0) {
                    resourcesInfo += `${resource.iconTexture} ${resource.name}: ${amount}/${capacity}\n`;
                }
            });
        }
        
        return resourcesInfo.trim();
    }
    
    private collectResources(): void {
        const mainScene = this.scene.get('MainScene') as any;
        const buildingResources = this.currentBuilding.getAllBuildingResources();
        
        let totalCollected = 0;
        buildingResources.forEach((amount: number, resourceType: ResourceType) => {
            if (amount > 0) {
                const removed = this.currentBuilding.removeResourceFromBuilding(resourceType, amount);
                mainScene.addResource(resourceType, removed);
                totalCollected += removed;
            }
        });
        
        if (totalCollected > 0) {
            this.updateResourcesDisplay();
        }
    }
    
    private createBuildingActions(): void {
        const type = this.currentBuilding.getType();
        
        if (type === 'sawmill' && this.container && this.resourceDisplay) {
            const buildingResources = this.currentBuilding.getAllBuildingResources();
            let yOffset = 60;
            
            buildingResources.forEach((amount: number, resourceType: ResourceType) => {
                const capacity = this.currentBuilding.getBuildingResourceCapacity(resourceType);
                if (capacity > 0) {
                    const resourceBar = this.resourceDisplay.createResourceBar(
                        0, yOffset, resourceType, amount, capacity, 200
                    );
                    this.container.add(resourceBar);
                    yOffset += 25;
                }
            });
            
            const collectButton = this.add.container(0, yOffset + 20);
            
            const collectBg = this.add.rectangle(0, 0, 150, 30, 0x27ae60);
            collectBg.setInteractive();
            
            const collectText = this.add.text(0, 0, 'Collecter tout', {
                fontSize: '14px',
                color: '#ffffff'
            }).setOrigin(0.5);
            
            collectButton.add([collectBg, collectText]);
            this.container.add(collectButton);
            
            collectBg.on('pointerover', () => collectBg.setFillStyle(0x2ecc71));
            collectBg.on('pointerout', () => collectBg.setFillStyle(0x27ae60));
            collectBg.on('pointerdown', () => this.collectResources());
        }
    }
    
    private updateResourcesDisplay(): void {
        if (this.resourcesText) {
            this.resourcesText.setText(this.getResourcesInfo());
        }
    }
    
    private createCloseButton(): void {
        if (!this.container) return;

        this.closeButton = this.add.container(150, -120);
        
        const closeBg = this.add.rectangle(0, 0, 30, 30, 0xe74c3c);
        closeBg.setInteractive();
        
        const closeText = this.add.text(0, 0, 'X', {
            fontSize: '16px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        this.closeButton.add([closeBg, closeText]);
        this.container.add(this.closeButton);
        
        closeBg.on('pointerover', () => closeBg.setFillStyle(0xc0392b));
        closeBg.on('pointerout', () => closeBg.setFillStyle(0xe74c3c));
        closeBg.on('pointerdown', () => this.hideBuildingInfo());
    }
    
    public updateInterface(): void {
        if (this.currentBuilding && this.container) {
            this.updateResourcesDisplay();
        }
    }
}