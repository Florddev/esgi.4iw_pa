import type { ResourceType, ResourceStack } from './ResourceTypes';

export interface PlayerInventoryOperations {
    addResource(type: ResourceType, amount: number): number;
    removeResource(type: ResourceType, amount: number): number;
    getResource(type: ResourceType): number;
    hasResource(type: ResourceType, amount: number): boolean;
    getAllResources(): ReadonlyMap<ResourceType, number>;
    getNonZeroResources(): readonly ResourceStack[];
    getInventoryValue(): number;
    clear(): void;
}

export interface PlayerInventoryState {
    readonly resources: ReadonlyMap<ResourceType, number>;
    readonly totalValue: number;
    readonly totalItems: number;
}

export interface InventoryTransaction {
    readonly type: ResourceType;
    readonly amount: number;
    readonly operation: 'add' | 'remove';
    readonly timestamp: number;
    readonly success: boolean;
}

// Types pour les événements d'inventaire
export interface InventoryChangeEvent {
    readonly type: ResourceType;
    readonly previousAmount: number;
    readonly newAmount: number;
    readonly change: number;
}

export type InventoryEventCallback = (event: InventoryChangeEvent) => void;

// Interface principale que doit implémenter PlayerInventory
export interface PlayerInventory extends PlayerInventoryOperations {
    readonly state: PlayerInventoryState;
    
    // Gestion des événements
    on(event: 'change', callback: InventoryEventCallback): void;
    off(event: 'change', callback: InventoryEventCallback): void;
    
    // Transactions
    getTransactionHistory(): readonly InventoryTransaction[];
    clearTransactionHistory(): void;
}