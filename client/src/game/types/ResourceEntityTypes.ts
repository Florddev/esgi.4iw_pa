export enum ResourceEntityType {
    TREE = 'tree',
    ROCK = 'rock',
    COAL_VEIN = 'coal_vein',
    BERRY_BUSH = 'berry_bush',
    CRYSTAL = 'crystal'
}

export interface ResourceDrop {
    readonly type: string;
    readonly amount: number;
    readonly chance: number;
}

export interface ResourceEntityAnimations {
    readonly idle: string;
    readonly hit: string;
    readonly destroy: string;
}

export interface ResourceEntitySounds {
    readonly hit?: string;
    readonly destroy?: string;
}

export interface ResourceEntityCustomProperty {
    readonly type: 'number' | 'string' | 'boolean';
    readonly default: any;
    readonly min?: number;
    readonly max?: number;
}

export interface ResourceEntityConfig {
    readonly id: string;
    readonly type: ResourceEntityType;
    readonly layerName: string;
    readonly name: string;
    readonly description: string;
    readonly health: number;
    readonly damagePerHit: number;
    readonly respawnTime: number;
    readonly resources: readonly ResourceDrop[];
    readonly animations: ResourceEntityAnimations;
    readonly sounds: ResourceEntitySounds;
    readonly customProperties: Record<string, ResourceEntityCustomProperty>;
    readonly blockingPath: boolean;
    readonly interactionRadius: number;
    readonly texture: string;
    readonly scale: number;
}

export interface ResourceEntitySpawnData {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly properties: Record<string, any>;
}