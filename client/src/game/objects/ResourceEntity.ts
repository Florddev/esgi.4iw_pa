import { Scene } from 'phaser';
type Scene = typeof Scene;

import { AnimationType } from '../services/AnimationRegistry';
import { AnimationUtils } from '../utils/AnimationUtils';
import { type ResourceEntityConfig, type ResourceEntitySpawnData } from '../types/ResourceEntityTypes';
import { ResourceType } from '../types/ResourceSystemTypes';
import { ResourceManager } from '../services/ResourceManager';

interface ResourceEntityState {
    isDestroyed: boolean;
    isBeingHarvested: boolean;
    currentHealth: number;
    currentHarvester: any;
    isBlocking: boolean;
}

export class ResourceEntity extends Phaser.Physics.Arcade.Sprite {
    private readonly config: ResourceEntityConfig;
    private readonly spawnData: ResourceEntitySpawnData;
    private readonly state: ResourceEntityState;
    private readonly animationHandler: ReturnType<typeof AnimationUtils.createAnimationHandler>;
    private readonly resourceManager: ResourceManager;

    private detectionZone?: Phaser.GameObjects.Zone;
    private stump?: Phaser.GameObjects.Sprite;
    private healthBar?: Phaser.GameObjects.Sprite;

    private healingTimer?: Phaser.Time.TimerEvent;

    constructor(scene: Scene, x: number, y: number, config: ResourceEntityConfig, spawnData: ResourceEntitySpawnData) {
        super(scene, x, y, config.texture);

        this.config = config;
        this.spawnData = spawnData;

        this.resourceManager = ResourceManager.getInstance();

        this.state = {
            isDestroyed: false,
            isBeingHarvested: false,
            currentHealth: config.health,
            currentHarvester: null,
            isBlocking: config.blockingPath
        };

        this.initializeEntity();
        this.setupAnimations();
        this.applyCustomProperties();
    }

    public static create(
        scene: Scene,
        x: number,
        y: number,
        config: ResourceEntityConfig,
        spawnData: ResourceEntitySpawnData
    ): ResourceEntity | null {
        try {
            const entity = new ResourceEntity(scene, x, y, config, spawnData);

            if (!entity.validateResources()) {
                entity.destroy();
                return null;
            }

            return entity;
        } catch (error) {
            return null;
        }
    }

    private initializeEntity(): void {
        this.setInteractive();
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this, true);

        this.createDetectionZone();
        this.createStump();
        this.createHealthBar();
        this.setupCursorEvents();

        this.setDepth(10);
        this.setScale(this.config.scale);
    }

    private setupAnimations(): void {
        AnimationUtils.initializeEntityAnimations(this, 'tree');
        this.animationHandler = AnimationUtils.createAnimationHandler(this);
        this.animationHandler.idle(this.config.animations.idle as AnimationType);
    }

    private applyCustomProperties(): void {
        if (!this.spawnData.properties) return;

        Object.entries(this.spawnData.properties).forEach(([key, value]) => {
            const propertyConfig = this.config.customProperties[key];
            if (!propertyConfig) return;

            switch (key) {
                case 'respawnTime':
                    if (typeof value === 'number') {
                        (this.config as any).respawnTime = Math.max(
                            propertyConfig.min || 0,
                            Math.min(propertyConfig.max || Number.MAX_SAFE_INTEGER, value)
                        );
                    }
                    break;
                case 'woodValue':
                    if (typeof value === 'number') {
                        (this.config as any).resources[0].amount = Math.max(
                            propertyConfig.min || 1,
                            Math.min(propertyConfig.max || 100, value)
                        );
                    }
                    break;
                case 'scale':
                    if (typeof value === 'number') {
                        this.setScale(Math.max(
                            propertyConfig.min || 0.1,
                            Math.min(propertyConfig.max || 5.0, value)
                        ));
                    }
                    break;
            }
        });
    }

    private createDetectionZone(): void {
        this.detectionZone = this.scene.add.zone(this.x, this.y, this.config.interactionRadius, this.config.interactionRadius);
        this.scene.physics.add.existing(this.detectionZone, true);
    }

    private createStump(): void {
        this.stump = this.scene.add.sprite(this.x, this.y, this.config.texture, 5).setVisible(false);
    }

    private createHealthBar(): void {
        this.healthBar = this.scene.add.sprite(this.x, this.y - 20, 'health-bar')
            .setVisible(false)
            .setDepth(1000);
    }

    private setupCursorEvents(): void {
        this.on('pointerover', this.handlePointerOver.bind(this));
        this.on('pointerout', this.handlePointerOut.bind(this));
        this.on('pointerdown', this.handlePointerDown.bind(this));
    }

    private handlePointerOver(): void {
        if (!this.state.isDestroyed && (this.scene as any).uiScene) {
            (this.scene as any).uiScene.defaultCursor.setVisible(false);
            (this.scene as any).uiScene.hoverCursor.setVisible(true);
        }
    }

    private handlePointerOut(): void {
        if ((this.scene as any).uiScene) {
            (this.scene as any).uiScene.defaultCursor.setVisible(true);
            (this.scene as any).uiScene.hoverCursor.setVisible(false);
        }
    }

    private handlePointerDown(): void {
        if (!this.state.isDestroyed && !this.state.isBeingHarvested) {
            const player = (this.scene as any).player;
            if (player) {
                this.startPlayerHarvesting(player);
            }
        }
    }

    public setupPlayerCollision(player: any): void {
        if (this.detectionZone) {
            this.scene.physics.add.overlap(
                player,
                this.detectionZone,
                this.handlePlayerOverlap.bind(this),
                undefined,
                this
            );
        }
    }

    private handlePlayerOverlap(): void {
        if (!this.state.isDestroyed && !this.state.isBeingHarvested) {
            this.updateCursorBasedOnFacing();
        }
    }

    private updateCursorBasedOnFacing(): void {
        const player = (this.scene as any).player;
        if (!player || !(this.scene as any).uiScene) return;

        const isFacingEntity = player.isFacingObject(this.x, this.y);
        const mousePointer = this.scene.input.mousePointer;
        const worldPoint = this.scene.cameras.main.getWorldPoint(mousePointer.x, mousePointer.y);
        const bounds = this.getBounds();

        if (isFacingEntity && bounds.contains(worldPoint.x, worldPoint.y)) {
            (this.scene as any).uiScene.defaultCursor.setVisible(false);
            (this.scene as any).uiScene.hoverCursor.setVisible(true);
        } else {
            (this.scene as any).uiScene.defaultCursor.setVisible(true);
            (this.scene as any).uiScene.hoverCursor.setVisible(false);
        }
    }

    public startPlayerHarvesting(player: any): void {
        if (this.state.isBeingHarvested || this.state.isDestroyed) return;

        const interactionPoint = this.findNearestInteractionPoint(player.x, player.y);
        const mainScene = this.scene as any;

        const playerTilePos = this.worldToTile(player.x, player.y);
        const targetTilePos = this.worldToTile(interactionPoint.x, interactionPoint.y);

        mainScene.easyStar.findPath(
            playerTilePos.x, playerTilePos.y,
            targetTilePos.x, targetTilePos.y,
            (path: { x: number; y: number }[] | null) => {
                if (!path) {
                }

                player.setPath(path);
                this.waitForPlayerArrival(player, interactionPoint);
            }
        );

        mainScene.easyStar.calculate();
    }

    private waitForPlayerArrival(player: any, interactionPoint: { x: number; y: number }): void {
        const mainScene = this.scene as any;
        let stableCount = 0;
        let lastPosition = { x: player.x, y: player.y };

        const checkInterval = mainScene.time.addEvent({
            delay: 100,
            callback: () => {
                const distance = Phaser.Math.Distance.Between(
                    player.x, player.y,
                    interactionPoint.x, interactionPoint.y
                );

                const hasNotMoved = lastPosition.x === player.x && lastPosition.y === player.y;
                lastPosition = { x: player.x, y: player.y };

                if (distance < 20 && hasNotMoved) {
                    stableCount++;
                    if (stableCount >= 1) {
                        checkInterval.destroy();
                        if (!this.state.isDestroyed) {
                            player.setFlipX(this.x <= player.x);
                            this.startAutoHarvesting().catch(console.error);
                        }
                    }
                } else {
                    stableCount = 0;
                }
            },
            loop: true
        });
    }

    private async startAutoHarvesting(isWorker: boolean = false): Promise<void> {
        if (!isWorker && this.state.isBeingHarvested) return;

        this.state.isBeingHarvested = true;
        this.setDepth(0);

        let isSequenceCancelled = false;

        while (this.state.currentHealth > 0 && !this.state.isDestroyed && !isSequenceCancelled) {
            if (!isWorker && this.isPlayerMoving()) {
                this.stopHarvesting();
                isSequenceCancelled = true;
                break;
            }

            this.state.currentHealth -= this.config.damagePerHit;
            await this.performHit(isWorker);

            if (this.state.currentHealth <= 0) break;
        }

        if (!isSequenceCancelled && this.state.currentHealth <= 0) {
            this.destroyEntity(isWorker);
        }

        this.state.isBeingHarvested = false;
    }

    private isPlayerMoving(): boolean {
        const player = (this.scene as any).player;
        return !!(player && (
            player.cursors.left.isDown ||
            player.cursors.right.isDown ||
            player.cursors.up.isDown ||
            player.cursors.down.isDown
        ));
    }

    private async performHit(isWorker: boolean = false): Promise<void> {
        if (!isWorker) {
            const player = (this.scene as any).player;
            if (player) {
                player.playChopAnimation(() => {
                    this.updateHealthBar(true);
                    this.spawnParticles();
                });
            }
        } else {
            this.updateHealthBar(true);
            this.spawnParticles();
            if (this.state.currentHarvester) {
                this.scene.events.emit('worker_harvesting', this.state.currentHarvester);
            }
        }

        await this.animationHandler.action(this.config.animations.hit as AnimationType);

        if (!isWorker) {
            const player = (this.scene as any).player;
            if (player) {
                await this.waitForPlayerAnimation(player);
            }
        } else {
            await this.delay(500);
        }
    }

    private destroyEntity(isWorker: boolean): void {
        this.animationHandler.action(this.config.animations.destroy as AnimationType);

        if (!isWorker) {
            this.dropResourcesForPlayer();
        }

        this.state.isDestroyed = true;
        this.state.isBlocking = false;
        this.cleanup();
    }

    private dropResourcesForPlayer(): void {
        this.config.resources.forEach(resource => {
            if (Math.random() <= resource.chance) {
                try {
                    // ÉTAPE 1: Ajouter au ResourceManager
                    const added = this.resourceManager.addResource(
                        resource.type as ResourceType,
                        resource.amount,
                        'resource_entity_harvest'
                    );

                    if (added > 0) {
                        window.dispatchEvent(new CustomEvent('game:resourceHarvested', {
                            detail: {
                                type: resource.type,
                                amount: added,
                                source: 'resource_entity_harvest',
                                entityType: this.config.type,
                                timestamp: Date.now()
                            }
                        }));
                    }
                } catch (error) {
                    console.error(`ResourceEntity: Error adding resource ${resource.type}:`, error);
                }
            }
        });
    }

    private stopHarvesting(): void {
        this.state.isBeingHarvested = false;
        const player = (this.scene as any).player;
        if (player) {
            player.stopChopAnimation();
            this.animationHandler.idle(this.config.animations.idle as AnimationType);
        }
        this.startHealingTimer();
    }

    private updateHealthBar(forceShow: boolean = false): void {
        if (!this.healthBar) return;

        const healthPercent = this.state.currentHealth / this.config.health;
        const frame = Math.floor(healthPercent * 6);

        this.healthBar.setFrame(frame);
        this.healthBar.setPosition(this.x, this.y - 20);
        this.healthBar.setVisible(forceShow || this.state.currentHealth < this.config.health);
    }

    private spawnParticles(): void {
        const particle = this.scene.add.sprite(this.x, this.y, 'leaves-hit')
            .setDepth(this.depth + 1);

        AnimationUtils.playAnimation(particle, AnimationType.LEAVES_FALL);

        this.scene.tweens.add({
            targets: particle,
            y: particle.y - 5,
            duration: 1000,
            ease: 'Power1',
            onComplete: () => particle.destroy()
        });
    }

    private startHealingTimer(): void {
        this.healingTimer?.destroy();
        this.healingTimer = this.scene.time.delayedCall(10000, () => {
            this.state.currentHealth = this.config.health;
            this.updateHealthBar();
        });
    }

    private cleanup(): void {
        this.setVisible(false);
        this.stump?.setVisible(true);

        if (this.state.currentHarvester) {
            this.releaseHarvester();
        }

        this.healthBar?.setVisible(false);
        this.state.isBlocking = false;

        const mainScene = this.scene as any;
        if (mainScene.rebuildPathfindingGrid) {
            mainScene.rebuildPathfindingGrid();
        }

        this.scene.time.delayedCall(this.config.respawnTime, () => this.respawn(), [], this);
    }

    private respawn(): void {
        this.stump?.setVisible(false);

        this.state.isDestroyed = false;
        this.state.isBeingHarvested = false;
        this.state.isBlocking = this.config.blockingPath;
        this.setVisible(true);
        this.animationHandler.idle(this.config.animations.idle as AnimationType);
        this.setDepth(10);

        this.state.currentHealth = this.config.health;
        this.updateHealthBar();

        const mainScene = this.scene as any;
        if (mainScene.rebuildPathfindingGrid) {
            mainScene.rebuildPathfindingGrid();
        }
    }

    private worldToTile(x: number, y: number): { x: number; y: number } {
        return {
            x: Math.floor(x / 16),
            y: Math.floor(y / 16)
        };
    }

    private async waitForPlayerAnimation(player: any): Promise<void> {
        return new Promise((resolve) => {
            if (player) {
                player.once('animationcomplete', () => resolve());
            } else {
                resolve();
            }
        });
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => {
            this.scene.time.delayedCall(ms, resolve);
        });
    }

    public isAvailableForHarvest(harvester: any): boolean {
        return !this.state.isDestroyed && (
                this.state.currentHarvester === null
                || this.state.currentHarvester === harvester
            );
    }

    public setHarvester(harvester: any): boolean {
        if (this.isAvailableForHarvest(harvester)) {
            this.state.currentHarvester = harvester;
            return true;
        }
        return false;
    }

    public releaseHarvester(): void {
        this.state.currentHarvester = null;
    }

    public findNearestInteractionPoint(workerX: number, workerY: number): { x: number; y: number } {
        const tileSize = 16;
        const entityTileX = Math.floor(this.x / tileSize);
        const entityTileY = Math.floor(this.y / tileSize);

        const positions = [
            { x: (entityTileX - 1) * tileSize, y: entityTileY * tileSize },
            { x: (entityTileX + 1) * tileSize, y: entityTileY * tileSize }
        ];

        return positions.reduce((closest, current) => {
            const currentDist = Phaser.Math.Distance.Between(workerX, workerY, current.x, current.y);
            const closestDist = Phaser.Math.Distance.Between(workerX, workerY, closest.x, closest.y);
            return currentDist < closestDist ? current : closest;
        });
    }

    public async workerHarvest(worker: any): Promise<boolean> {
        if (this.state.isDestroyed) {
            return false;
        }

        this.state.currentHarvester = worker;
        this.state.currentHealth -= this.config.damagePerHit;

        this.updateHealthBar(true);
        this.spawnParticles();

        try {
            await this.animationHandler.action(this.config.animations.hit as AnimationType);
        } catch (error) {
            console.error(`ResourceEntity: Error playing hit animation:`, error);
        }

        if (this.state.currentHealth <= 0) {
            try {
                this.animationHandler.action(this.config.animations.destroy as AnimationType);
            } catch (error) {
                console.error(`ResourceEntity: Error playing destroy animation:`, error);
            }

            this.giveResourcesToWorker(worker);

            this.state.isDestroyed = true;
            this.state.isBlocking = false;

            this.cleanup();
            return true;
        }

        return true;
    }

    private giveResourcesToWorker(worker: any): void {
        if (!worker || typeof worker.addToInventory !== 'function') {
            console.warn('ResourceEntity: Worker does not have addToInventory method');
            return;
        }

        this.config.resources.forEach(resource => {
            if (Math.random() <= resource.chance) {
                try {
                    const added = worker.addToInventory(resource.type, resource.amount);

                    if (added > 0) {
                        window.dispatchEvent(new CustomEvent('game:workerResourceHarvested', {
                            detail: {
                                workerType: worker.constructor.name.toLowerCase(),
                                resourceType: resource.type,
                                amount: added,
                                entityType: this.config.type,
                                timestamp: Date.now()
                            }
                        }));
                    }
                } catch (error) {
                    console.error(`ResourceEntity: Error giving resource to worker:`, error);
                }
            }
        });
    }

    public getResourceNames(): string[] {
        try {
            return this.config.resources.map(resource =>
                this.resourceManager.getName(resource.type as ResourceType)
            );
        } catch (error) {
            console.error('ResourceEntity: Error getting resource names:', error);
            return this.config.resources.map(r => r.type);
        }
    }

    private validateResources(): boolean {
        try {
            const validResources = this.config.resources.filter(resource => {
                const isValidType = Object.values(ResourceType).includes(resource.type as ResourceType);
                if (!isValidType) {
                    console.warn(`ResourceEntity: Invalid resource type: ${resource.type}`);
                }
                return isValidType;
            });

            if (validResources.length !== this.config.resources.length) {
                console.warn(`ResourceEntity: Some resources were invalid and filtered out`);
            }

            return validResources.length > 0;
        } catch (error) {
            console.error('ResourceEntity: Error validating resources:', error);
            return false;
        }
    }

    public getResourceValue(): number {
        try {
            let totalValue = 0;
            this.config.resources.forEach(resource => {
                const baseValue = this.resourceManager.getRegistry().getBaseValue(resource.type as ResourceType);
                totalValue += resource.amount * resource.chance * baseValue;
            });
            return totalValue;
        } catch (error) {
            console.error('ResourceEntity: Error calculating resource value:', error);
            return 0;
        }
    }

    // #region Getter

    public getConfig(): ResourceEntityConfig {
        return this.config;
    }

    public getEntityTilePosition(): { x: number; y: number } {
        return this.worldToTile(this.x, this.y);
    }

    public isBlockingPath(): boolean {
        return this.state.isBlocking;
    }

    public isDestroyed(): boolean {
        return this.state.isDestroyed;
    }

    public getResourceDrops(): readonly { type: string; amount: number; chance: number }[] {
        return this.config.resources;
    }

    // #endregion

    // #region Cleanup

    destroy(fromScene?: boolean): void {
        this.healthBar?.destroy();
        this.detectionZone?.destroy();
        this.stump?.destroy();
        this.healingTimer?.destroy();

        super.destroy(fromScene);
    }

    update(): void {
        if (this.state.isDestroyed || !this.detectionZone) return;

        const player = (this.scene as any).player;
        if (!player) return;

        const isOverlapping = this.scene.physics.overlap(player, this.detectionZone);

        if (isOverlapping) {
            this.updateCursorBasedOnFacing();
        } else if (this.state.isBeingHarvested) {
            this.stopHarvesting();
        }
    }

    // #endregion
}