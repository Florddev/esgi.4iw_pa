export * from './ResourceEntityTypes';
export * from './ResourceSystemTypes';

export {
    //BuildingCategory,
    type BuildingConfig,
    type BuildingCost,
    type BuildingDimensions,
    type BuildingPosition,
    type BuildingStorageCapacity,
    isValidBuildingCategory,
    calculateBuildingCost,
    canAffordBuilding
} from './BuildingTypes';

export * from './WorkerTypes';

export interface Position {
    readonly x: number;
    readonly y: number;
}