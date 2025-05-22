import { 
    ResourceType, 
    ResourceDefinition, 
    ResourceCategory,
    createResourceStack 
} from '../types/ResourceTypes';

interface ResourceDisplayOptions {
    iconSize?: number;
    fontSize?: string;
    showName?: boolean;
    backgroundColor?: number;
    backgroundAlpha?: number;
}

export class ResourceManager {
    private static instance: ResourceManager;
    private readonly resourceDefinitions = new Map<ResourceType, ResourceDefinition>();
    private readonly loadedAssets = new Set<string>();

    private constructor() {
        this.initializeResources();
    }

    public static getInstance(): ResourceManager {
        if (!ResourceManager.instance) {
            ResourceManager.instance = new ResourceManager();
        }
        return ResourceManager.instance;
    }

    public prepareSceneLoading(scene: Phaser.Scene): void {
        this.getAllResources().forEach(resource => {
            if (!this.loadedAssets.has(resource.iconTexture)) {
                scene.load.image(resource.iconTexture, `ui/resources/${resource.id}.png`);
                this.loadedAssets.add(resource.iconTexture);
            }
        });
    }

    public areAssetsLoaded(): boolean {
        return this.getAllResources().every(resource => 
            this.loadedAssets.has(resource.iconTexture)
        );
    }

    private initializeResources(): void {
        const resources: ResourceDefinition[] = [
            {
                id: ResourceType.WOOD,
                name: 'Bois',
                description: 'Matériau de base obtenu en coupant des arbres',
                iconTexture: 'wood-icon',
                category: ResourceCategory.RAW_MATERIAL,
                baseValue: 1,
                stackSize: 100,
                color: 0x8B4513
            },
            {
                id: ResourceType.STONE,
                name: 'Pierre',
                description: 'Matériau solide extrait des mines',
                iconTexture: 'stone-icon',
                category: ResourceCategory.RAW_MATERIAL,
                baseValue: 2,
                stackSize: 50,
                color: 0x808080
            },
            {
                id: ResourceType.FOOD,
                name: 'Nourriture',
                description: 'Nécessaire pour nourrir les ouvriers',
                iconTexture: 'food-icon',
                category: ResourceCategory.CONSUMABLE,
                baseValue: 3,
                stackSize: 20,
                color: 0xFFD700
            },
            {
                id: ResourceType.PLANKS,
                name: 'Planches',
                description: 'Bois transformé, plus utile pour la construction',
                iconTexture: 'planks-icon',
                category: ResourceCategory.PROCESSED,
                baseValue: 3,
                stackSize: 50,
                color: 0xDEB887
            },
            {
                id: ResourceType.TOOLS,
                name: 'Outils',
                description: 'Améliorent l\'efficacité des ouvriers',
                iconTexture: 'tools-icon',
                category: ResourceCategory.TOOL,
                baseValue: 10,
                stackSize: 10,
                color: 0x4169E1
            },
            {
                id: ResourceType.METAL,
                name: 'Métal',
                description: 'Matériau précieux pour les constructions avancées',
                iconTexture: 'metal-icon',
                category: ResourceCategory.PROCESSED,
                baseValue: 5,
                stackSize: 30,
                color: 0xC0C0C0
            }
        ];

        resources.forEach(resource => this.registerResource(resource));
    }

    public registerResource(definition: ResourceDefinition): void {
        this.resourceDefinitions.set(definition.id, definition);
    }

    public getResource(type: ResourceType): ResourceDefinition | undefined {
        return this.resourceDefinitions.get(type);
    }

    public getAllResources(): readonly ResourceDefinition[] {
        return Array.from(this.resourceDefinitions.values());
    }

    public getResourcesByCategory(category: ResourceCategory): readonly ResourceDefinition[] {
        return this.getAllResources().filter(resource => resource.category === category);
    }

    public getResourceName(type: ResourceType): string {
        return this.getResource(type)?.name ?? 'Inconnu';
    }

    public getResourceColor(type: ResourceType): number {
        return this.getResource(type)?.color ?? 0xFFFFFF;
    }

    public getResourceIconTexture(type: ResourceType): string {
        return this.getResource(type)?.iconTexture ?? 'unknown-icon';
    }

    public getMaxStackSize(type: ResourceType): number {
        return this.getResource(type)?.stackSize ?? 0;
    }

    public canStack(type: ResourceType, currentAmount: number, addAmount: number): boolean {
        const maxStack = this.getMaxStackSize(type);
        return currentAmount + addAmount <= maxStack;
    }

    public createResourceSprite(scene: Phaser.Scene, x: number, y: number, type: ResourceType): Phaser.GameObjects.Sprite {
        const resource = this.getResource(type);
        const texture = resource?.iconTexture ?? 'unknown-icon';
        return scene.add.sprite(x, y, texture);
    }

    public createResourceDisplay(
        scene: Phaser.Scene,
        x: number,
        y: number,
        type: ResourceType,
        amount: number,
        options: ResourceDisplayOptions = {}
    ): Phaser.GameObjects.Container {
        const {
            iconSize = 24,
            fontSize = '14px',
            showName = false,
            backgroundColor = 0x000000,
            backgroundAlpha = 0.7
        } = options;

        const resource = this.getResource(type);
        if (!resource) {
            console.warn(`Resource ${type} not found`);
            return scene.add.container(x, y);
        }

        const container = scene.add.container(x, y);
        const bgWidth = showName ? 120 : 60;
        
        // Fond
        const background = scene.add.rectangle(0, 0, bgWidth, 30, backgroundColor, backgroundAlpha)
            .setOrigin(0, 0.5);
        
        // Icône de la ressource
        const iconImage = scene.add.image(iconSize/2 + 5, 0, resource.iconTexture)
            .setDisplaySize(iconSize, iconSize)
            .setOrigin(0.5, 0.5);
        
        // Quantité
        const amountText = scene.add.text(iconSize + 15, 0, amount.toString(), {
            fontSize: fontSize,
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        
        container.add([background, iconImage, amountText]);

        if (showName) {
            const nameText = scene.add.text(iconSize + 15, 0, resource.name, {
                fontSize: '12px',
                color: '#cccccc'
            }).setOrigin(0, 0.5);
            container.add(nameText);
        }

        return container;
    }

    // Méthode utilitaire pour créer des stacks de ressources
    public createStack(type: ResourceType, amount: number) {
        return createResourceStack(type, amount);
    }

    // Méthode pour calculer la valeur totale d'un inventaire
    public calculateTotalValue(resources: Map<ResourceType, number>): number {
        let totalValue = 0;
        resources.forEach((amount, type) => {
            const resource = this.getResource(type);
            if (resource) {
                totalValue += amount * resource.baseValue;
            }
        });
        return totalValue;
    }

    // Méthode pour valider un type de ressource
    public isValidResourceType(type: string): type is ResourceType {
        return this.resourceDefinitions.has(type as ResourceType);
    }

    // Méthode pour nettoyer les assets (utile pour les tests)
    public clearLoadedAssets(): void {
        this.loadedAssets.clear();
    }
}