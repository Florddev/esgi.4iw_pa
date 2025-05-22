import { 
    ResourceType, 
    ResourceStack,
    type PlayerInventory as IPlayerInventory,
    type PlayerInventoryState,
    type InventoryChangeEvent,
    type InventoryEventCallback,
    type InventoryTransaction
} from '../types';
import { ResourceManager } from './ResourceManager';

export class PlayerInventory implements IPlayerInventory {
    private readonly resources = new Map<ResourceType, number>();
    private readonly resourceManager: ResourceManager;
    private readonly eventCallbacks = new Map<string, Set<InventoryEventCallback>>();
    private readonly transactionHistory: InventoryTransaction[] = [];
    private readonly maxTransactionHistory = 100;
    
    constructor() {
        this.resourceManager = ResourceManager.getInstance();
        this.initializeInventory();
    }
    
    private initializeInventory(): void {
        // Initialiser toutes les ressources à 0
        this.resourceManager.getAllResources().forEach(resource => {
            this.resources.set(resource.id, 0);
        });
    }
    
    public addResource(type: ResourceType, amount: number): number {
        if (amount <= 0) return 0;
        
        const currentAmount = this.resources.get(type) ?? 0;
        const maxStack = this.resourceManager.getMaxStackSize(type);
        const canAdd = Math.min(amount, maxStack - currentAmount);
        
        if (canAdd > 0) {
            const newAmount = currentAmount + canAdd;
            this.resources.set(type, newAmount);
            
            this.recordTransaction(type, canAdd, 'add', true);
            this.emitChangeEvent(type, currentAmount, newAmount);
        } else {
            this.recordTransaction(type, amount, 'add', false);
        }
        
        return canAdd;
    }
    
    public removeResource(type: ResourceType, amount: number): number {
        if (amount <= 0) return 0;
        
        const currentAmount = this.resources.get(type) ?? 0;
        const canRemove = Math.min(amount, currentAmount);
        
        if (canRemove > 0) {
            const newAmount = currentAmount - canRemove;
            this.resources.set(type, newAmount);
            
            this.recordTransaction(type, canRemove, 'remove', true);
            this.emitChangeEvent(type, currentAmount, newAmount);
        } else {
            this.recordTransaction(type, amount, 'remove', false);
        }
        
        return canRemove;
    }
    
    public getResource(type: ResourceType): number {
        return this.resources.get(type) ?? 0;
    }
    
    public hasResource(type: ResourceType, amount: number): boolean {
        return this.getResource(type) >= amount;
    }
    
    public getAllResources(): ReadonlyMap<ResourceType, number> {
        return new Map(this.resources);
    }
    
    public getNonZeroResources(): readonly ResourceStack[] {
        const result: ResourceStack[] = [];
        this.resources.forEach((amount, type) => {
            if (amount > 0) {
                result.push({ type, amount });
            }
        });
        return result;
    }
    
    public getInventoryValue(): number {
        return this.resourceManager.calculateTotalValue(this.resources);
    }
    
    public clear(): void {
        const previousState = this.getAllResources();
        
        this.resources.forEach((amount, type) => {
            if (amount > 0) {
                this.resources.set(type, 0);
                this.emitChangeEvent(type, amount, 0);
            }
        });
        
        this.recordTransaction(ResourceType.WOOD, 0, 'remove', true); // Transaction symbolique pour clear
    }
    
    public get state(): PlayerInventoryState {
        return {
            resources: this.getAllResources(),
            totalValue: this.getInventoryValue(),
            totalItems: Array.from(this.resources.values()).reduce((sum, amount) => sum + amount, 0)
        };
    }
    
    // Gestion des événements
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
    
    private emitChangeEvent(type: ResourceType, previousAmount: number, newAmount: number): void {
        const event: InventoryChangeEvent = {
            type,
            previousAmount,
            newAmount,
            change: newAmount - previousAmount
        };
        
        const callbacks = this.eventCallbacks.get('change');
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(event);
                } catch (error) {
                    console.error('Error in inventory change callback:', error);
                }
            });
        }
    }
    
    // Gestion des transactions
    private recordTransaction(
        type: ResourceType, 
        amount: number, 
        operation: 'add' | 'remove', 
        success: boolean
    ): void {
        const transaction: InventoryTransaction = {
            type,
            amount,
            operation,
            timestamp: Date.now(),
            success
        };
        
        this.transactionHistory.push(transaction);
        
        // Limiter l'historique
        if (this.transactionHistory.length > this.maxTransactionHistory) {
            this.transactionHistory.shift();
        }
    }
    
    public getTransactionHistory(): readonly InventoryTransaction[] {
        return [...this.transactionHistory];
    }
    
    public clearTransactionHistory(): void {
        this.transactionHistory.length = 0;
    }
    
    // Méthodes utilitaires
    public canAddResource(type: ResourceType, amount: number): boolean {
        const currentAmount = this.getResource(type);
        const maxStack = this.resourceManager.getMaxStackSize(type);
        return currentAmount + amount <= maxStack;
    }
    
    public getRemainingCapacity(type: ResourceType): number {
        const currentAmount = this.getResource(type);
        const maxStack = this.resourceManager.getMaxStackSize(type);
        return Math.max(0, maxStack - currentAmount);
    }
    
    public getSpaceUtilization(): number {
        let totalUsed = 0;
        let totalCapacity = 0;
        
        this.resourceManager.getAllResources().forEach(resource => {
            const currentAmount = this.getResource(resource.id);
            totalUsed += currentAmount;
            totalCapacity += resource.stackSize;
        });
        
        return totalCapacity > 0 ? totalUsed / totalCapacity : 0;
    }
    
    // Méthodes de sérialisation pour la sauvegarde
    public serialize(): Record<string, number> {
        const result: Record<string, number> = {};
        this.resources.forEach((amount, type) => {
            result[type] = amount;
        });
        return result;
    }
    
    public deserialize(data: Record<string, number>): void {
        // Vider l'inventaire actuel
        this.resources.clear();
        this.initializeInventory();
        
        // Charger les nouvelles données
        Object.entries(data).forEach(([type, amount]) => {
            if (this.resourceManager.isValidResourceType(type)) {
                this.resources.set(type as ResourceType, Math.max(0, amount));
            }
        });
    }
}