import { Scene } from 'phaser';
type Scene = typeof Scene;

import { Worker } from '../objects/workers/Worker.ts';
import { type WorkerConfig, WorkerType, type WorkerPosition } from '../types/WorkerConfigTypes';
import { WORKER_CONFIGS } from '../configs/WorkerConfigs';

interface WorkerDefinition {
  readonly config: WorkerConfig;
  readonly createInstance: (scene: Scene, x: number, y: number, depositPoint?: WorkerPosition) => Worker;
}

export class WorkerRegistry {
  private static instance: WorkerRegistry;
  private readonly workers = new Map<WorkerType, WorkerDefinition>();

  private constructor() {
    this.initializeWorkers();
  }

  public static getInstance(): WorkerRegistry {
    if (!WorkerRegistry.instance) {
      WorkerRegistry.instance = new WorkerRegistry();
    }
    return WorkerRegistry.instance;
  }

  private initializeWorkers(): void {
    Object.values(WORKER_CONFIGS).forEach(config => {
      this.workers.set(config.id, {
        config,
        createInstance: (scene: Scene, x: number, y: number, depositPoint?: WorkerPosition) =>
            new Worker(scene, x, y, config, depositPoint)
      });
    });
  }

  public getWorkerConfig(type: WorkerType): WorkerConfig | undefined {
    return this.workers.get(type)?.config;
  }

  public createWorker(type: WorkerType, scene: Scene, x: number, y: number, depositPoint?: WorkerPosition): Worker | null {
    const definition = this.workers.get(type);
    if (!definition) {
      return null;
    }

    try {
      return definition.createInstance(scene, x, y, depositPoint);
    } catch (error) {
      return null;
    }
  }

  public getWorkerName(type: WorkerType): string {
    return this.workers.get(type)?.config.name || type;
  }

  public isValidWorkerType(type: string): type is WorkerType {
    return this.workers.has(type as WorkerType);
  }

  public getAllWorkerTypes(): readonly WorkerType[] {
    return Array.from(this.workers.keys());
  }

  public getAllConfigs(): readonly WorkerConfig[] {
    return Array.from(this.workers.values()).map(def => def.config);
  }
}