export * from './ResourceEntityTypes';
export * from './ResourceSystemTypes';

export {
    BuildingCategory,
    type BuildingConfig,
    type BuildingCost,
    type BuildingDimensions,
    type BuildingPosition,
    type BuildingStorageCapacity,
    isValidBuildingCategory,
    calculateBuildingCost,
    canAffordBuilding
} from './BuildingTypes';

export {
    WorkerState,
    WorkerType,
    type WorkerConfig,
    type WorkerStats,
    type WorkerPosition,
    type WorkerTarget,
    type WorkerSaveData,
    isValidWorkerState,
    isValidWorkerType,
    createWorkerConfig,
    createWorkerStats
} from './WorkerTypes';

export interface Position {
    readonly x: number;
    readonly y: number;
}

export interface Dimensions {
    readonly width: number;
    readonly height: number;
}

export interface TilePosition {
    readonly tileX: number;
    readonly tileY: number;
}

export interface GameEntity {
    readonly id: string;
    readonly type: string;
    readonly position: Position;
}

export interface GameSaveData {
    readonly version: string;
    readonly timestamp: number;
    readonly player: {
        readonly position: Position;
        readonly inventory: Record<string, number>;
    };
    readonly buildings: any[];
    readonly workers: WorkerSaveData[];
    readonly resources: Record<string, number>;
}

export interface GameEvent<T = any> {
    readonly type: string;
    readonly data: T;
    readonly timestamp: number;
}

export interface GameConfig {
    readonly debug: boolean;
    readonly autoSave: boolean;
    readonly autoSaveInterval: number;
    readonly maxWorkers: number;
    readonly maxBuildings: number;
}

export type DeepReadonly<T> = {
    readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;