export {
    WorkerType,
    WorkerState,
    WorkerActionType,
} from './WorkerConfigTypes';

export type {
    WorkerPosition,
    WorkerConfig,
    WorkerStats,
    WorkerTargetConfig,
    WorkerAnimationConfig
} from './WorkerConfigTypes';

export interface LegacyWorkerConfig {
    maxInventory: number;
    harvestSpeed: number;
    moveSpeed: number;
    workRadius: number;
    efficiency: number;
}