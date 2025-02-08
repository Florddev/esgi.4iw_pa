// src/game/ui/BuildingUI.ts
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

    preload(): void {
        // Charger les icônes des bâtiments
        this.buildings.forEach(building => {
            this.load.image(building.icon, `assets/ui/icons/${building.key}.png`);
        });
    }

    create(): void {
        // Créer le fond de l'interface
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

        // Créer les boutons des bâtiments
        this.buildings.forEach((building, index) => {
            const x = 20 + (index * 90);
            const y = this.game.canvas.height - 40;
            
            const container = this.createBuildingButton(building, x, y);
            this.buttons.set(building.key, container);
        });

        // Ajouter le bouton de nettoyage
        this.createClearButton();
    }

    private createBuildingButton(building: BuildingConfig, x: number, y: number): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        
        // Fond du bouton
        const background = this.add.rectangle(0, 0, 80, 60, 0x333333)
            .setInteractive()
            .setOrigin(0.5);

        // Icône du bâtiment
        const icon = this.add.image(0, -10, building.icon)
            .setDisplaySize(40, 40);

        // Nom du bâtiment
        const text = this.add.text(0, 15, building.name, {
            fontSize: '12px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Coût en ressources
        const costText = this.add.text(0, 25, `🪵 ${building.cost.wood}`, {
            fontSize: '10px',
            color: '#ffcc00'
        }).setOrigin(0.5);

        container.add([background, icon, text, costText]);
        container.setScrollFactor(0);

        // Gestionnaire d'événements
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
        // Réinitialiser l'ancien bouton sélectionné
        if (this.selectedButton) {
            const oldBackground = this.selectedButton.getAt(0) as Phaser.GameObjects.Rectangle;
            oldBackground.setFillStyle(0x333333);
        }

        // Mettre à jour la sélection
        this.selectedBuilding = key;
        this.selectedButton = container;
        
        // Mettre en évidence le nouveau bouton
        const background = container.getAt(0) as Phaser.GameObjects.Rectangle;
        background.setFillStyle(0x00ff00);

        // Émettre l'événement de sélection
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

// Types pour la configuration des bâtiments
interface BuildingConfig {
    key: string;
    name: string;
    template: string;
    icon: string;
    cost: {
        wood: number;
    };
}