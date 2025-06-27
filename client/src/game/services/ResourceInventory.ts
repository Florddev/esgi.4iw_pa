import { ResourceType, type ResourceStack, type ResourceTransaction, createResourceStack } from '../types/ResourceSystemTypes';
import { ResourceRegistry } from './ResourceRegistry';

interface InventoryChangeEvent {
    readonly type: ResourceType;
    readonly previousAmount: number;
    readonly newAmount: number;
    readonly change: number;
}

type InventoryEventCallback = (event: InventoryChangeEvent) => void;

export class ResourceInventory {
    private readonly resources = new Map<ResourceType, number>();
    private readonly registry: ResourceRegistry;
    private readonly transactionHistory: ResourceTransaction[] = [];
    private readonly eventCallbacks = new Map<string, Set<InventoryEventCallback>>();
    private transactionIdCounter = 0;

    constructor() {
        this.registry = ResourceRegistry.getInstance();
    }

    // Core operations
    public addResource(type: ResourceType, amount: number, source?: string): number {
        if (amount <= 0) return 0;

        const currentAmount = this.resources.get(type) || 0;
        const maxStack = this.registry.getStackSize(type);
        const canAdd = Math.min(amount, maxStack - currentAmount);

        if (canAdd > 0) {
            const newAmount = currentAmount + canAdd;
            this.resources.set(type, newAmount);

            this.recordTransaction('add', type, canAdd, source);
            this.emitChange(type, currentAmount, newAmount, canAdd);
        }

        return canAdd;
    }

    public removeResource(type: ResourceType, amount: number, target?: string): number {
        if (amount <= 0) return 0;

        const currentAmount = this.resources.get(type) || 0;
        const canRemove = Math.min(amount, currentAmount);

        if (canRemove > 0) {
            const newAmount = currentAmount - canRemove;
            this.resources.set(type, newAmount);

            this.recordTransaction('remove', type, canRemove, undefined, target);
            this.emitChange(type, currentAmount, newAmount, -canRemove);
        }

        return canRemove;
    }

    public transferResource(type: ResourceType, amount: number, targetInventory: ResourceInventory, source?: string): number {
        const removed = this.removeResource(type, amount, 'transfer');
        if (removed > 0) {
            const added = targetInventory.addResource(type, removed, source || 'transfer');

            // If couldn't add all, return the difference
            if (added < removed) {
                this.addResource(type, removed - added, 'refund');
            }

            return added;
        }
        return 0;
    }

    // Query operations
    public getResource(type: ResourceType): number {
        return this.resources.get(type) || 0;
    }

    public hasResource(type: ResourceType, amount: number): boolean {
        return this.getResource(type) >= amount;
    }

    public canAfford(cost: Partial<Record<ResourceType, number>>): boolean {
        return Object.entries(cost).every(([type, amount]) =>
            this.hasResource(type as ResourceType, amount || 0)
        );
    }

    public deductCost(cost: Partial<Record<ResourceType, number>>, source?: string): boolean {
        if (!this.canAfford(cost)) return false;

        Object.entries(cost).forEach(([type, amount]) => {
            if (amount && amount > 0) {
                this.removeResource(type as ResourceType, amount, source);
            }
        });

        return true;
    }

    public getAllResources(): ReadonlyMap<ResourceType, number> {
        return new Map(this.resources);
    }

    public getNonZeroResources(): readonly ResourceStack[] {
        return Array.from(this.resources.entries())
            .filter(([_, amount]) => amount > 0)
            .map(([type, amount]) => createResourceStack(type, amount));
    }

    public getTotalItems(): number {
        return Array.from(this.resources.values()).reduce((sum, amount) => sum + amount, 0);
    }

    public getTotalValue(): number {
        return this.registry.calculateValue(this.resources);
    }

    public getInventoryUtilization(): number {
        let usedSlots = 0;
        let totalSlots = 0;

        this.registry.getAllDefinitions().forEach(definition => {
            const current = this.getResource(definition.id);
            const max = definition.stackSize;

            if (current > 0) {
                usedSlots += Math.ceil(current / max);
            }
            totalSlots += 1; // Each resource type = 1 slot
        });

        return totalSlots > 0 ? usedSlots / totalSlots : 0;
    }

    // Event system
    public on(event: 'change', callback: InventoryEventCallback): void {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, new Set());
        }
        this.eventCallbacks.get(event)!.add(callback);
    }

    public off(event: 'change', callback: InventoryEventCallback): void {
        const callbacks = this.eventCallbacks.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    private emitChange(type: ResourceType, previousAmount: number, newAmount: number, change: number): void {
        const event: InventoryChangeEvent = {
            type,
            previousAmount,
            newAmount,
            change
        };

        const callbacks = this.eventCallbacks.get('change');
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(event);
                } catch (error) {
                    console.error('ResourceInventory: Error in change callback:', error);
                }
            });
        }
    }

    // Transaction history
    private recordTransaction(
        type: 'add' | 'remove' | 'transfer',
        resource: ResourceType,
        amount: number,
        source?: string,
        target?: string
    ): void {
        const transaction: ResourceTransaction = {
            id: `txn_${++this.transactionIdCounter}_${Date.now()}`,
            type,
            resource,
            amount,
            source,
            target,
            timestamp: Date.now(),
            success: true
        };

        this.transactionHistory.push(transaction);

        // Keep only last 100 transactions
        if (this.transactionHistory.length > 100) {
            this.transactionHistory.shift();
        }
    }

    public getTransactionHistory(): readonly ResourceTransaction[] {
        return [...this.transactionHistory];
    }

    public clearTransactionHistory(): void {
        this.transactionHistory.length = 0;
    }

    // Utility operations
    public clear(): void {
        const oldResources = new Map(this.resources);
        this.resources.clear();

        // Emit change events for cleared resources
        oldResources.forEach((amount, type) => {
            if (amount > 0) {
                this.emitChange(type, amount, 0, -amount);
            }
        });
    }

    public clone(): ResourceInventory {
        const clone = new ResourceInventory();
        this.resources.forEach((amount, type) => {
            clone.resources.set(type, amount);
        });
        return clone;
    }

    public equals(other: ResourceInventory): boolean {
        if (this.resources.size !== other.resources.size) return false;

        for (const [type, amount] of this.resources) {
            if (other.getResource(type) !== amount) return false;
        }

        return true;
    }

    // Serialization
    public serialize(): Record<string, number> {
        const serialized: Record<string, number> = {};
        this.resources.forEach((amount, type) => {
            if (amount > 0) {
                serialized[type] = amount;
            }
        });
        return serialized;
    }

    public deserialize(data: Record<string, number>): void {
        this.clear();
        Object.entries(data).forEach(([type, amount]) => {
            if (this.registry.isValidType(type) && amount > 0) {
                this.resources.set(type as ResourceType, amount);
            }
        });
    }
}