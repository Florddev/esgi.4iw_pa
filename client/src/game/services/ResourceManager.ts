import { Scene } from 'phaser';
type Scene = typeof Scene;

import { ResourceType, type ResourceDefinition, type ResourceStack } from '../types/ResourceSystemTypes';
import { ResourceRegistry } from './ResourceRegistry';
import { ResourceInventory } from './ResourceInventory';

interface ResourceDisplayOptions {
    iconSize?: number;
    fontSize?: string;
    showName?: boolean;
    backgroundColor?: number;
    backgroundAlpha?: number;
}

export class ResourceManager {
    private static instance: ResourceManager;
    private readonly registry: ResourceRegistry;
    private readonly globalInventory: ResourceInventory;
    private isInitialized: boolean = false;

    private constructor() {
        try {
            this.registry = ResourceRegistry.getInstance();
            this.globalInventory = new ResourceInventory();
            this.setupGlobalEvents();
            this.isInitialized = true;
            console.log('ResourceManager initialized successfully');
        } catch (error) {
            console.error('Error initializing ResourceManager:', error);
            throw error;
        }
    }

    public static getInstance(): ResourceManager {
        if (!ResourceManager.instance) {
            ResourceManager.instance = new ResourceManager();
        }
        return ResourceManager.instance;
    }

    public isReady(): boolean {
        return this.isInitialized && this.registry !== null;
    }

    private setupGlobalEvents(): void {
        // Listen for inventory changes and emit to game systems
        this.globalInventory.on('change', (event) => {
            try {
                // Emit to Vue.js
                window.dispatchEvent(new CustomEvent('game:resourceUpdate', {
                    detail: {
                        type: event.type,
                        amount: event.newAmount,
                        change: event.change
                    }
                }));

                // Emit to Phaser scenes
                const game = (window as any).gameInstance;
                if (game) {
                    const mainScene = game.scene.getScene('MainScene');
                    if (mainScene) {
                        mainScene.events.emit('resourceChanged', event.type, event.newAmount, event.change);
                    }
                }
            } catch (error) {
                console.error('Error in ResourceManager event handler:', error);
            }
        });
    }

    // Global inventory access with error handling
    public getGlobalInventory(): ResourceInventory {
        if (!this.isInitialized) {
            throw new Error('ResourceManager not initialized');
        }
        return this.globalInventory;
    }

    public addResource(type: ResourceType, amount: number, source?: string): number {
        if (!this.isInitialized) {
            console.error('ResourceManager not initialized');
            return 0;
        }
        return this.globalInventory.addResource(type, amount, source);
    }

    public removeResource(type: ResourceType, amount: number, target?: string): number {
        if (!this.isInitialized) {
            console.error('ResourceManager not initialized');
            return 0;
        }
        return this.globalInventory.removeResource(type, amount, target);
    }

    public getResource(type: ResourceType): number {
        if (!this.isInitialized) {
            console.error('ResourceManager not initialized');
            return 0;
        }
        return this.globalInventory.getResource(type);
    }

    public hasResource(type: ResourceType, amount: number): boolean {
        if (!this.isInitialized) {
            console.error('ResourceManager not initialized');
            return false;
        }
        return this.globalInventory.hasResource(type, amount);
    }

    public canAfford(cost: Partial<Record<ResourceType, number>>): boolean {
        if (!this.isInitialized) {
            console.error('ResourceManager not initialized');
            return false;
        }
        return this.globalInventory.canAfford(cost);
    }

    public deductCost(cost: Partial<Record<ResourceType, number>>, source?: string): boolean {
        if (!this.isInitialized) {
            console.error('ResourceManager not initialized');
            return false;
        }
        return this.globalInventory.deductCost(cost, source);
    }

    // Registry access with error handling
    public getRegistry(): ResourceRegistry {
        if (!this.isInitialized) {
            throw new Error('ResourceManager not initialized');
        }
        return this.registry;
    }

    public getDefinition(type: ResourceType): ResourceDefinition | undefined {
        if (!this.isInitialized) {
            console.error('ResourceManager not initialized');
            return undefined;
        }
        return this.registry.getDefinition(type);
    }

    public getAllDefinitions(): readonly ResourceDefinition[] {
        if (!this.isInitialized) {
            console.error('ResourceManager not initialized');
            return [];
        }
        return this.registry.getAllDefinitions();
    }

    public getName(type: ResourceType): string {
        if (!this.isInitialized) {
            console.error('ResourceManager not initialized');
            return 'Unknown';
        }
        return this.registry.getName(type);
    }

    public getColor(type: ResourceType): number {
        if (!this.isInitialized) {
            console.error('ResourceManager not initialized');
            return 0xFFFFFF;
        }
        return this.registry.getColor(type);
    }

    public getIconTexture(type: ResourceType): string {
        if (!this.isInitialized) {
            console.error('ResourceManager not initialized');
            return 'unknown-icon';
        }
        return this.registry.getIconTexture(type);
    }

    // UI Creation helpers
    public createResourceDisplay(
        scene: Scene,
        x: number,
        y: number,
        type: ResourceType,
        amount: number,
        options: ResourceDisplayOptions = {}
    ): Phaser.GameObjects.Container {
        const {
            iconSize = 24,
            fontSize = '14px',
            showName = false,
            backgroundColor = 0x000000,
            backgroundAlpha = 0.7
        } = options;

        const definition = this.registry.getDefinition(type);
        if (!definition) {
            console.warn(`ResourceManager: Definition for ${type} not found`);
            return scene.add.container(x, y);
        }

        const container = scene.add.container(x, y);
        const bgWidth = showName ? 120 : 60;

        // Background
        const background = scene.add.rectangle(0, 0, bgWidth, 30, backgroundColor, backgroundAlpha)
            .setOrigin(0, 0.5);

        // Icon
        const iconImage = scene.add.image(iconSize/2 + 5, 0, definition.iconTexture)
            .setDisplaySize(iconSize, iconSize)
            .setOrigin(0.5, 0.5);

        // Amount text
        const amountText = scene.add.text(iconSize + 15, 0, amount.toString(), {
            fontSize: fontSize,
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        container.add([background, iconImage, amountText]);

        if (showName) {
            const nameText = scene.add.text(iconSize + 15, 12, definition.name, {
                fontSize: '12px',
                color: '#cccccc'
            }).setOrigin(0, 0.5);
            container.add(nameText);
        }

        return container;
    }

    public createResourceBar(
        scene: Scene,
        x: number,
        y: number,
        type: ResourceType,
        current: number,
        max: number,
        width: number = 150
    ): Phaser.GameObjects.Container {
        const definition = this.registry.getDefinition(type);
        if (!definition) {
            return scene.add.container(x, y);
        }

        const container = scene.add.container(x, y);

        // Icon
        const iconImage = scene.add.image(-width/2 - 20, 0, definition.iconTexture);
        iconImage.setDisplaySize(20, 20);
        iconImage.setOrigin(0.5, 0.5);

        // Background bar
        const barBg = scene.add.rectangle(0, 0, width, 12, 0x333333);

        // Fill bar
        const fillWidth = Math.max(0, (current / max) * width);
        const barFill = scene.add.rectangle(-width/2 + fillWidth/2, 0, fillWidth, 12, definition.color);

        // Amount text
        const quantityText = scene.add.text(0, 0, `${current}/${max}`, {
            fontSize: '10px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        container.add([iconImage, barBg, barFill, quantityText]);

        return container;
    }

    // Asset management
    public prepareSceneLoading(scene: Scene): void {
        this.registry.prepareSceneLoading(scene);
    }

    public areAssetsLoaded(): boolean {
        return this.registry.areAssetsLoaded();
    }

    // Utility methods
    public createInventory(): ResourceInventory {
        return new ResourceInventory();
    }

    public createResourceStack(type: ResourceType, amount: number): ResourceStack {
        return { type, amount: Math.max(0, amount) };
    }

    // Save/Load
    public saveGlobalInventory(): Record<string, number> {
        return this.globalInventory.serialize();
    }

    public loadGlobalInventory(data: Record<string, number>): void {
        this.globalInventory.deserialize(data);
    }

    // Statistics
    public getResourceStatistics(): {
        readonly totalResources: number;
        readonly totalValue: number;
        readonly resourcesByCategory: Record<string, number>;
        readonly utilization: number;
    } {
        const resources = this.globalInventory.getNonZeroResources();
        const resourcesByCategory: Record<string, number> = {};

        resources.forEach(stack => {
            const definition = this.registry.getDefinition(stack.type);
            if (definition) {
                const category = definition.category;
                resourcesByCategory[category] = (resourcesByCategory[category] || 0) + stack.amount;
            }
        });

        return {
            totalResources: this.globalInventory.getTotalItems(),
            totalValue: this.globalInventory.getTotalValue(),
            resourcesByCategory,
            utilization: this.globalInventory.getInventoryUtilization()
        };
    }
}