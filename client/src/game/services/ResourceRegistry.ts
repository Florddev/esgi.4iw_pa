import { type ResourceDefinition, ResourceType, ResourceCategory } from '../types';
import { RESOURCE_DEFINITIONS } from '../configs/ResourceConfigs';

export class ResourceRegistry {
    private static instance: ResourceRegistry;
    private readonly definitions = new Map<ResourceType, ResourceDefinition>();
    private readonly definitionsByCategory = new Map<ResourceCategory, ResourceDefinition[]>();
    private readonly loadedAssets = new Set<string>();

    private constructor() {
        this.initializeDefinitions();
    }

    public static getInstance(): ResourceRegistry {
        if (!ResourceRegistry.instance) {
            ResourceRegistry.instance = new ResourceRegistry();
        }
        return ResourceRegistry.instance;
    }

    private initializeDefinitions(): void {
        Object.values(RESOURCE_DEFINITIONS).forEach(definition => {
            this.definitions.set(definition.id, definition);

            // Group by category
            if (!this.definitionsByCategory.has(definition.category)) {
                this.definitionsByCategory.set(definition.category, []);
            }
            this.definitionsByCategory.get(definition.category)!.push(definition);
        });
    }

    public getDefinition(type: ResourceType): ResourceDefinition | undefined {
        return this.definitions.get(type);
    }

    public getAllDefinitions(): readonly ResourceDefinition[] {
        return Array.from(this.definitions.values());
    }

    public getDefinitionsByCategory(category: ResourceCategory): readonly ResourceDefinition[] {
        return this.definitionsByCategory.get(category) || [];
    }

    public getAvailableTypes(): readonly ResourceType[] {
        return Array.from(this.definitions.keys());
    }

    public isValidType(type: string): type is ResourceType {
        return this.definitions.has(type as ResourceType);
    }

    public getName(type: ResourceType): string {
        return this.getDefinition(type)?.name || 'Unknown';
    }

    public getDescription(type: ResourceType): string {
        return this.getDefinition(type)?.description || '';
    }

    public getColor(type: ResourceType): number {
        return this.getDefinition(type)?.color || 0xFFFFFF;
    }

    public getIconTexture(type: ResourceType): string {
        return this.getDefinition(type)?.iconTexture || 'unknown-icon';
    }

    public getBaseValue(type: ResourceType): number {
        return this.getDefinition(type)?.baseValue || 0;
    }

    public getStackSize(type: ResourceType): number {
        return this.getDefinition(type)?.stackSize || 1;
    }

    public isConsumable(type: ResourceType): boolean {
        return this.getDefinition(type)?.isConsumable || false;
    }

    public canTrade(type: ResourceType): boolean {
        return this.getDefinition(type)?.canTrade || false;
    }

    public canStack(type: ResourceType, currentAmount: number, addAmount: number): boolean {
        const maxStack = this.getStackSize(type);
        return currentAmount + addAmount <= maxStack;
    }

    public calculateValue(resources: Map<ResourceType, number>): number {
        let totalValue = 0;
        resources.forEach((amount, type) => {
            const definition = this.getDefinition(type);
            if (definition) {
                totalValue += amount * definition.baseValue;
            }
        });
        return totalValue;
    }

    // Asset management
    public prepareSceneLoading(scene: Phaser.Scene): void {
        this.getAllDefinitions().forEach(definition => {
            if (!this.loadedAssets.has(definition.iconTexture)) {
                scene.load.image(definition.iconTexture, `ui/resources/${definition.id}.png`);
                this.loadedAssets.add(definition.iconTexture);
            }
        });
    }

    public areAssetsLoaded(): boolean {
        return this.getAllDefinitions().every(definition =>
            this.loadedAssets.has(definition.iconTexture)
        );
    }

    public createResourceSprite(scene: Phaser.Scene, x: number, y: number, type: ResourceType): Phaser.GameObjects.Sprite {
        const texture = this.getIconTexture(type);
        return scene.add.sprite(x, y, texture);
    }
}