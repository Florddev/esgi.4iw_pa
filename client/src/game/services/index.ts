// Export tous les services
export { ResourceManager } from './ResourceManager';
export { PlayerInventory } from './PlayerInventory';
export { BuildingManager } from './BuildingManager';
export { WorkerManager } from './WorkerManager';
export { 
    DialogService, 
    type DialogConfig, 
    DialogPriority, 
    type DialogStyle 
} from './DialogService';

// Types pour les événements de services
export interface ServiceEvent<T = any> {
    readonly type: string;
    readonly data: T;
    readonly timestamp: number;
    readonly source: string;
}

export type ServiceEventCallback<T = any> = (event: ServiceEvent<T>) => void;

// Interface générale pour les services avec événements
export interface EventEmittingService {
    on(event: string, callback: ServiceEventCallback): void;
    off(event: string, callback: ServiceEventCallback): void;
    emit(event: string, data?: any): void;
}

// Interface pour les services avec sauvegarde
export interface PersistentService {
    saveState(): void;
    loadState(): void;
    clearState(): void;
}

// Gestionnaire de services centralisé
export class ServiceManager {
    private static instance: ServiceManager;
    private readonly services = new Map<string, any>();
    private readonly eventBus = new Map<string, Set<ServiceEventCallback>>();

    private constructor() {}

    public static getInstance(): ServiceManager {
        if (!ServiceManager.instance) {
            ServiceManager.instance = new ServiceManager();
        }
        return ServiceManager.instance;
    }

    public registerService<T>(name: string, service: T): void {
        this.services.set(name, service);
    }

    public getService<T>(name: string): T | undefined {
        return this.services.get(name);
    }

    public hasService(name: string): boolean {
        return this.services.has(name);
    }

    public removeService(name: string): boolean {
        return this.services.delete(name);
    }

    // Event bus global pour communication inter-services
    public on(event: string, callback: ServiceEventCallback): void {
        if (!this.eventBus.has(event)) {
            this.eventBus.set(event, new Set());
        }
        this.eventBus.get(event)!.add(callback);
    }

    public off(event: string, callback: ServiceEventCallback): void {
        const callbacks = this.eventBus.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    public emit(event: string, data?: any, source?: string): void {
        const serviceEvent: ServiceEvent = {
            type: event,
            data,
            timestamp: Date.now(),
            source: source || 'unknown'
        };

        const callbacks = this.eventBus.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(serviceEvent);
                } catch (error) {
                    console.error(`Erreur dans le callback pour l'événement ${event}:`, error);
                }
            });
        }
    }

    // Méthodes utilitaires pour la gestion globale
    public saveAllStates(): void {
        this.services.forEach((service, name) => {
            if (this.isPersistentService(service)) {
                try {
                    service.saveState();
                } catch (error) {
                    console.error(`Erreur lors de la sauvegarde du service ${name}:`, error);
                }
            }
        });
    }

    public loadAllStates(): void {
        this.services.forEach((service, name) => {
            if (this.isPersistentService(service)) {
                try {
                    service.loadState();
                } catch (error) {
                    console.error(`Erreur lors du chargement du service ${name}:`, error);
                }
            }
        });
    }

    public clearAllStates(): void {
        this.services.forEach((service, name) => {
            if (this.isPersistentService(service)) {
                try {
                    service.clearState();
                } catch (error) {
                    console.error(`Erreur lors du nettoyage du service ${name}:`, error);
                }
            }
        });
    }

    private isPersistentService(service: any): service is PersistentService {
        return service && 
               typeof service.saveState === 'function' &&
               typeof service.loadState === 'function' &&
               typeof service.clearState === 'function';
    }

    public getServiceStats(): Record<string, any> {
        const stats: Record<string, any> = {};
        
        this.services.forEach((service, name) => {
            stats[name] = {
                type: service.constructor.name,
                hasEventSupport: typeof service.on === 'function',
                hasPersistence: this.isPersistentService(service)
            };
        });

        return stats;
    }

    // Nettoyage
    public destroy(): void {
        this.services.forEach((service, name) => {
            if (typeof service.destroy === 'function') {
                try {
                    service.destroy();
                } catch (error) {
                    console.error(`Erreur lors de la destruction du service ${name}:`, error);
                }
            }
        });

        this.services.clear();
        this.eventBus.clear();
    }
}

// Configuration par défaut des services
export interface ServicesConfig {
    readonly enableResourceManager: boolean;
    readonly enablePlayerInventory: boolean;
    readonly enableBuildingManager: boolean;
    readonly enableWorkerManager: boolean;
    readonly enableDialogService: boolean;
    readonly autoSave: boolean;
    readonly autoSaveInterval: number;
}

export const DEFAULT_SERVICES_CONFIG: ServicesConfig = {
    enableResourceManager: true,
    enablePlayerInventory: true,
    enableBuildingManager: true,
    enableWorkerManager: true,
    enableDialogService: true,
    autoSave: true,
    autoSaveInterval: 30000 // 30 secondes
};

// Factory pour initialiser tous les services
export class ServicesFactory {
    public static createServices(scene: Phaser.Scene, config: Partial<ServicesConfig> = {}): ServiceManager {
        const finalConfig = { ...DEFAULT_SERVICES_CONFIG, ...config };
        const serviceManager = ServiceManager.getInstance();

        if (finalConfig.enableResourceManager) {
            const resourceManager = ResourceManager.getInstance();
            serviceManager.registerService('resourceManager', resourceManager);
        }

        if (finalConfig.enablePlayerInventory) {
            const playerInventory = new PlayerInventory();
            serviceManager.registerService('playerInventory', playerInventory);
        }

        if (finalConfig.enableBuildingManager) {
            const buildingManager = new BuildingManager(scene);
            serviceManager.registerService('buildingManager', buildingManager);
        }

        if (finalConfig.enableWorkerManager) {
            const workerManager = new WorkerManager(scene);
            serviceManager.registerService('workerManager', workerManager);
        }

        if (finalConfig.enableDialogService) {
            const dialogService = new DialogService(scene);
            serviceManager.registerService('dialogService', dialogService);
        }

        // Configurer l'auto-sauvegarde si activée
        if (finalConfig.autoSave) {
            scene.time.addEvent({
                delay: finalConfig.autoSaveInterval,
                callback: () => serviceManager.saveAllStates(),
                loop: true
            });
        }

        return serviceManager;
    }
}