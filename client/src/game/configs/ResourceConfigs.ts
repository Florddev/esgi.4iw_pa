import { type ResourceDefinition, ResourceType, ResourceCategory } from '../types/ResourceSystemTypes';

export const RESOURCE_DEFINITIONS: Record<ResourceType, ResourceDefinition> = {
    [ResourceType.WOOD]: {
        id: ResourceType.WOOD,
        name: 'Bois',
        description: 'Matériau de base obtenu en coupant des arbres',
        category: ResourceCategory.RAW_MATERIAL,
        iconTexture: 'wood-icon',
        color: 0x8B4513,
        baseValue: 1,
        stackSize: 100,
        isConsumable: false,
        canTrade: true
    },
    [ResourceType.STONE]: {
        id: ResourceType.STONE,
        name: 'Pierre',
        description: 'Matériau solide extrait des mines et carrières',
        category: ResourceCategory.RAW_MATERIAL,
        iconTexture: 'stone-icon',
        color: 0x808080,
        baseValue: 2,
        stackSize: 50,
        isConsumable: false,
        canTrade: true
    },
    [ResourceType.FOOD]: {
        id: ResourceType.FOOD,
        name: 'Nourriture',
        description: 'Nécessaire pour nourrir les ouvriers et maintenir la population',
        category: ResourceCategory.CONSUMABLE,
        iconTexture: 'food-icon',
        color: 0xFFD700,
        baseValue: 3,
        stackSize: 20,
        isConsumable: true,
        canTrade: true
    },
    [ResourceType.COAL_ORE]: {
        id: ResourceType.COAL_ORE,
        name: 'Charbon',
        description: 'Minerai de charbon brut',
        category: ResourceCategory.ORE,
        iconTexture: 'metal-ore-icon',
        color: 0x654321,
        baseValue: 4,
        stackSize: 30,
        isConsumable: false,
        canTrade: true
    },
    [ResourceType.METAL_ORE]: {
        id: ResourceType.METAL_ORE,
        name: 'Minerai',
        description: 'Minerai brut qui peut être fondu en métal',
        category: ResourceCategory.RAW_MATERIAL,
        iconTexture: 'metal-ore-icon',
        color: 0x654321,
        baseValue: 4,
        stackSize: 30,
        isConsumable: false,
        canTrade: true
    },
    [ResourceType.PLANKS]: {
        id: ResourceType.PLANKS,
        name: 'Planches',
        description: 'Bois transformé, plus utile pour la construction',
        category: ResourceCategory.PROCESSED,
        iconTexture: 'planks-icon',
        color: 0xDEB887,
        baseValue: 3,
        stackSize: 50,
        isConsumable: false,
        canTrade: true
    },
    [ResourceType.METAL]: {
        id: ResourceType.METAL,
        name: 'Métal',
        description: 'Matériau précieux pour les constructions avancées',
        category: ResourceCategory.PROCESSED,
        iconTexture: 'metal-icon',
        color: 0xC0C0C0,
        baseValue: 8,
        stackSize: 30,
        isConsumable: false,
        canTrade: true
    },
    [ResourceType.TOOLS]: {
        id: ResourceType.TOOLS,
        name: 'Outils',
        description: 'Améliorent l\'efficacité des ouvriers',
        category: ResourceCategory.TOOL,
        iconTexture: 'tools-icon',
        color: 0x4169E1,
        baseValue: 15,
        stackSize: 10,
        isConsumable: true,
        canTrade: true
    },
    [ResourceType.ENERGY]: {
        id: ResourceType.ENERGY,
        name: 'Énergie',
        description: 'Nécessaire pour faire fonctionner les machines',
        category: ResourceCategory.SPECIAL,
        iconTexture: 'energy-icon',
        color: 0xFFFF00,
        baseValue: 1,
        stackSize: 1000,
        isConsumable: true,
        canTrade: false
    },
    [ResourceType.POPULATION]: {
        id: ResourceType.POPULATION,
        name: 'Population',
        description: 'Nombre d\'habitants dans votre ville',
        category: ResourceCategory.SPECIAL,
        iconTexture: 'population-icon',
        color: 0xFF69B4,
        baseValue: 0,
        stackSize: 1000,
        isConsumable: false,
        canTrade: false
    }
};