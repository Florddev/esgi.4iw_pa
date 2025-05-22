export enum ResourceType {
    WOOD = 'wood',
    STONE = 'stone',
    FOOD = 'food',
    PLANKS = 'planks',
    TOOLS = 'tools',
    METAL = 'metal'
}

export enum ResourceCategory {
    RAW_MATERIAL = 'raw_material',
    PROCESSED = 'processed',
    CONSUMABLE = 'consumable',
    TOOL = 'tool'
}

export interface ResourceDefinition {
    readonly id: ResourceType;
    readonly name: string;
    readonly description: string;
    readonly iconTexture: string;
    readonly category: ResourceCategory;
    readonly baseValue: number;
    readonly stackSize: number;
    readonly color: number;
}

export interface ResourceStack {
    readonly type: ResourceType;
    amount: number;
}

export interface ResourceStorage {
    readonly capacity: ReadonlyMap<ResourceType, number>;
    readonly stored: Map<ResourceType, number>;
}

export interface ResourceStorageConfig {
    readonly [key in ResourceType]?: number;
}

// Type guards pour la validation
export const isValidResourceType = (value: string): value is ResourceType => {
    return Object.values(ResourceType).includes(value as ResourceType);
};

export const isValidResourceCategory = (value: string): value is ResourceCategory => {
    return Object.values(ResourceCategory).includes(value as ResourceCategory);
};

// Utilitaires de création
export const createResourceStack = (type: ResourceType, amount: number): ResourceStack => ({
    type,
    amount: Math.max(0, amount)
});

export const createResourceStorage = (config: ResourceStorageConfig): ResourceStorage => ({
    capacity: new Map(Object.entries(config) as [ResourceType, number][]),
    stored: new Map(Object.keys(config).map(key => [key as ResourceType, 0]))
});