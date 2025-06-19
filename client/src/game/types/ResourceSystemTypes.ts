export enum ResourceType {
    // Raw materials
    WOOD = 'wood',
    STONE = 'stone',
    FOOD = 'food',
    METAL_ORE = 'metal_ore',
    COAL_ORE = 'coal_ore',

    // Processed materials
    PLANKS = 'planks',
    METAL = 'metal',
    TOOLS = 'tools',

    // Special resources
    ENERGY = 'energy',
    POPULATION = 'population'
}

export enum ResourceCategory {
    ORE = 'ORE',
    RAW_MATERIAL = 'raw_material',
    PROCESSED = 'processed',
    CONSUMABLE = 'consumable',
    TOOL = 'tool',
    SPECIAL = 'special'
}

export interface ResourceDefinition {
    readonly id: ResourceType;
    readonly name: string;
    readonly description: string;
    readonly category: ResourceCategory;
    readonly iconTexture: string;
    readonly color: number;
    readonly baseValue: number;
    readonly stackSize: number;
    readonly isConsumable: boolean;
    readonly canTrade: boolean;
}

export interface ResourceStack {
    readonly type: ResourceType;
    amount: number;
}

export interface ResourceCost {
    readonly [key in ResourceType]?: number;
}

export interface ResourceDrop {
    readonly type: ResourceType;
    readonly amount: number;
    readonly chance: number;
}

export interface ResourceStorage {
    readonly capacity: ReadonlyMap<ResourceType, number>;
    readonly stored: Map<ResourceType, number>;
}

export interface ResourceTransaction {
    readonly id: string;
    readonly type: 'add' | 'remove' | 'transfer';
    readonly resource: ResourceType;
    readonly amount: number;
    readonly source?: string;
    readonly target?: string;
    readonly timestamp: number;
    readonly success: boolean;
}

// Type guards
export const isValidResourceType = (value: string): value is ResourceType => {
    return Object.values(ResourceType).includes(value as ResourceType);
};

export const isValidResourceCategory = (value: string): value is ResourceCategory => {
    return Object.values(ResourceCategory).includes(value as ResourceCategory);
};

// Utility functions
export const createResourceStack = (type: ResourceType, amount: number): ResourceStack => ({
    type,
    amount: Math.max(0, amount)
});

export const createResourceStorage = (capacity: Partial<Record<ResourceType, number>>): ResourceStorage => ({
    capacity: new Map(Object.entries(capacity) as [ResourceType, number][]),
    stored: new Map(Object.keys(capacity).map(key => [key as ResourceType, 0]))
});