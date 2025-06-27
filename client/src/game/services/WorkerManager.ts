import { Scene } from 'phaser';
type Scene = typeof Scene;

import { Worker } from '../objects/workers';
import { WorkerRegistry } from './WorkerRegistry';
import { WorkerType, type WorkerPosition } from '../types';

export class WorkerManager {
    private readonly scene: Scene;
    private readonly registry: WorkerRegistry;
    private readonly workers = new Map<string, Worker>();
    private nextWorkerId: number = 1;

    constructor(scene: Scene) {
        this.scene = scene;
        this.registry = WorkerRegistry.getInstance();

        console.log('WorkerManager: Initialized');
    }

    public createWorker(type: WorkerType, x: number, y: number, depositPoint?: WorkerPosition): Worker | null {
        try {
            console.log(`WorkerManager: Creating worker ${type} at (${x}, ${y})`);

            const worker = this.registry.createWorker(type, this.scene, x, y, depositPoint);
            if (!worker) {
                console.error(`WorkerManager: Registry failed to create worker ${type}`);
                return null;
            }

            const id = `worker_${type}_${this.nextWorkerId++}`;
            this.workers.set(id, worker);

            console.log(`WorkerManager: Created worker ${id}`);

            // Notifier Vue.js
            window.dispatchEvent(new CustomEvent('game:workerCreated', {
                detail: {
                    id,
                    type,
                    position: { x, y },
                    config: worker.getConfig()
                }
            }));

            return worker;

        } catch (error) {
            console.error(`WorkerManager: Error creating worker ${type}:`, error);
            return null;
        }
    }

    public removeWorker(workerId: string): boolean {
        const worker = this.workers.get(workerId);
        if (!worker) {
            console.warn(`WorkerManager: Worker ${workerId} not found`);
            return false;
        }

        try {
            worker.destroy();
            this.workers.delete(workerId);
            console.log(`WorkerManager: Removed worker ${workerId}`);

            // Notifier Vue.js
            window.dispatchEvent(new CustomEvent('game:workerRemoved', {
                detail: { id: workerId }
            }));

            return true;

        } catch (error) {
            console.error(`WorkerManager: Error removing worker ${workerId}:`, error);
            return false;
        }
    }

    public getWorker(workerId: string): Worker | null {
        return this.workers.get(workerId) || null;
    }

    public getAllWorkers(): readonly Worker[] {
        return Array.from(this.workers.values());
    }

    public getWorkersByType(type: WorkerType): readonly Worker[] {
        return Array.from(this.workers.values()).filter(worker =>
            worker.getConfig().id === type
        );
    }

    public getWorkerCount(type?: WorkerType): number {
        if (type) {
            return this.getWorkersByType(type).length;
        }
        return this.workers.size;
    }

    public findNearestDepositPoint(workerType: WorkerType, position: WorkerPosition): WorkerPosition | null {
        try {
            const config = this.registry.getWorkerConfig(workerType);
            if (!config) return null;

            const buildingManager = (this.scene as any).buildingManager;
            if (!buildingManager) {
                console.log(`WorkerManager: No buildingManager available`);
                return null;
            }

            let bestPosition: WorkerPosition | null = null;
            let bestDistance = Infinity;

            config.depositTargets.forEach(target => {
                target.targetTypes.forEach(buildingType => {
                    const buildings = buildingManager.getBuildingsByType(buildingType);
                    buildings.forEach((building: any) => {
                        const buildingPos = building.getPosition();
                        const distance = Phaser.Math.Distance.Between(
                            position.x, position.y,
                            buildingPos.x, buildingPos.y
                        );

                        if (distance < bestDistance) {
                            bestDistance = distance;
                            bestPosition = buildingPos;
                        }
                    });
                });
            });

            return bestPosition;

        } catch (error) {
            console.error('WorkerManager: Error finding deposit point:', error);
            return null;
        }
    }

    public pauseAllWorkers(): void {
        this.workers.forEach(worker => {
            worker.forceIdle();
        });
        console.log('WorkerManager: Paused all workers');
    }

    public resumeAllWorkers(): void {
        this.workers.forEach(worker => {
            worker.forceIdle(); // This will restart their main loop
        });
        console.log('WorkerManager: Resumed all workers');
    }

    public clearAllWorkers(): void {
        console.log('WorkerManager: Clearing all workers');

        this.workers.forEach((worker, id) => {
            try {
                worker.destroy();
            } catch (error) {
                console.error(`WorkerManager: Error destroying worker ${id}:`, error);
            }
        });

        this.workers.clear();
        this.nextWorkerId = 1;

        // Notifier Vue.js
        window.dispatchEvent(new CustomEvent('game:allWorkersCleared'));
    }

    public update(): void {
        // Les workers se mettent à jour automatiquement via leur boucle interne
        // Cette méthode peut être utilisée pour des tâches de maintenance globales

        // Nettoyer les workers détruits
        const destroyedWorkers: string[] = [];
        this.workers.forEach((worker, id) => {
            if (!worker.scene || !worker.active) {
                destroyedWorkers.push(id);
            }
        });

        destroyedWorkers.forEach(id => {
            console.log(`WorkerManager: Cleaning up destroyed worker ${id}`);
            this.workers.delete(id);
        });
    }

    public destroy(): void {
        this.clearAllWorkers();
    }

    // Méthodes de compatibilité avec l'ancien système
    public createLumberjack(x: number, y: number, depositPoint?: WorkerPosition): Worker | null {
        return this.createWorker(WorkerType.LUMBERJACK, x, y, depositPoint);
    }

    public getWorkers(): readonly Worker[] {
        return this.getAllWorkers();
    }

    public getWorkersByType_Legacy(type: any): readonly Worker[] {
        // Conversion pour l'ancien système
        if (typeof type === 'string') {
            return this.getWorkersByType(type as WorkerType);
        }
        return [];
    }
}