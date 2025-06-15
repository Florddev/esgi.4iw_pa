import { ResourceEntityConfig, ResourceEntityType } from '../types/ResourceEntityTypes';

export const RESOURCE_ENTITY_CONFIGS: Record<string, ResourceEntityConfig> = {
    tree: {
        id: 'tree',
        type: ResourceEntityType.TREE,
        layerName: 'Trees',
        name: 'Arbre',
        description: 'Source de bois, peut être coupé par les bûcherons',
        health: 100,
        damagePerHit: 25,
        respawnTime: 60000,
        resources: [
            { type: 'wood', amount: 3, chance: 1.0 }
        ],
        animations: {
            idle: 'tree-idle',
            hit: 'tree-hit',
            destroy: 'tree-destroy'
        },
        sounds: {
            hit: 'tree-hit-sound',
            destroy: 'tree-destroy-sound'
        },
        customProperties: {
            respawnTime: { type: 'number', default: 60000, min: 10000, max: 300000 },
            woodValue: { type: 'number', default: 3, min: 1, max: 10 },
            scale: { type: 'number', default: 1.0, min: 0.5, max: 2.0 }
        },
        blockingPath: true,
        interactionRadius: 32,
        texture: 'tree',
        scale: 1.0
    }

};