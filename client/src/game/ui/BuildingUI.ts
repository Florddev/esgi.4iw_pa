export class BuildingUI extends Phaser.Scene {
    private buttons: Phaser.GameObjects.Sprite[] = [];
    private buildings: string[] = [
        'house', 'sawmill'
    ];
    private selectedBuilding: string | null = null;

    constructor() {
        super({ key: 'BuildingUI', active: true });
    }

    create(): void {
        const padding = 10;
        const buttonSize = 50;
        
        // Ajouter le bouton de nettoyage
        const clearButton = this.add.text(
            this.game.canvas.width - 120,
            this.game.canvas.height - buttonSize - padding,
            'Effacer tout',
            {
                backgroundColor: '#ff0000',
                padding: { x: 10, y: 5 },
                color: '#ffffff',
                fontStyle: 'bold'
            }
        )
        .setInteractive()
        .setScrollFactor(0);

        clearButton.on('pointerdown', () => {
            if (confirm('Voulez-vous vraiment supprimer tous les bâtiments ?')) {
                // Nettoyer le sessionStorage
                sessionStorage.removeItem('BUILDINGS_STORAGE');
                console.log('Buildings cleared from scene and storage');
            }
        });

        // Boutons des bâtiments
        this.buildings.forEach((building, index) => {
            const button = this.add.sprite(
                padding + buttonSize * index + buttonSize / 2,
                this.game.canvas.height - buttonSize - padding,
                building
            )
            .setInteractive()
            .setScrollFactor(0)
            .setDisplaySize(buttonSize, buttonSize);

            button.on('pointerdown', () => {
                this.buttons.forEach(b => b.setTint(0xffffff));
                button.setTint(0x00ff00);
                this.selectedBuilding = building;
                this.game.events.emit('selectBuilding', building);
            });

            this.buttons.push(button);
        });
    }
}