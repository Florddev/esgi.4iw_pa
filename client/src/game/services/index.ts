import {BuildingRegistry} from "./BuildingRegistry";

export { BuildingManager } from './BuildingManager'
export { BuildingRegistry } from './BuildingRegistry'
export { WorkerManager } from './WorkerManager'
export { WorkerRegistry } from './WorkerRegistry'
export { ResourceRegistry } from './ResourceRegistry';
export { ResourceInventory } from './ResourceInventory';
export { ResourceManager } from './ResourceManager';
export { 
    AnimationRegistry, 
    AnimationType,
    type AnimationConfig,
    type AnimationFrameConfig 
} from './AnimationRegistry'
export { 
    DialogService, 
    type DialogConfig, 
    DialogPriority, 
    type DialogStyle 
} from './DialogService'

export { ResourceEntityRegistry } from './ResourceEntityRegistry';
export { ResourceEntityManager } from './ResourceEntityManager';

export { AnimationUtils } from '../utils/AnimationUtils'

export interface ServiceEvent<T = any> {
    readonly type: string
    readonly data: T
    readonly timestamp: number
    readonly source: string
}

export type ServiceEventCallback<T = any> = (event: ServiceEvent<T>) => void

export interface EventEmittingService {
    on(event: string, callback: ServiceEventCallback): void
    off(event: string, callback: ServiceEventCallback): void
    emit(event: string, data?: any): void
}

export interface PersistentService {
    saveState(): void
    loadState(): void
    clearState(): void
}

export class ServiceManager {
    private static instance: ServiceManager
    private readonly services = new Map<string, any>()
    private readonly eventBus = new Map<string, Set<ServiceEventCallback>>()

    private constructor() {}

    public static getInstance(): ServiceManager {
        if (!ServiceManager.instance) {
            ServiceManager.instance = new ServiceManager()
        }
        return ServiceManager.instance
    }

    public registerService<T>(name: string, service: T): void {
        this.services.set(name, service)
    }

    public getService<T>(name: string): T | undefined {
        return this.services.get(name)
    }

    public hasService(name: string): boolean {
        return this.services.has(name)
    }

    public removeService(name: string): boolean {
        return this.services.delete(name)
    }

    public on(event: string, callback: ServiceEventCallback): void {
        if (!this.eventBus.has(event)) {
            this.eventBus.set(event, new Set())
        }
        this.eventBus.get(event)!.add(callback)
    }

    public off(event: string, callback: ServiceEventCallback): void {
        const callbacks = this.eventBus.get(event)
        if (callbacks) {
            callbacks.delete(callback)
        }
    }

    public emit(event: string, data?: any, source?: string): void {
        const serviceEvent: ServiceEvent = {
            type: event,
            data,
            timestamp: Date.now(),
            source: source || 'unknown'
        }

        const callbacks = this.eventBus.get(event)
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(serviceEvent)
                } catch (error) {
                    console.error(`Error in callback for event ${event}:`, error)
                }
            })
        }
    }

    public saveAllStates(): void {
        this.services.forEach((service, name) => {
            if (this.isPersistentService(service)) {
                try {
                    service.saveState()
                } catch (error) {
                    console.error(`Error saving service ${name}:`, error)
                }
            }
        })
    }

    public loadAllStates(): void {
        this.services.forEach((service, name) => {
            if (this.isPersistentService(service)) {
                try {
                    service.loadState()
                } catch (error) {
                    console.error(`Error loading service ${name}:`, error)
                }
            }
        })
    }

    public clearAllStates(): void {
        this.services.forEach((service, name) => {
            if (this.isPersistentService(service)) {
                try {
                    service.clearState()
                } catch (error) {
                    console.error(`Error clearing service ${name}:`, error)
                }
            }
        })
    }

    private isPersistentService(service: any): service is PersistentService {
        return service && 
               typeof service.saveState === 'function' &&
               typeof service.loadState === 'function' &&
               typeof service.clearState === 'function'
    }

    public getServiceStats(): Record<string, any> {
        const stats: Record<string, any> = {}
        
        this.services.forEach((service, name) => {
            stats[name] = {
                type: service.constructor.name,
                hasEventSupport: typeof service.on === 'function',
                hasPersistence: this.isPersistentService(service)
            }
        })

        return stats
    }

    public destroy(): void {
        this.services.forEach((service, name) => {
            if (typeof service.destroy === 'function') {
                try {
                    service.destroy()
                } catch (error) {
                    console.error(`Error destroying service ${name}:`, error)
                }
            }
        })

        this.services.clear()
        this.eventBus.clear()
    }
}

export interface ServicesConfig {
    readonly enableResourceManager: boolean
    readonly enablePlayerInventory: boolean
    readonly enableBuildingManager: boolean
    readonly enableWorkerManager: boolean
    readonly enableDialogService: boolean
    readonly enableAnimationRegistry: boolean
    readonly autoSave: boolean
    readonly autoSaveInterval: number
}

export const DEFAULT_SERVICES_CONFIG: ServicesConfig = {
    enableResourceManager: true,
    enablePlayerInventory: true,
    enableBuildingManager: true,
    enableWorkerManager: true,
    enableDialogService: true,
    enableAnimationRegistry: true,
    autoSave: true,
    autoSaveInterval: 30000 // 30 seconds
}

export class ServicesFactory {
    public static createServices(scene: Phaser.Scene, config: Partial<ServicesConfig> = {}): ServiceManager {
        const finalConfig = { ...DEFAULT_SERVICES_CONFIG, ...config }
        const serviceManager = ServiceManager.getInstance()

        if (finalConfig.enableAnimationRegistry) {
            const animationRegistry = AnimationRegistry.getInstance()
            serviceManager.registerService('animationRegistry', animationRegistry)
        }

        if (finalConfig.enableResourceManager) {
            const resourceManager = ResourceManager.getInstance()
            serviceManager.registerService('resourceManager', resourceManager)
        }

        if (finalConfig.enablePlayerInventory) {
            const playerInventory = new PlayerInventory()
            serviceManager.registerService('playerInventory', playerInventory)
        }

        if (finalConfig.enableBuildingManager) {
            const buildingManager = new BuildingManager(scene)
            serviceManager.registerService('buildingManager', buildingManager)
        }

        if (finalConfig.enableWorkerManager) {
            const workerManager = new WorkerManager(scene)
            serviceManager.registerService('workerManager', workerManager)
        }

        if (finalConfig.enableDialogService) {
            const dialogService = new DialogService(scene)
            serviceManager.registerService('dialogService', dialogService)
        }

        if (finalConfig.autoSave) {
            scene.time.addEvent({
                delay: finalConfig.autoSaveInterval,
                callback: () => serviceManager.saveAllStates(),
                loop: true
            })
        }

        return serviceManager
    }

    /**
     * Initialize animations for a scene with proper entity type detection
     */
    public static initializeSceneAnimations(
        scene: Phaser.Scene,
        entityTypes: Array<'player' | 'worker' | 'tree' | 'effects'> = ['player', 'worker', 'tree', 'effects']
    ): void {
        const animationRegistry = AnimationRegistry.getInstance()

        const animationsToLoad = new Set<AnimationType>()
        
        entityTypes.forEach(entityType => {
            const animations = animationRegistry.getAnimationsForEntityType(entityType)
            animations.forEach(anim => animationsToLoad.add(anim))
        })

        animationRegistry.registerAnimationsForScene(scene, Array.from(animationsToLoad))

        const validation = animationRegistry.validateTextures(scene)
        if (!validation.isValid) {
            console.warn(`Scene ${scene.scene.key}: Missing animation textures:`, validation.missingTextures)
        }

        console.log(`Scene ${scene.scene.key}: Initialized ${animationsToLoad.size} animations`)
    }

    public static setupGameScene(scene: Phaser.Scene, config?: Partial<ServicesConfig>): {
        serviceManager: ServiceManager
        animationRegistry: AnimationRegistry
        resourceManager: ResourceManager
        buildingRegistry: BuildingRegistry
        workerRegistry: WorkerRegistry
    } {
        const serviceManager = this.createServices(scene, config)

        const animationRegistry = AnimationRegistry.getInstance()
        const resourceManager = ResourceManager.getInstance()
        const buildingRegistry = BuildingRegistry.getInstance()
        const workerRegistry = WorkerRegistry.getInstance()

        this.initializeSceneAnimations(scene)

        return {
            serviceManager,
            animationRegistry,
            resourceManager,
            buildingRegistry,
            workerRegistry
        }
    }
}