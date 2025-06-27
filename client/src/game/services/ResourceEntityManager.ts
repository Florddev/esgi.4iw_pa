import { Scene } from 'phaser';
type Scene = typeof Scene;

import { ResourceEntity } from '../objects/ResourceEntity';
import { ResourceEntityRegistry } from './ResourceEntityRegistry';
import { type ResourceEntityConfig, type ResourceEntitySpawnData } from '../types/ResourceEntityTypes';

export class ResourceEntityManager {
    private readonly scene: Scene;
    private readonly registry: ResourceEntityRegistry;
    private readonly entities = new Map<string, ResourceEntity[]>();
    private readonly entitiesByLayer = new Map<string, ResourceEntity[]>();

    constructor(scene: Scene) {
        this.scene = scene;
        this.registry = ResourceEntityRegistry.getInstance();
    }

    public spawnFromMap(map: Phaser.Tilemaps.Tilemap): void {
        const configs = this.registry.getAllConfigs();
        let totalSpawned = 0;

        configs.forEach(config => {
            const spawned = this.spawnEntitiesFromLayer(map, config);
            totalSpawned += spawned;
        });
    }

    private spawnEntitiesFromLayer(map: Phaser.Tilemaps.Tilemap, config: ResourceEntityConfig): number {
        const layer = map.getObjectLayer(config.layerName);

        if (!layer) {
            return 0;
        }

        const entities: ResourceEntity[] = [];
        let spawnedCount = 0;

        layer.objects.forEach(obj => {
            try {
                const spawnData: ResourceEntitySpawnData = {
                    x: obj.x!,
                    y: obj.y!,
                    width: obj.width!,
                    height: obj.height!,
                    properties: this.extractTiledProperties(obj.properties)
                };

                const entity = new ResourceEntity(
                    this.scene,
                    obj.x! + (obj.width! / 2),
                    obj.y! - (obj.height!),
                    config,
                    spawnData
                );

                // Setup player collision
                const player = (this.scene as any).player;
                if (player) {
                    entity.setupPlayerCollision(player);
                }

                entities.push(entity);
                spawnedCount++;

            } catch (error) {
                console.error(`ResourceEntityManager: Error spawning ${config.type}:`, error);
            }
        });

        // Store entities
        this.entities.set(config.type, entities);
        this.entitiesByLayer.set(config.layerName, entities);

        return spawnedCount;
    }

    private extractTiledProperties(tiledProperties?: any[]): Record<string, any> {
        if (!tiledProperties || !Array.isArray(tiledProperties)) {
            return {};
        }

        const properties: Record<string, any> = {};
        tiledProperties.forEach(prop => {
            if (prop.name && prop.value !== undefined) {
                properties[prop.name] = prop.value;
            }
        });

        return properties;
    }

    public setupPlayerCollisions(player: any): void {
        this.entities.forEach(entities => {
            entities.forEach(entity => {
                entity.setupPlayerCollision(player);
            });
        });
    }

    public getEntitiesByType(type: string): readonly ResourceEntity[] {
        return this.entities.get(type) || [];
    }

    public getEntitiesByLayer(layerName: string): readonly ResourceEntity[] {
        return this.entitiesByLayer.get(layerName) || [];
    }

    public getAllEntities(): readonly ResourceEntity[] {
        const allEntities: ResourceEntity[] = [];
        this.entities.forEach(entities => {
            allEntities.push(...entities);
        });
        return allEntities;
    }

    public updateEntities(): void {
        this.entities.forEach(entities => {
            entities.forEach(entity => {
                try {
                    entity.update();
                } catch (error) {
                    console.error('ResourceEntityManager: Error updating entity:', error);
                }
            });
        });

        // Clean up destroyed entities
        this.cleanupDestroyedEntities();
    }

    private cleanupDestroyedEntities(): void {
        this.entities.forEach((entities, type) => {
            const activeEntities = entities.filter(entity => entity.scene && entity.active);
            if (activeEntities.length !== entities.length) {
                this.entities.set(type, activeEntities);
            }
        });

        this.entitiesByLayer.forEach((entities, layerName) => {
            const activeEntities = entities.filter(entity => entity.scene && entity.active);
            if (activeEntities.length !== entities.length) {
                this.entitiesByLayer.set(layerName, activeEntities);
            }
        });
    }

    public findNearestEntityOfType(position: { x: number; y: number }, type: string, maxDistance?: number): ResourceEntity | null {
        const entities = this.getEntitiesByType(type);
        const availableEntities = entities.filter(entity =>
            !entity.isDestroyed() &&
            (!maxDistance || Phaser.Math.Distance.Between(position.x, position.y, entity.x, entity.y) <= maxDistance)
        );

        if (availableEntities.length === 0) return null;

        return availableEntities.reduce((closest, current) => {
            const closestDist = Phaser.Math.Distance.Between(position.x, position.y, closest.x, closest.y);
            const currentDist = Phaser.Math.Distance.Between(position.x, position.y, current.x, current.y);
            return currentDist < closestDist ? current : closest;
        });
    }

    public getEntityCount(type?: string): number {
        if (type) {
            return this.getEntitiesByType(type).length;
        }
        return this.getAllEntities().length;
    }

    public clearAll(): void {
        this.entities.forEach(entities => {
            entities.forEach(entity => {
                try {
                    entity.destroy();
                } catch (error) {
                    console.error('ResourceEntityManager: Error destroying entity:', error);
                }
            });
        });

        this.entities.clear();
        this.entitiesByLayer.clear();
    }

    public destroy(): void {
        this.clearAll();
    }
}