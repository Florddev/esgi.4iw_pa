export enum WorkerState {
    IDLE = 'idle',
    MOVING_TO_RESOURCE = 'movingToResource',
    HARVESTING = 'harvesting',
    MOVING_TO_STORAGE = 'movingToStorage',
    DEPOSITING = 'depositing'
}

export enum WorkerType {
    LUMBERJACK = 'lumberjack',
    MINER = 'miner',
    FARMER = 'farmer',
    BUILDER = 'builder'
}

export interface WorkerConfig {
    readonly maxInventory: number;
    readonly harvestSpeed: number;
    readonly moveSpeed: number;
    readonly workRadius?: number;
    readonly efficiency?: number;
}

export interface WorkerStats {
    readonly totalHarvested: number;
    readonly totalDeposited: number;
    readonly timeWorked: number;
    readonly efficiency: number;
}

export interface WorkerPosition {
    readonly x: number;
    readonly y: number;
}

export interface WorkerTarget {
    readonly position: WorkerPosition;
    readonly type: 'resource' | 'storage' | 'deposit_point';
    readonly entity?: any;
}

export interface WorkerSaveData {
    readonly type: WorkerType;
    readonly position: WorkerPosition;
    readonly state: WorkerState;
    readonly inventory: Record<string, number>;
    readonly depositPoint?: WorkerPosition;
    readonly stats: WorkerStats;
}

// Type guards
export const isValidWorkerState = (value: string): value is WorkerState => {
    return Object.values(WorkerState).includes(value as WorkerState);
};

export const isValidWorkerType = (value: string): value is WorkerType => {
    return Object.values(WorkerType).includes(value as WorkerType);
};

// Utilitaires
export const createWorkerConfig = (overrides: Partial<WorkerConfig> = {}): WorkerConfig => ({
    maxInventory: 10,
    harvestSpeed: 3000,
    moveSpeed: 70,
    workRadius: 500,
    efficiency: 1.0,
    ...overrides
});

export const createWorkerStats = (): WorkerStats => ({
    totalHarvested: 0,
    totalDeposited: 0,
    timeWorked: 0,
    efficiency: 1.0
});