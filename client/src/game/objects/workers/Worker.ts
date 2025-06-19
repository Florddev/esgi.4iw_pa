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
import GameObject = Phaser.GameObjects.GameObject;

export class Worker extends Phaser.GameObjects.Sprite implements Phaser.GameObjects.GameObject {
    protected config: WorkerConfig;
    protected state: WorkerState = WorkerState.IDLE;
    protected inventory = new Map<ResourceType, number>();
    protected currentTarget: ResourceEntity | TiledBuilding | null = null;
    protected depositPoint: WorkerPosition | null = null;

    // Managers - récupérés depuis la scène
    protected resourceEntityManager: any;
    protected buildingManager: any;

    // Pathfinding simple (sans EasyStar pour l'instant)
    protected isMoving: boolean = false;

    // Timers
    protected actionTimer: Phaser.Time.TimerEvent | null = null;
    protected idleTimer: Phaser.Time.TimerEvent | null = null;
    protected mainLoopTimer: Phaser.Time.TimerEvent | null = null;

    // Blacklist pour éviter les boucles
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

        console.log(`Worker ${this.config.name} created at (${x}, ${y})`);
    }

    private getThisGameObject(): Phaser.GameObjects.GameObject {
        return this as unknown as Phaser.GameObjects.GameObject;
    }

    private initializeWorker(): void {
        this.scene.add.existing(this.getThisGameObject());
        this.scene.physics.add.existing(this.getThisGameObject());

        // Configuration physique
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setSize(12, 12);
            body.setOffset(2, 4);
        }

        // Apparence
        this.setDepth(1);
        if (this.config.tint) this.setTint(this.config.tint);
        if (this.config.scale) this.setScale(this.config.scale);

        // Initialiser l'inventaire
        this.config.harvestTargets.forEach(target => {
            target.resourceTypes.forEach(resourceType => {
                this.inventory.set(resourceType, 0);
            });
        });

        console.log(`Worker initialized: ${this.config.name}`);
    }

    private setupAnimations(): void {
        try {
            AnimationUtils.initializeEntityAnimations(this.getThisGameObject(), 'player');
            this.play(this.config.animations.idle);
        } catch (error) {
            console.warn('Worker: Could not setup animations:', error);
        }
    }

    private startMainLoop(): void {
        console.log(`Worker ${this.config.name}: Starting main loop`);

        this.mainLoopTimer = this.scene.time.addEvent({
            delay: 1000, // Vérifier toutes les secondes
            callback: this.updateWorker,
            callbackScope: this,
            loop: true
        });

        // Premier appel immédiat
        this.scene.time.delayedCall(100, () => {
            this.updateWorker();
        });
    }

    private updateWorker(): void {
        try {
            console.log(`Worker ${this.config.name}: Update - State: ${this.state}, Moving: ${this.isMoving}`);

            this.cleanupBlacklistPeriodically();

            // Ne pas traiter si en mouvement
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
                    // Les autres états sont gérés par les timers
                    break;
            }
        } catch (error) {
            console.error(`Worker ${this.config.name}: Error in update loop:`, error);
            this.setState(WorkerState.IDLE);
        }
    }

    private handleIdleState(): void {
        console.log(`Worker ${this.config.name}: Handling idle state - Has resources: ${this.hasResourcesInInventory()}`);

        if (this.hasResourcesInInventory()) {
            console.log(`Worker ${this.config.name}: Has resources, looking for deposit target`);
            this.findAndMoveToDepositTarget();
        } else {
            console.log(`Worker ${this.config.name}: No resources, looking for harvest target`);
            this.findAndMoveToHarvestTarget();
        }
    }

    private handleWaitingState(): void {
        console.log(`Worker ${this.config.name}: In waiting state`);
        if (!this.idleTimer) {
            this.idleTimer = this.scene.time.delayedCall(3000, () => {
                console.log(`Worker ${this.config.name}: Wait timeout, back to idle`);
                this.setState(WorkerState.IDLE);
                this.idleTimer = null;
            });
        }
    }

    private findAndMoveToHarvestTarget(): void {
        const target = this.findBestHarvestTarget();
        console.log(`Worker ${this.config.name}: Found harvest target:`, target ? 'YES' : 'NO');

        if (target) {
            this.currentTarget = target;
            this.moveToTarget(target, WorkerState.MOVING_TO_HARVEST);
        } else {
            console.log(`Worker ${this.config.name}: No harvest target found, waiting`);
            this.setState(WorkerState.WAITING);
        }
    }

    private findAndMoveToDepositTarget(): void {
        const target = this.findBestDepositTarget();
        console.log(`Worker ${this.config.name}: Found deposit target:`, target ? 'YES' : 'NO');

        if (target) {
            this.currentTarget = target;
            this.moveToTarget(target, WorkerState.MOVING_TO_DEPOSIT);
        } else if (this.depositPoint) {
            console.log(`Worker ${this.config.name}: Using default deposit point`);
            this.moveToPosition(this.depositPoint, WorkerState.MOVING_TO_DEPOSIT);
        } else {
            console.log(`Worker ${this.config.name}: No deposit target found, waiting`);
            this.setState(WorkerState.WAITING);
        }
    }

    private findBestHarvestTarget(): ResourceEntity | TiledBuilding | null {
        console.log(`Worker ${this.config.name}: Searching for harvest targets`);

        for (const harvestConfig of this.config.harvestTargets.sort((a, b) => a.priority - b.priority)) {
            console.log(`Worker ${this.config.name}: Checking harvest config:`, harvestConfig.actionType, harvestConfig.targetTypes);

            const target = this.findTargetByConfig(harvestConfig);
            if (target) {
                console.log(`Worker ${this.config.name}: Found target of type:`, harvestConfig.targetTypes[0]);
                return target;
            }
        }

        console.log(`Worker ${this.config.name}: No harvest targets found`);
        return null;
    }

    private findBestDepositTarget(): TiledBuilding | null {
        console.log(`Worker ${this.config.name}: Searching for deposit targets`);

        for (const depositConfig of this.config.depositTargets.sort((a, b) => a.priority - b.priority)) {
            console.log(`Worker ${this.config.name}: Checking deposit config:`, depositConfig.targetTypes);

            const target = this.findDepositTargetByConfig(depositConfig);
            if (target) {
                console.log(`Worker ${this.config.name}: Found deposit target of type:`, depositConfig.targetTypes[0]);
                return target;
            }
        }

        console.log(`Worker ${this.config.name}: No deposit targets found`);
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
            console.log(`Worker ${this.config.name}: No resourceEntityManager available`);
            return null;
        }

        let bestTarget: ResourceEntity | null = null;
        let bestDistance = this.config.workRadius;

        console.log(`Worker ${this.config.name}: Searching for resource entities of types:`, targetTypes);

        targetTypes.forEach(targetType => {
            console.log(`Worker ${this.config.name}: Getting entities of type:`, targetType);

            const entities = this.resourceEntityManager.getEntitiesByType(targetType);
            console.log(`Worker ${this.config.name}: Found ${entities.length} entities of type ${targetType}`);

            entities.forEach((entity: ResourceEntity) => {
                if (this.isValidHarvestTarget(entity)) {
                    const distance = Phaser.Math.Distance.Between(this.x, this.y, entity.x, entity.y);
                    console.log(`Worker ${this.config.name}: Entity at distance ${distance}, max radius ${this.config.workRadius}`);

                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestTarget = entity;
                        console.log(`Worker ${this.config.name}: New best target found at distance ${distance}`);
                    }
                }
            });
        });

        return bestTarget;
    }

    private findNearestBuildingWithResources(buildingTypes: string[], resourceTypes: ResourceType[]): TiledBuilding | null {
        if (!this.buildingManager) {
            console.log(`Worker ${this.config.name}: No buildingManager available`);
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
            console.log(`Worker ${this.config.name}: No buildingManager available`);
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
        console.log(`Worker ${this.config.name}: Moving to position (${targetPos.x}, ${targetPos.y})`);

        this.setState(newState);
        this.isMoving = true;

        try {
            this.play(this.config.animations.walking);
        } catch (error) {
            console.warn('Worker: Could not play walking animation:', error);
        }

        // Mouvement physique simple
        this.scene.physics.moveTo(this.getThisGameObject(), targetPos.x, targetPos.y, this.config.moveSpeed);

        // Calculer le temps de voyage et déclencher l'arrivée
        const distance = Phaser.Math.Distance.Between(this.x, this.y, targetPos.x, targetPos.y);
        const travelTime = (distance / this.config.moveSpeed) * 1000;

        console.log(`Worker ${this.config.name}: Travel time: ${travelTime}ms`);

        this.scene.time.delayedCall(Math.max(travelTime, 1000), () => {
            this.onPathCompleted();
        });
    }

    private onPathCompleted(): void {
        console.log(`Worker ${this.config.name}: Path completed, state: ${this.state}`);

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
            console.log(`Worker ${this.config.name}: No target for harvesting`);
            this.setState(WorkerState.IDLE);
            return;
        }

        console.log(`Worker ${this.config.name}: Starting to harvest`);
        this.setState(WorkerState.HARVESTING);

        // Démarrer le cycle d'animation et de récolte
        this.harvestAnimationCycle();
    }

    private harvestAnimationCycle(): void {
        if (!this.currentTarget || this.state !== WorkerState.HARVESTING) {
            console.log(`Worker ${this.config.name}: Cannot start harvest cycle - invalid state or no target`);
            this.setState(WorkerState.IDLE);
            return;
        }

        console.log(`Worker ${this.config.name}: Starting harvest animation cycle`);
        try {
            // Jouer l'animation de travail
            this.play(this.config.animations.working);

            // Configurer un gestionnaire d'événement pour la fin de l'animation
            this.once('animationcomplete', this.onHarvestAnimationComplete, this);

            console.log(`Worker ${this.config.name}: Started working animation`);
        } catch (error) {
            console.warn(`Worker ${this.config.name}: Could not play working animation:`, error);

            // En cas d'échec d'animation, utiliser un timer comme solution de secours
            this.actionTimer = this.scene.time.delayedCall(this.config.harvestSpeed, () => {
                this.onHarvestAnimationComplete();
            });
        }
    }

    private onHarvestAnimationComplete(): void {
        console.log(`Worker ${this.config.name}: Harvest animation complete`);

        if (!this.currentTarget || this.state !== WorkerState.HARVESTING) {
            console.log(`Worker ${this.config.name}: Invalid state after animation: ${this.state}`);
            this.setState(WorkerState.IDLE);
            return;
        }

        // Effectuer un hit sur la cible
        this.performHarvestHit();
    }

    private async performHarvestHit(): Promise<void> {
        if (!this.currentTarget || this.state !== WorkerState.HARVESTING) {
            console.log(`Worker ${this.config.name}: Cannot perform hit - invalid state or no target`);
            this.setState(WorkerState.IDLE);
            return;
        }

        console.log(`Worker ${this.config.name}: Performing harvest hit`);

        try {
            let success = false;
            let targetDestroyed = false;

            if (this.currentTarget instanceof ResourceEntity) {
                if (typeof this.currentTarget.workerHarvest === 'function') {
                    success = await this.currentTarget.workerHarvest(this);
                    console.log(`Worker ${this.config.name}: Resource entity harvest hit success: ${success}`);

                    // Vérifier si la cible a été détruite après ce hit
                    if (typeof this.currentTarget.isDestroyed === 'function') {
                        targetDestroyed = this.currentTarget.isDestroyed();
                    } else {
                        // Essayer une autre approche si la fonction isDestroyed n'existe pas
                        targetDestroyed = false;
                    }

                    console.log(`Worker ${this.config.name}: Target destroyed: ${targetDestroyed}`);
                } else {
                    console.error(`Worker ${this.config.name}: Target does not have workerHarvest method`);
                    this.blacklistTarget(this.currentTarget);
                    success = false;
                    targetDestroyed = true; // Considérer comme détruit pour passer à autre chose
                }
            } else if (this.currentTarget instanceof TiledBuilding) {
                const harvested = this.harvestFromBuilding(this.currentTarget);
                console.log(`Worker ${this.config.name}: Building harvest success: ${harvested}`);
                success = harvested;

                // Pour les bâtiments, on ne les détruit pas, on vérifie juste s'ils ont encore des ressources
                targetDestroyed = !this.buildingHasResources(this.currentTarget,
                    this.config.harvestTargets.flatMap(t => t.resourceTypes));
            }

            // Si l'action a échoué ou que la cible est détruite
            if (!success || targetDestroyed) {
                if (!success) {
                    console.log(`Worker ${this.config.name}: Harvest hit failed`);
                    this.blacklistTarget(this.currentTarget);
                } else {
                    console.log(`Worker ${this.config.name}: Target destroyed`);
                }

                // Dans les deux cas, passer à une nouvelle cible
                this.currentTarget = null;
                this.setState(WorkerState.IDLE);
                return;
            }

            // Vérifier si l'inventaire est plein
            if (this.isInventoryFull()) {
                console.log(`Worker ${this.config.name}: Inventory full (${this.getTotalInventory()}/${this.config.carryCapacity}), going to deposit`);
                this.setState(WorkerState.IDLE); // Va déclencher la recherche d'un dépôt
                return;
            }

            // Si on arrive ici, la cible est toujours valide et notre inventaire n'est pas plein
            // Attendre un court délai puis recommencer le cycle d'animation
            this.scene.time.delayedCall(300, () => {
                if (this.state === WorkerState.HARVESTING && this.currentTarget) {
                    console.log(`Worker ${this.config.name}: Continuing harvest cycle`);
                    this.harvestAnimationCycle();
                } else {
                    console.log(`Worker ${this.config.name}: State changed during pause, not continuing harvest`);
                }
            });

        } catch (error) {
            console.error(`Worker ${this.config.name}: Error during harvest hit:`, error);
            if (this.currentTarget) {
                this.blacklistTarget(this.currentTarget);
            }
            this.currentTarget = null;
            this.setState(WorkerState.IDLE);
        }
    }

    private startDepositing(): void {
        console.log(`Worker ${this.config.name}: Starting to deposit`);
        this.setState(WorkerState.DEPOSITING);

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
        console.log(`Worker ${this.config.name}: Completing deposit`);

        try {
            if (this.currentTarget instanceof TiledBuilding) {
                const deposited = this.depositToBuilding(this.currentTarget);
                console.log(`Worker ${this.config.name}: Deposit success: ${deposited}`);
            } else if (this.depositPoint) {
                // Dépôt par défaut
                this.depositAllResources();
                console.log(`Worker ${this.config.name}: Deposited at default location`);
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

        this.setState(WorkerState.IDLE);
    }

    // === MÉTHODES D'INVENTAIRE ===

    public addToInventory(resourceType: ResourceType, amount: number): number {
        const currentAmount = this.inventory.get(resourceType) || 0;
        const totalInventory = Array.from(this.inventory.values()).reduce((sum, val) => sum + val, 0);
        const availableSpace = this.config.carryCapacity - totalInventory;

        const actualAmount = Math.min(amount, availableSpace);

        if (actualAmount > 0) {
            this.inventory.set(resourceType, currentAmount + actualAmount);
            console.log(`Worker ${this.config.name}: Added ${actualAmount} ${resourceType} to inventory`);
        }

        return actualAmount;
    }

    public removeFromInventory(resourceType: ResourceType, amount: number): number {
        const currentAmount = this.inventory.get(resourceType) || 0;
        const actualAmount = Math.min(amount, currentAmount);

        if (actualAmount > 0) {
            this.inventory.set(resourceType, currentAmount - actualAmount);
            console.log(`Worker ${this.config.name}: Removed ${actualAmount} ${resourceType} from inventory`);
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

        // CORRECTION: Utiliser la méthode isAvailableForHarvest si elle existe
        let isAvailable = false;
        if (typeof entity.isAvailableForHarvest === 'function') {
            isAvailable = entity.isAvailableForHarvest(this);
        } else {
            // Fallback si la méthode n'existe pas
            isAvailable = !(entity.isDestroyed && entity.isDestroyed());
        }

        console.log(`Worker ${this.config.name}: Validating entity - Blacklisted: ${!isNotBlacklisted}, Available: ${isAvailable}`);

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

    // === GESTION D'ÉTAT ===

    private setState(newState: WorkerState): void {
        if (this.state !== newState) {
            console.log(`Worker ${this.config.name}: State change ${this.state} -> ${newState}`);
            this.state = newState;
            this.clearTimers();
        }
    }

    // === BLACKLIST ===

    private blacklistTarget(target: ResourceEntity | TiledBuilding): void {
        const key = this.getEntityKey(target);
        this.blacklistedTargets.add(key);
        console.log(`Worker ${this.config.name}: Blacklisted target ${key}`);
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
            console.log(`Worker ${this.config.name}: Cleared blacklist`);
        }
    }

    // === UTILITAIRES ===

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

    // === API PUBLIQUE ===

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
        this.setState(WorkerState.IDLE);
    }

    public destroy(): void {
        console.log(`Worker ${this.config.name}: Destroying`);
        this.clearTimers();

        if (this.mainLoopTimer) {
            this.mainLoopTimer.destroy();
            this.mainLoopTimer = null;
        }

        super.destroy();
    }
}