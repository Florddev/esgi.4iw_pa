import { type ResourceEntityConfig, ResourceEntityType } from '../types';
import { RESOURCE_ENTITY_CONFIGS } from '../configs/ResourceEntityConfigs';

export class ResourceEntityRegistry {
    private static instance: ResourceEntityRegistry;
    private readonly configs = new Map<string, ResourceEntityConfig>();
    private readonly configsByLayer = new Map<string, ResourceEntityConfig>();

    private constructor() {
        this.initializeConfigs();
    }

    public static getInstance(): ResourceEntityRegistry {
        if (!ResourceEntityRegistry.instance) {
            ResourceEntityRegistry.instance = new ResourceEntityRegistry();
        }
        return ResourceEntityRegistry.instance;
    }

    private initializeConfigs(): void {
        Object.values(RESOURCE_ENTITY_CONFIGS).forEach(config => {
            this.configs.set(config.id, config);
            this.configsByLayer.set(config.layerName, config);
        });
    }

    public getConfig(id: string): ResourceEntityConfig | undefined {
        return this.configs.get(id);
    }

    public getConfigByLayer(layerName: string): ResourceEntityConfig | undefined {
        return this.configsByLayer.get(layerName);
    }

    public getAllConfigs(): readonly ResourceEntityConfig[] {
        return Array.from(this.configs.values());
    }

    public getAvailableTypes(): readonly ResourceEntityType[] {
        return Array.from(this.configs.values()).map(config => config.type);
    }

    public isValidType(type: string): type is ResourceEntityType {
        return this.configs.has(type);
    }

    public getLayerNames(): readonly string[] {
        return Array.from(this.configsByLayer.keys());
    }
}