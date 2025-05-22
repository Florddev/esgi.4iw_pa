// Export des classes de workers
export { Worker, WorkerState } from './Worker';
export { Lumberjack } from './Lumberjack';

// Types spécifiques aux workers
export type { ResourceType } from './Worker';

// Factory pour créer des workers
import { Scene } from 'phaser';
import { Lumberjack } from './Lumberjack';
import type { WorkerType, WorkerPosition } from '../types';

export interface WorkerFactoryConfig {
    readonly position: WorkerPosition;
    readonly depositPoint?: WorkerPosition;
    readonly customConfig?: Record<string, any>;
}

export class WorkerFactory {
    /**
     * Crée un worker du type spécifié
     */
    public static createWorker(
        scene: Scene,
        type: WorkerType,
        config: WorkerFactoryConfig
    ): Worker | null {
        const { position, depositPoint, customConfig } = config;

        switch (type) {
            case WorkerType.LUMBERJACK:
                return new Lumberjack(scene, position.x, position.y, depositPoint);
            
            // Futurs types de workers
            case WorkerType.MINER:
                // return new Miner(scene, position.x, position.y, depositPoint);
                console.warn('Miner worker not implemented yet');
                return null;
                
            case WorkerType.FARMER:
                // return new Farmer(scene, position.x, position.y, depositPoint);
                console.warn('Farmer worker not implemented yet');
                return null;
                
            case WorkerType.BUILDER:
                // return new Builder(scene, position.x, position.y, depositPoint);
                console.warn('Builder worker not implemented yet');
                return null;
            
            default:
                console.error(`Unknown worker type: ${type}`);
                return null;
        }
    }

    /**
     * Crée un lumberjack avec une configuration simplifiée
     */
    public static createLumberjack(
        scene: Scene,
        x: number,
        y: number,
        depositPoint?: WorkerPosition
    ): Lumberjack {
        return new Lumberjack(scene, x, y, depositPoint);
    }

    /**
     * Valide si un type de worker peut être créé
     */
    public static canCreateWorker(type: WorkerType): boolean {
        const implementedTypes = [WorkerType.LUMBERJACK];
        return implementedTypes.includes(type);
    }

    /**
     * Retourne la liste des types de workers implémentés
     */
    public static getImplementedWorkerTypes(): readonly WorkerType[] {
        return [WorkerType.LUMBERJACK] as const;
    }

    /**
     * Retourne la liste des types de workers prévus mais non implémentés
     */
    public static getPlannedWorkerTypes(): readonly WorkerType[] {
        return [
            WorkerType.MINER,
            WorkerType.FARMER,
            WorkerType.BUILDER
        ] as const;
    }
}

// Utilitaires pour la gestion des workers
export class WorkerUtils {
    /**
     * Calcule la distance entre deux workers
     */
    public static getDistanceBetween(worker1: Worker, worker2: Worker): number {
        return Phaser.Math.Distance.Between(worker1.x, worker1.y, worker2.x, worker2.y);
    }

    /**
     * Trouve le worker le plus proche d'une position donnée
     */
    public static findClosestWorker(
        workers: readonly Worker[],
        position: WorkerPosition
    ): Worker | null {
        if (workers.length === 0) return null;

        return workers.reduce((closest, current) => {
            const closestDist = Phaser.Math.Distance.Between(
                position.x, position.y,
                closest.x, closest.y
            );
            
            const currentDist = Phaser.Math.Distance.Between(
                position.x, position.y,
                current.x, current.y
            );
            
            return currentDist < closestDist ? current : closest;
        });
    }

    /**
     * Filtre les workers par état
     */
    public static filterWorkersByState(
        workers: readonly Worker[],
        state: WorkerState
    ): readonly Worker[] {
        return workers.filter(worker => worker.getState() === state);
    }

    /**
     * Calcule les statistiques globales d'un groupe de workers
     */
    public static calculateGroupStats(workers: readonly Worker[]): {
        readonly totalWorkers: number;
        readonly idleWorkers: number;
        readonly activeWorkers: number;
        readonly averageInventoryUsage: number;
        readonly stateDistribution: Record<WorkerState, number>;
    } {
        const stateDistribution = {
            [WorkerState.IDLE]: 0,
            [WorkerState.MOVING_TO_RESOURCE]: 0,
            [WorkerState.HARVESTING]: 0,
            [WorkerState.MOVING_TO_STORAGE]: 0,
            [WorkerState.DEPOSITING]: 0
        };

        let totalInventoryUsage = 0;

        workers.forEach(worker => {
            const state = worker.getState();
            stateDistribution[state]++;
            totalInventoryUsage += worker.getInventoryTotal();
        });

        const activeStates = [
            WorkerState.MOVING_TO_RESOURCE,
            WorkerState.HARVESTING,
            WorkerState.MOVING_TO_STORAGE,
            WorkerState.DEPOSITING
        ];

        return {
            totalWorkers: workers.length,
            idleWorkers: stateDistribution[WorkerState.IDLE],
            activeWorkers: activeStates.reduce((sum, state) => sum + stateDistribution[state], 0),
            averageInventoryUsage: workers.length > 0 ? totalInventoryUsage / workers.length : 0,
            stateDistribution
        };
    }

    /**
     * Valide qu'un worker est dans un état cohérent
     */
    public static validateWorkerState(worker: Worker): boolean {
        try {
            const state = worker.getState();
            const inventory = worker.getInventoryTotal();
            
            // Vérifications de base
            if (!Object.values(WorkerState).includes(state)) {
                console.error(`Worker has invalid state: ${state}`);
                return false;
            }

            if (inventory < 0) {
                console.error(`Worker has negative inventory: ${inventory}`);
                return false;
            }

            // Vérifications spécifiques à l'état
            switch (state) {
                case WorkerState.HARVESTING:
                    if (worker.isInventoryFull()) {
                        console.warn('Worker is harvesting but inventory is full');
                        return false;
                    }
                    break;
                    
                case WorkerState.DEPOSITING:
                    if (inventory === 0) {
                        console.warn('Worker is depositing but inventory is empty');
                        return false;
                    }
                    break;
            }

            return true;
        } catch (error) {
            console.error('Error validating worker state:', error);
            return false;
        }
    }

    /**
     * Trouve les workers dans un rayon donné autour d'une position
     */
    public static findWorkersInRadius(
        workers: readonly Worker[],
        position: WorkerPosition,
        radius: number
    ): readonly Worker[] {
        return workers.filter(worker => {
            const distance = Phaser.Math.Distance.Between(
                position.x, position.y,
                worker.x, worker.y
            );
            return distance <= radius;
        });
    }

    /**
     * Calcule l'efficacité globale d'un groupe de workers
     */
    public static calculateGroupEfficiency(workers: readonly Worker[]): number {
        if (workers.length === 0) return 0;

        const stats = this.calculateGroupStats(workers);
        const workingStates = [
            WorkerState.MOVING_TO_RESOURCE,
            WorkerState.HARVESTING,
            WorkerState.MOVING_TO_STORAGE,
            WorkerState.DEPOSITING
        ];

        const workingWorkers = workingStates.reduce(
            (sum, state) => sum + stats.stateDistribution[state], 
            0
        );

        return workers.length > 0 ? workingWorkers / workers.length : 0;
    }
}

// Re-export des types depuis le module types
export type { 
    WorkerType, 
    WorkerConfig, 
    WorkerStats, 
    WorkerPosition, 
    WorkerTarget,
    WorkerSaveData
} from '../types';