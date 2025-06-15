import { Scene } from 'phaser'
import { Lumberjack } from '../objects/workers/Lumberjack'
import { Worker, WorkerState } from '../objects/workers/Worker'
import { WorkerType, type WorkerConfig, type WorkerPosition } from '../types'

interface WorkerDefinition {
  readonly type: WorkerType
  readonly name: string
  readonly description: string
  readonly icon: string
  readonly config: WorkerConfig
  readonly createInstance: (scene: Scene, x: number, y: number, depositPoint?: WorkerPosition) => Worker
}

export class WorkerRegistry {
  private static instance: WorkerRegistry
  private readonly workers = new Map<WorkerType, WorkerDefinition>()

  private constructor() {
    this.initializeWorkers()
  }

  public static getInstance(): WorkerRegistry {
    if (!WorkerRegistry.instance) {
      WorkerRegistry.instance = new WorkerRegistry()
    }
    return WorkerRegistry.instance
  }

  private initializeWorkers(): void {
    const workerDefinitions: WorkerDefinition[] = [
      {
        type: WorkerType.LUMBERJACK,
        name: 'Bûcheron',
        description: 'Coupe les arbres et récolte le bois',
        icon: 'worker',
        config: {
          maxInventory: 10,
          harvestSpeed: 3000,
          moveSpeed: 70,
          workRadius: 500,
          efficiency: 1.0
        },
        createInstance: (scene: Scene, x: number, y: number, depositPoint?: WorkerPosition) => {
          return new Lumberjack(scene, x, y, depositPoint)
        }
      }
      // Future workers can be added here:
      // {
      //   type: WorkerType.MINER,
      //   name: 'Mineur',
      //   description: 'Extrait la pierre et les métaux',
      //   icon: 'pickaxe',
      //   config: { ... },
      //   createInstance: (scene, x, y, depositPoint) => new Miner(scene, x, y, depositPoint)
      // }
    ]

    workerDefinitions.forEach(definition => {
      this.workers.set(definition.type, definition)
    })
  }

  public getWorkerDefinition(type: WorkerType): WorkerDefinition | undefined {
    return this.workers.get(type)
  }

  public getAllWorkerDefinitions(): readonly WorkerDefinition[] {
    return Array.from(this.workers.values())
  }

  public getAvailableWorkerTypes(): readonly WorkerType[] {
    return Array.from(this.workers.keys())
  }

  public getWorkerConfig(type: WorkerType): WorkerConfig | undefined {
    const definition = this.workers.get(type)
    return definition?.config
  }

  public getWorkerName(type: WorkerType): string {
    const definition = this.workers.get(type)
    return definition?.name || type.toString()
  }

  public getWorkerDescription(type: WorkerType): string {
    const definition = this.workers.get(type)
    return definition?.description || ''
  }

  public isValidWorkerType(type: string): type is WorkerType {
    return this.workers.has(type as WorkerType)
  }

  public createWorker(
    type: WorkerType,
    scene: Scene,
    x: number,
    y: number,
    depositPoint?: WorkerPosition
  ): Worker | null {
    const definition = this.workers.get(type)
    
    if (!definition) {
      console.error(`Worker type ${type} not found in registry`)
      return null
    }

    try {
      return definition.createInstance(scene, x, y, depositPoint)
    } catch (error) {
      console.error(`Failed to create worker of type ${type}:`, error)
      return null
    }
  }

  public getImplementedWorkerTypes(): readonly WorkerType[] {
    return this.getAvailableWorkerTypes()
  }

  public getPlannedWorkerTypes(): readonly WorkerType[] {
    // Return types that are defined in the enum but not implemented yet
    const implemented = new Set(this.getAvailableWorkerTypes())
    return Object.values(WorkerType).filter(type => !implemented.has(type))
  }

  // Statistics and utilities
  public getWorkerTypeFromInstance(worker: Worker): WorkerType | null {
    for (const [type, definition] of this.workers) {
      if (worker instanceof (definition.createInstance as any).constructor) {
        return type
      }
    }
    
    // Fallback: try to determine from class name
    const className = worker.constructor.name.toLowerCase()
    if (className.includes('lumberjack')) return WorkerType.LUMBERJACK
    if (className.includes('miner')) return WorkerType.MINER
    if (className.includes('farmer')) return WorkerType.FARMER
    if (className.includes('builder')) return WorkerType.BUILDER
    
    return null
  }

  public calculateWorkerEfficiency(worker: Worker): number {
    const type = this.getWorkerTypeFromInstance(worker)
    if (!type) return 1.0

    const config = this.getWorkerConfig(type)
    if (!config) return 1.0

    // Base efficiency from config
    let efficiency = config.efficiency || 1.0

    // Could add modifiers based on worker state, building proximity, etc.
    const stats = worker.getStats()
    if (stats.timeWorked > 0) {
      // Slight efficiency bonus for experienced workers
      const experienceBonus = Math.min(0.2, stats.timeWorked / 100000 * 0.1)
      efficiency += experienceBonus
    }

    return Math.min(2.0, efficiency) // Cap at 200% efficiency
  }
}