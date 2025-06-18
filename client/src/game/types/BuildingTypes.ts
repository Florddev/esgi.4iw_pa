import type { ResourceType } from './ResourceSystemTypes';

export interface BuildingCost {
    readonly [resourceType: string]: number;
}

export interface BuildingConfig {
    readonly key: string;
    readonly name: string;
    readonly template: string;
    readonly icon: string;
    readonly cost: BuildingCost;
    readonly description?: string;
    //readonly category?: BuildingCategory;
}

export enum BuildingType {
    HOUSE = 'house',
    SAWMILL = 'sawmill',
    MINE = 'mine',
    FARM = 'farm',
    STORAGE = 'storage'
}
/*
export enum BuildingCategory {
    HOUSING = 'housing',
    PRODUCTION = 'production', 
    STORAGE = 'storage',
    UTILITY = 'utility'
}
*/

export interface BuildingDimensions {
    readonly tilesWidth: number;
    readonly tilesHeight: number;
}

export interface BuildingPosition {
    readonly x: number;
    readonly y: number;
}

export interface BuildingStorageCapacity {
    readonly [key in ResourceType]?: number;
}

// Type guards
export const isValidBuildingCategory = (value: string): value is BuildingCategory => {
    return Object.values(BuildingCategory).includes(value as BuildingCategory);
};

// Utilitaires
export const calculateBuildingCost = (config: BuildingConfig): number => {
    return Object.values(config.cost).reduce((total, cost) => total + cost, 0);
};

export const canAffordBuilding = (config: BuildingConfig, resources: Record<string, number>): boolean => {
    return Object.entries(config.cost).every(([resource, cost]) => 
        (resources[resource] || 0) >= cost
    );
};