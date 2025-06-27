import { WorkerType, WorkerActionType, type WorkerConfig } from '../types/WorkerConfigTypes';
import { ResourceType } from '../types/ResourceSystemTypes';
import { BuildingType } from '../types/BuildingTypes';
import { ResourceEntityType } from '../types/ResourceEntityTypes';

export const WORKER_CONFIGS: Record<WorkerType, WorkerConfig> = {
    [WorkerType.LUMBERJACK]: {
        id: WorkerType.LUMBERJACK,
        name: 'Bûcheron',
        description: 'Coupe les arbres et récolte le bois',
        texture: 'player-idle',

        carryCapacity: 10,
        harvestSpeed: 3000,
        moveSpeed: 30,
        workRadius: 500,

        harvestTargets: [{
            actionType: WorkerActionType.HARVEST_RESOURCE_ENTITY,
            targetTypes: [ResourceEntityType.TREE],
            resourceTypes: [ResourceType.WOOD],
            priority: 1
        }],

        depositTargets: [{
            actionType: WorkerActionType.DEPOSIT_TO_BUILDING,
            targetTypes: [BuildingType.SAWMILL],
            resourceTypes: [ResourceType.WOOD],
            priority: 1
        }, {
            actionType: WorkerActionType.DEPOSIT_TO_BUILDING,
            targetTypes: [BuildingType.HOUSE],
            resourceTypes: [ResourceType.WOOD],
            priority: 2
        }],

        animations: {
            idle: 'player-idle',
            walking: 'player-walk',
            working: 'player-chop',
            carrying: 'player-carry'
        },

        tint: 0xdd9955,
        scale: 1.0
    },

    [WorkerType.MINER]: {
        id: WorkerType.MINER,
        name: 'Mineur',
        description: 'Extrait la pierre et les minerais',
        texture: 'player-idle',

        carryCapacity: 8,
        harvestSpeed: 4000,
        moveSpeed: 65,
        workRadius: 400,

        harvestTargets: [{
            actionType: WorkerActionType.HARVEST_RESOURCE_ENTITY,
            targetTypes: [ResourceEntityType.ROCK],
            resourceTypes: [ResourceType.STONE, ResourceType.METAL_ORE],
            priority: 1
        }],

        depositTargets: [{
            actionType: WorkerActionType.DEPOSIT_TO_BUILDING,
            targetTypes: [BuildingType.MINE],
            resourceTypes: [ResourceType.STONE, ResourceType.METAL_ORE],
            priority: 1
        }],

        animations: {
            idle: 'player-idle',
            walking: 'player-walk',
            working: 'player-mine',
            carrying: 'player-carry'
        },

        tint: 0x8b7355,
        scale: 1.0
    },

    [WorkerType.FARMER]: {
        id: WorkerType.FARMER,
        name: 'Fermier',
        description: 'Cultive et récolte la nourriture',
        texture: 'player-idle',

        carryCapacity: 12,
        harvestSpeed: 2500,
        moveSpeed: 75,
        workRadius: 450,

        harvestTargets: [{
            actionType: WorkerActionType.HARVEST_RESOURCE_ENTITY,
            targetTypes: [ResourceEntityType.BERRY_BUSH],
            resourceTypes: [ResourceType.FOOD],
            priority: 1
        }],

        depositTargets: [{
            actionType: WorkerActionType.DEPOSIT_TO_BUILDING,
            targetTypes: [BuildingType.FARM],
            resourceTypes: [ResourceType.FOOD],
            priority: 1
        }, {
            actionType: WorkerActionType.DEPOSIT_TO_BUILDING,
            targetTypes: [BuildingType.HOUSE],
            resourceTypes: [ResourceType.FOOD],
            priority: 2
        }],

        animations: {
            idle: 'player-idle',
            walking: 'player-walk',
            working: 'player-harvest',
            carrying: 'player-carry'
        },

        tint: 0x228b22,
        scale: 1.0
    },

    [WorkerType.TRANSPORTER]: {
        id: WorkerType.TRANSPORTER,
        name: 'Transporteur',
        description: 'Transporte les ressources entre bâtiments',
        texture: 'player-idle',

        carryCapacity: 15,
        harvestSpeed: 1000,
        moveSpeed: 80,
        workRadius: 800,

        harvestTargets: [{
            actionType: WorkerActionType.HARVEST_BUILDING,
            targetTypes: [BuildingType.SAWMILL, BuildingType.MINE, BuildingType.FARM],
            resourceTypes: Object.values(ResourceType),
            priority: 1
        }],

        depositTargets: [{
            actionType: WorkerActionType.DEPOSIT_TO_BUILDING,
            targetTypes: [BuildingType.HOUSE],
            resourceTypes: Object.values(ResourceType),
            priority: 1
        }],

        animations: {
            idle: 'player-idle',
            walking: 'player-walk',
            working: 'player-load',
            carrying: 'player-carry'
        },

        tint: 0x3498db,
        scale: 1.0
    }
};