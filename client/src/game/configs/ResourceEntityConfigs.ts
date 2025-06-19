import { type ResourceEntityConfig, ResourceEntityType } from '../types/ResourceEntityTypes';
import { ResourceType } from '../types/ResourceSystemTypes';

export const RESOURCE_ENTITY_CONFIGS: Record<string, ResourceEntityConfig> = {
    tree: {
        id: 'tree',
        type: ResourceEntityType.TREE,
        layerName: 'Trees',
        name: 'Arbre',
        description: 'Source de bois, peut être coupé par les bûcherons',
        health: 100,
        damagePerHit: 10,
        respawnTime: 60000,
        resources: [
            { type: ResourceType.WOOD, amount: 4, chance: 1.0 }
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
    },
    coal_vein: {
        id: 'coal_vein',
        type: ResourceEntityType.COAL_VEIN,
        layerName: 'CoalVein',
        name: 'Filon de Charbon',
        description: 'Source de charbon, peut être miné par les mineurs',
        health: 100,
        damagePerHit: 25,
        respawnTime: 60000,
        resources: [
            { type: ResourceType.STONE, amount: 2, chance: 1.0 }
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
        texture: 'coal_vein',
        scale: 1.0
    }

};