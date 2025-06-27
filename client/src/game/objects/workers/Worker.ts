import { Scene } from 'phaser';
type Scene = typeof Scene;

import {
    type WorkerConfig,
    WorkerState,
    type WorkerPosition,
    WorkerActionType
} from '../../types/WorkerConfigTypes';
import { ResourceType } from '../../types/ResourceSystemTypes';
import { ResourceEntity } from '../ResourceEntity';
import { TiledBuilding } from '../TiledBuilding';
import { AnimationUtils } from '../../utils/AnimationUtils';
import Sprite = Phaser.GameObjects.Sprite;

export class Worker extends Sprite {
    protected config: WorkerConfig;
    public state: WorkerState = WorkerState.IDLE;
    protected inventory = new Map<ResourceType, number>();
    protected currentTarget: ResourceEntity | TiledBuilding | null = null;
    protected depositPoint: WorkerPosition | null = null;

    protected resourceEntityManager: any;
    protected buildingManager: any;

    protected isMoving: boolean = false;

    protected actionTimer: Phaser.Time.TimerEvent | null = null;
    protected idleTimer: Phaser.Time.TimerEvent | null = null;
    protected mainLoopTimer: Phaser.Time.TimerEvent | null = null;

    protected blacklistedTargets = new Set<string>();
    protected lastBlacklistCleanup: number = 0;

    constructor(scene: Scene, x: number, y: number, config: WorkerConfig, depositPoint?: WorkerPosition) {
        super(scene, x, y, config.texture);

        this.config = config;
        this.depositPoint = depositPoint || null;
        this.resourceEntityManager = (scene as any).resourceEntityManager;
        this.buildingManager = (scene as any).buildingManager;

        this.initializeWorker();
        this.setupAnimations();
        this.startMainLoop();
    }

    private getThisGameObject(): Phaser.GameObjects.GameObject {
        return this as any as Phaser.GameObjects.GameObject;
    }

    private initializeWorker(): void {
        this.scene.add.existing(this.getThisGameObject());
        this.scene.physics.add.existing(this.getThisGameObject());

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setSize(12, 12);
            body.setOffset(2, 4);
        }

        this.setDepth(1);
        if (this.config.tint) this.setTint(this.config.tint);
        if (this.config.scale) this.setScale(this.config.scale);

        this.config.harvestTargets.forEach(target => {
            target.resourceTypes.forEach(resourceType => {
                this.inventory.set(resourceType, 0);
            });
        });
    }

    private setupAnimations(): void {
        try {
            AnimationUtils.initializeEntityAnimations(this as any as Sprite, 'player');
            this.play(this.config.animations.idle);
        } catch (error) {
            console.warn('Worker: Could not setup animations:', error);
        }
    }

    private startMainLoop(): void {
        this.mainLoopTimer = this.scene.time.addEvent({
            delay: 1000,
            callback: this.updateWorker,
            callbackScope: this,
            loop: true
        });

        this.scene.time.delayedCall(100, () => {
            this.updateWorker();
        });
    }

    private updateWorker(): void {
        try {
            this.cleanupBlacklistPeriodically();

            if (this.isMoving) {
                return;
            }

            switch (this.state) {
                case WorkerState.IDLE:
                    this.handleIdleState();
                    break;
                case WorkerState.WAITING:
                    this.handleWaitingState();
                    break;
                default:
                    // Gérés par les timers
                    break;
            }
        } catch (error) {
            this.setWorkerState(WorkerState.IDLE);
        }
    }

    private handleIdleState(): void {
        if (this.hasResourcesInInventory()) {
            this.findAndMoveToDepositTarget();
        } else {
            this.findAndMoveToHarvestTarget();
        }
    }

    private handleWaitingState(): void {
        if (!this.idleTimer) {
            this.idleTimer = this.scene.time.delayedCall(3000, () => {
                this.setWorkerState(WorkerState.IDLE);
                this.idleTimer = null;
            });
        }
    }

    private findAndMoveToHarvestTarget(): void {
        const target = this.findBestHarvestTarget();

        if (target) {
            this.currentTarget = target;
            this.moveToTarget(target, WorkerState.MOVING_TO_HARVEST);
        } else {
            this.setWorkerState(WorkerState.WAITING);
        }
    }

    private findAndMoveToDepositTarget(): void {
        const target = this.findBestDepositTarget();

        if (target) {
            this.currentTarget = target;
            this.moveToTarget(target, WorkerState.MOVING_TO_DEPOSIT);
        } else if (this.depositPoint) {
            this.moveToPosition(this.depositPoint, WorkerState.MOVING_TO_DEPOSIT);
        } else {
            this.setWorkerState(WorkerState.WAITING);
        }
    }

    private findBestHarvestTarget(): ResourceEntity | TiledBuilding | null {
        for (const harvestConfig of this.config.harvestTargets.sort((a, b) => a.priority - b.priority)) {
            const target = this.findTargetByConfig(harvestConfig);
            if (target) {
                return target;
            }
        }

        return null;
    }

    private findBestDepositTarget(): TiledBuilding | null {
        for (const depositConfig of this.config.depositTargets.sort((a, b) => a.priority - b.priority)) {
            const target = this.findDepositTargetByConfig(depositConfig);
            if (target) {
                return target;
            }
        }

        return null;
    }

    private findTargetByConfig(config: any): ResourceEntity | TiledBuilding | null {
        if (config.actionType === WorkerActionType.HARVEST_RESOURCE_ENTITY) {
            return this.findNearestResourceEntity(config.targetTypes);
        } else if (config.actionType === WorkerActionType.HARVEST_BUILDING) {
            return this.findNearestBuildingWithResources(config.targetTypes, config.resourceTypes);
        }
        return null;
    }

    private findDepositTargetByConfig(config: any): TiledBuilding | null {
        return this.findNearestBuildingWithCapacity(config.targetTypes, config.resourceTypes);
    }

    private findNearestResourceEntity(targetTypes: string[]): ResourceEntity | null {
        if (!this.resourceEntityManager) {
            return null;
        }

        let bestTarget: ResourceEntity | null = null;
        let bestDistance = this.config.workRadius;

        targetTypes.forEach(targetType => {
            const entities = this.resourceEntityManager.getEntitiesByType(targetType);

            entities.forEach((entity: ResourceEntity) => {
                if (this.isValidHarvestTarget(entity)) {
                    const distance = Phaser.Math.Distance.Between(this.x, this.y, entity.x, entity.y);

                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestTarget = entity;
                    }
                }
            });
        });

        return bestTarget;
    }

    private findNearestBuildingWithResources(buildingTypes: string[], resourceTypes: ResourceType[]): TiledBuilding | null {
        if (!this.buildingManager) {
            return null;
        }

        let bestTarget: TiledBuilding | null = null;
        let bestDistance = this.config.workRadius;

        buildingTypes.forEach(buildingType => {
            const buildings = this.buildingManager.getBuildingsByType(buildingType);
            buildings.forEach((building: TiledBuilding) => {
                if (this.buildingHasResources(building, resourceTypes)) {
                    const pos = building.getPosition();
                    const distance = Phaser.Math.Distance.Between(this.x, this.y, pos.x, pos.y);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestTarget = building;
                    }
                }
            });
        });

        return bestTarget;
    }

    private findNearestBuildingWithCapacity(buildingTypes: string[], resourceTypes: ResourceType[]): TiledBuilding | null {
        if (!this.buildingManager) {
            return null;
        }

        let bestTarget: TiledBuilding | null = null;
        let bestDistance = this.config.workRadius;

        buildingTypes.forEach(buildingType => {
            const buildings = this.buildingManager.getBuildingsByType(buildingType);
            buildings.forEach((building: TiledBuilding) => {
                if (this.buildingCanAcceptResources(building, resourceTypes)) {
                    const pos = building.getPosition();
                    const distance = Phaser.Math.Distance.Between(this.x, this.y, pos.x, pos.y);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestTarget = building;
                    }
                }
            });
        });

        return bestTarget;
    }

    private moveToTarget(target: ResourceEntity | TiledBuilding, newState: WorkerState): void {
        const targetPos = target instanceof ResourceEntity ?
            { x: target.x, y: target.y } :
            target.getPosition();

        this.moveToPosition(targetPos, newState);
    }

    private moveToPosition(targetPos: WorkerPosition, newState: WorkerState): void {
        this.setWorkerState(newState);
        this.isMoving = true;

        try {
            this.play(this.config.animations.walking);
        } catch (error) {
            console.warn('Worker: Could not play walking animation:', error);
        }

        this.scene.physics.moveTo(this.getThisGameObject(), targetPos.x, targetPos.y, this.config.moveSpeed);

        const distance = Phaser.Math.Distance.Between(this.x, this.y, targetPos.x, targetPos.y);
        const travelTime = (distance / this.config.moveSpeed) * 1000;

        this.scene.time.delayedCall(Math.max(travelTime, 1000), () => {
            this.onPathCompleted();
        });
    }

    private onPathCompleted(): void {
        this.isMoving = false;
        (this.body as Phaser.Physics.Arcade.Body)?.stop();

        if (this.state === WorkerState.MOVING_TO_HARVEST) {
            this.startHarvesting();
        } else if (this.state === WorkerState.MOVING_TO_DEPOSIT) {
            this.startDepositing();
        }
    }

    private startHarvesting(): void {
        if (!this.currentTarget) {
            this.setWorkerState(WorkerState.IDLE);
            return;
        }

        this.setWorkerState(WorkerState.HARVESTING);

        this.harvestAnimationCycle();
    }

    private harvestAnimationCycle(): void {
        if (!this.currentTarget || this.state !== WorkerState.HARVESTING) {
            this.setWorkerState(WorkerState.IDLE);
            return;
        }

        try {
            this.play(this.config.animations.working);

            this.once('animationcomplete', this.onHarvestAnimationComplete, this);
        } catch (error) {
            this.actionTimer = this.scene.time.delayedCall(this.config.harvestSpeed, () => {
                this.onHarvestAnimationComplete();
            });
        }
    }

    private onHarvestAnimationComplete(): void {
        this.performHarvestHit().then(() => {
            // TODO: Redéfinir le travailleur en idle
        });
    }

    private async performHarvestHit(): Promise<void> {
        if (!this.currentTarget || this.state !== WorkerState.HARVESTING) {
            this.setWorkerState(WorkerState.IDLE);
            return;
        }

        try {
            let success = false;
            let targetDestroyed = false;

            if (this.currentTarget instanceof ResourceEntity) {
                if (typeof this.currentTarget.workerHarvest === 'function') {
                    success = await this.currentTarget.workerHarvest(this);

                    if (typeof this.currentTarget.isDestroyed === 'function') {
                        targetDestroyed = this.currentTarget.isDestroyed();
                    } else {
                        targetDestroyed = false;
                    }
                } else {
                    this.blacklistTarget(this.currentTarget);
                    success = false;
                    targetDestroyed = true;
                }
            } else {
                success = this.harvestFromBuilding(this.currentTarget);

                targetDestroyed = !this.buildingHasResources(this.currentTarget,
                    this.config.harvestTargets.flatMap(t => t.resourceTypes));
            }

            if (!success || targetDestroyed) {
                if (!success) {
                    this.blacklistTarget(this.currentTarget);
                } else {
                    this.currentTarget = null;
                }

                this.setWorkerState(WorkerState.IDLE);
                return;
            }

            if (this.isInventoryFull()) {
                this.setWorkerState(WorkerState.IDLE);
                return;
            }

            this.scene.time.delayedCall(300, () => {
                if (this.state === WorkerState.HARVESTING && this.currentTarget) {
                    this.harvestAnimationCycle();
                }
            });

        } catch (error) {
            if (this.currentTarget) {
                this.blacklistTarget(this.currentTarget);
            }
            this.currentTarget = null;
            this.setWorkerState(WorkerState.IDLE);
        }
    }

    private startDepositing(): void {
        this.setWorkerState(WorkerState.DEPOSITING);

        try {
            this.play(this.config.animations.working);
        } catch (error) {
            console.warn('Worker: Could not play working animation:', error);
        }

        this.actionTimer = this.scene.time.delayedCall(1000, () => {
            this.completeDepositing();
        });
    }

    private completeDepositing(): void {
        try {
            if (this.currentTarget instanceof TiledBuilding) {
                this.depositToBuilding(this.currentTarget);
            } else if (this.depositPoint) {
                this.depositAllResources();
            }
        } catch (error) {
            console.error(`Worker ${this.config.name}: Error during depositing:`, error);
        }

        this.currentTarget = null;

        try {
            this.play(this.config.animations.idle);
        } catch (error) {
            console.warn('Worker: Could not play idle animation:', error);
        }

        this.setWorkerState(WorkerState.IDLE);
    }

    // #region Gestion inventaire

    public addToInventory(resourceType: ResourceType, amount: number): number {
        const currentAmount = this.inventory.get(resourceType) || 0;
        const totalInventory = Array.from(this.inventory.values()).reduce((sum, val) => sum + val, 0);
        const availableSpace = this.config.carryCapacity - totalInventory;

        const actualAmount = Math.min(amount, availableSpace);

        if (actualAmount > 0) {
            this.inventory.set(resourceType, currentAmount + actualAmount);
        }

        return actualAmount;
    }

    public removeFromInventory(resourceType: ResourceType, amount: number): number {
        const currentAmount = this.inventory.get(resourceType) || 0;
        const actualAmount = Math.min(amount, currentAmount);

        if (actualAmount > 0) {
            this.inventory.set(resourceType, currentAmount - actualAmount);
        }

        return actualAmount;
    }

    public getInventoryAmount(resourceType: ResourceType): number {
        return this.inventory.get(resourceType) || 0;
    }

    public getTotalInventory(): number {
        return Array.from(this.inventory.values()).reduce((sum, val) => sum + val, 0);
    }

    public hasResourcesInInventory(): boolean {
        return this.getTotalInventory() > 0;
    }

    public isInventoryFull(): boolean {
        return this.getTotalInventory() >= this.config.carryCapacity;
    }

    // #endregion

    private depositAllResources(): void {
        this.inventory.forEach((amount, resourceType) => {
            if (amount > 0) {
                const mainScene = this.scene as any;
                if (mainScene.addResource) {
                    mainScene.addResource(resourceType, amount);
                }
                this.inventory.set(resourceType, 0);
            }
        });
    }

    private harvestFromBuilding(building: TiledBuilding): boolean {
        try {
            let harvested = false;
            const availableSpace = this.config.carryCapacity - this.getTotalInventory();

            this.config.harvestTargets.forEach(target => {
                if (availableSpace <= 0) return;

                target.resourceTypes.forEach(resourceType => {
                    const buildingAmount = building.getBuildingResource(resourceType);
                    if (buildingAmount > 0) {
                        const toHarvest = Math.min(buildingAmount, availableSpace);
                        const removed = building.removeResourceFromBuilding(resourceType, toHarvest);
                        if (removed > 0) {
                            this.addToInventory(resourceType, removed);
                            harvested = true;
                        }
                    }
                });
            });

            return harvested;
        } catch (error) {
            console.error(`Worker ${this.config.name}: Error harvesting from building:`, error);
            return false;
        }
    }

    private depositToBuilding(building: TiledBuilding): boolean {
        try {
            let deposited = false;

            this.inventory.forEach((amount, resourceType) => {
                if (amount > 0) {
                    const added = building.addResourceToBuilding(resourceType, amount);
                    if (added > 0) {
                        this.removeFromInventory(resourceType, added);
                        deposited = true;
                    }
                }
            });

            return deposited;
        } catch (error) {
            console.error(`Worker ${this.config.name}: Error depositing to building:`, error);
            return false;
        }
    }

    private isValidHarvestTarget(entity: ResourceEntity): boolean {
        const entityKey = this.getEntityKey(entity);
        const isNotBlacklisted = !this.blacklistedTargets.has(entityKey);

        let isAvailable = false;
        if (typeof entity.isAvailableForHarvest === 'function') {
            isAvailable = entity.isAvailableForHarvest(this);
        } else {
            isAvailable = !(entity.isDestroyed && entity.isDestroyed());
        }

        return isNotBlacklisted && isAvailable;
    }

    private buildingHasResources(building: TiledBuilding, resourceTypes: ResourceType[]): boolean {
        try {
            return resourceTypes.some(resourceType => {
                const amount = building.getBuildingResource(resourceType);
                return amount > 0;
            });
        } catch (error) {
            console.error(`Worker ${this.config.name}: Error checking building resources:`, error);
            return false;
        }
    }

    private buildingCanAcceptResources(building: TiledBuilding, resourceTypes: ResourceType[]): boolean {
        try {
            return resourceTypes.some(resourceType => {
                const capacity = building.getBuildingResourceCapacity(resourceType);
                const current = building.getBuildingResource(resourceType);
                return capacity > current;
            });
        } catch (error) {
            console.error(`Worker ${this.config.name}: Error checking building capacity:`, error);
            return false;
        }
    }

    // #region Gestion d'état

    private setWorkerState(newState: WorkerState): void {
        if (this.state !== newState) {
            this.state = newState
            this.clearTimers();
        }
    }

    // #endregion

    // #region Blacklist

    private blacklistTarget(target: ResourceEntity | TiledBuilding): void {
        const key = this.getEntityKey(target);
        this.blacklistedTargets.add(key);
    }

    private getEntityKey(entity: ResourceEntity | TiledBuilding): string {
        if (entity instanceof ResourceEntity) {
            return `ResourceEntity_${Math.round(entity.x)}_${Math.round(entity.y)}`;
        } else {
            const pos = entity.getPosition();
            return `TiledBuilding_${entity.getType()}_${Math.round(pos.x)}_${Math.round(pos.y)}`;
        }
    }

    private cleanupBlacklistPeriodically(): void {
        const now = Date.now();
        if (now - this.lastBlacklistCleanup > 30000) { // 30 secondes
            this.blacklistedTargets.clear();
            this.lastBlacklistCleanup = now;
        }
    }

    // #endregion

    // #region Utilitaire

    private clearTimers(): void {
        if (this.actionTimer) {
            this.actionTimer.destroy();
            this.actionTimer = null;
        }
        if (this.idleTimer) {
            this.idleTimer.destroy();
            this.idleTimer = null;
        }
    }

    // #endregion

    // #region Public

    public getConfig(): WorkerConfig {
        return this.config;
    }

    public getState(): WorkerState {
        return this.state;
    }

    public getStats(): any {
        return {
            totalHarvested: 0,
            totalDeposited: 0,
            workingTime: 0,
            idleTime: 0,
            created: Date.now()
        };
    }

    public getInventory(): ReadonlyMap<ResourceType, number> {
        return new Map(this.inventory);
    }

    public getCurrentTarget(): ResourceEntity | TiledBuilding | null {
        return this.currentTarget;
    }

    public forceIdle(): void {
        this.clearTimers();
        this.currentTarget = null;
        this.isMoving = false;
        (this.body as Phaser.Physics.Arcade.Body)?.stop();
        this.setWorkerState(WorkerState.IDLE);
    }

    public destroy(): void {
        this.clearTimers();

        if (this.mainLoopTimer) {
            this.mainLoopTimer.destroy();
            this.mainLoopTimer = null;
        }

        super.destroy();
    }

    // #endregion
}