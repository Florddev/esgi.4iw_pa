import type { BuildingConfig } from '../types/BuildingTypes';

export class BuildingUI extends Phaser.Scene {
    private buttons: Map<string, Phaser.GameObjects.Container> = new Map();
    private buildings: BuildingConfig[] = [
        {
            key: 'house',
            name: 'Maison',
            template: 'house-template',
            icon: 'house-icon',
            cost: { wood: 10 }
        },
        {
            key: 'sawmill',
            name: 'Scierie',
            template: 'sawmill-template',
            icon: 'sawmill-icon',
            cost: { wood: 20 }
        }
    ];
    private selectedBuilding: string | null = null;
    private selectedButton: Phaser.GameObjects.Container | null = null;

    constructor() {
        super({ key: 'BuildingUI', active: true });
    }

    private createWorkerButtons(): void {
        const lumberjackButton = this.add.container(
            this.game.canvas.width - 200,
            this.game.canvas.height - 40
        );
    
        const background = this.add.rectangle(0, 0, 80, 30, 0x3498db)
            .setInteractive()
            .setOrigin(0.5);
    
        const text = this.add.text(0, 0, 'Bûcheron', {
            color: '#ffffff',
            fontSize: '14px'
        }).setOrigin(0.5);
    
        lumberjackButton.add([background, text]);
        lumberjackButton.setScrollFactor(0);
    
        background
            .on('pointerover', () => background.setFillStyle(0x2980b9))
            .on('pointerout', () => background.setFillStyle(0x3498db))
            .on('pointerdown', () => {
                const mainScene = this.scene.get('MainScene') as any;
                const player = mainScene.player;
                
                // Chercher le dépôt le plus proche (scierie en priorité)
                let depositPoint = null;
                const buildings = mainScene.buildingManager.getBuildings();
                const sawmills = buildings.filter((building: any) => building.getType() === 'sawmill');
                
                if (sawmills.length > 0) {
                    // Utiliser la scierie la plus proche du joueur
                    let closestSawmill = sawmills[0];
                    let closestDistance = Phaser.Math.Distance.Between(
                        player.x, player.y, 
                        closestSawmill.getPosition().x, 
                        closestSawmill.getPosition().y
                    );
                    
                    for (let i = 1; i < sawmills.length; i++) {
                        const distance = Phaser.Math.Distance.Between(
                            player.x, player.y, 
                            sawmills[i].getPosition().x, 
                            sawmills[i].getPosition().y
                        );
                        if (distance < closestDistance) {
                            closestSawmill = sawmills[i];
                            closestDistance = distance;
                        }
                    }
                    
                    const pos = closestSawmill.getPosition();
                    const dim = closestSawmill.getDimensions();
                    
                    // Calculer un point de dépôt devant la scierie
                    depositPoint = {
                        x: pos.x + (dim.tilesWidth * 16) / 2, // Milieu de la largeur
                        y: pos.y + dim.tilesHeight * 16 + 16  // En dessous du bâtiment
                    };
                    
                    console.log('Dépôt configuré devant la scierie à:', depositPoint);
                } else {
                    // Pas de scierie, utiliser un point près du joueur comme fallback
                    depositPoint = {
                        x: player.x + 64,
                        y: player.y
                    };
                    console.log('Aucune scierie trouvée, dépôt par défaut à:', depositPoint);
                }
                
                // Créer le bûcheron avec le point de dépôt
                mainScene.createLumberjack(player.x + 32, player.y, depositPoint);
            });
    }

    preload(): void {
        this.buildings.forEach(building => {
            if (!this.textures.exists(building.icon)) {
                this.load.image(building.icon, `assets/ui/icons/${building.key}.png`);
            }
        });
    }

    create(): void {
        const uiBackground = this.add.rectangle(
            0,
            this.game.canvas.height - 80,
            this.game.canvas.width,
            80,
            0x000000,
            0.7
        )
            .setOrigin(0)
            .setScrollFactor(0);

        this.buildings.forEach((building, index) => {
            const x = 20 + (index * 90);
            const y = this.game.canvas.height - 40;

            const container = this.createBuildingButton(building, x, y);
            this.buttons.set(building.key, container);
        });

        this.createClearButton();
        this.createWorkerButtons();
    }

    private createBuildingButton(building: BuildingConfig, x: number, y: number): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);

        const background = this.add.rectangle(0, 0, 80, 60, 0x333333)
            .setInteractive()
            .setOrigin(0.5);

        const icon = this.add.image(0, -10, building.icon)
            .setDisplaySize(40, 40);

        const text = this.add.text(0, 15, building.name, {
            fontSize: '12px',
            color: '#ffffff'
        }).setOrigin(0.5);

        const costText = this.add.text(0, 25, `🪵 ${building.cost.wood}`, {
            fontSize: '10px',
            color: '#ffcc00'
        }).setOrigin(0.5);

        container.add([background, icon, text, costText]);
        container.setScrollFactor(0);

        background
            .on('pointerover', () => {
                background.setFillStyle(0x444444);
            })
            .on('pointerout', () => {
                if (this.selectedBuilding !== building.key) {
                    background.setFillStyle(0x333333);
                }
            })
            .on('pointerdown', () => {
                this.selectBuilding(building.key, container);
            });

        return container;
    }

    private selectBuilding(key: string, container: Phaser.GameObjects.Container): void {
        if (this.selectedButton) {
            const oldBackground = this.selectedButton.getAt(0) as Phaser.GameObjects.Rectangle;
            oldBackground.setFillStyle(0x333333);
        }

        this.selectedBuilding = key;
        this.selectedButton = container;

        const background = container.getAt(0) as Phaser.GameObjects.Rectangle;
        background.setFillStyle(0x00ff00);

        this.game.events.emit('selectBuilding', key);
    }

    private createClearButton(): void {
        const clearButton = this.add.container(
            this.game.canvas.width - 100,
            this.game.canvas.height - 40
        );

        const background = this.add.rectangle(0, 0, 80, 30, 0xff0000)
            .setInteractive()
            .setOrigin(0.5);

        const text = this.add.text(0, 0, 'Effacer', {
            color: '#ffffff',
            fontSize: '14px'
        }).setOrigin(0.5);

        clearButton.add([background, text]);
        clearButton.setScrollFactor(0);

        background
            .on('pointerover', () => background.setFillStyle(0xff3333))
            .on('pointerout', () => background.setFillStyle(0xff0000))
            .on('pointerdown', () => {
                if (confirm('Voulez-vous vraiment supprimer tous les bâtiments ?')) {
                    sessionStorage.removeItem('BUILDINGS_STORAGE');
                    this.game.events.emit('clearBuildings');
                }
            });
    }

    public canAffordBuilding(key: string, resources: any): boolean {
        const building = this.buildings.find(b => b.key === key);
        if (!building) return false;

        return resources.wood >= building.cost.wood;
    }
}