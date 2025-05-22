import { Scene } from 'phaser';
import { Worker, WorkerState } from './Worker';
import type { Tree } from '../Tree';
import type { TiledBuilding } from '../TiledBuilding';
import { ResourceType as GameResourceType } from '../../types/index';

// Types locaux pour éviter les dépendances circulaires
interface WorkerPosition {
    readonly x: number;
    readonly y: number;
}

interface WorkerConfig {
    readonly maxInventory: number;
    readonly harvestSpeed: number;
    readonly moveSpeed: number;
    readonly workRadius?: number;
    readonly efficiency?: number;
}

interface LumberjackConfig extends WorkerConfig {
    readonly woodPerTree: number;
    readonly harvestTimeout: number;
    readonly stuckResetTime: number;
}

interface HarvestingState {
    inProgress: boolean;
    startTime: number;
    target: Tree | null;
}

export class Lumberjack extends Worker {
    private readonly lumberjackConfig: LumberjackConfig;
    private readonly harvestingState: HarvestingState;
    private readonly performanceTracking = {
        idleActionTriggered: false,
        lastResetTime: 0
    };

    // Timers
    private harvestTimer: Phaser.Time.TimerEvent | null = null;
    private depositTimer: Phaser.Time.TimerEvent | null = null;

    constructor(scene: Scene, x: number, y: number, depositPoint?: WorkerPosition) {
        const config: LumberjackConfig = {
            maxInventory: 10,
            harvestSpeed: 3000,
            moveSpeed: 70,
            workRadius: 500,
            efficiency: 1.0,
            woodPerTree: 3,
            harvestTimeout: 10000,
            stuckResetTime: 15000
        };

        super(scene, x, y, 'player-idle', config, depositPoint);
        
        this.lumberjackConfig = config;
        this.harvestingState = {
            inProgress: false,
            startTime: 0,
            target: null
        };
        
        this.initializeLumberjack();
    }

    private initializeLumberjack(): void {
        this.inventory.set('wood', 0);
        this.setTint(0xdd9955);
        this.setDepth(1);
        this.setupChoppingAnimations();
    }

    protected createAnimations(): void {
        const animations = [
            {
                key: 'worker-walk',
                texture: 'player-walk',
                frames: { start: 0, end: 7 },
                frameRate: 12,
                repeat: -1
            },
            {
                key: 'worker-idle',
                texture: 'player-idle',
                frames: { start: 0, end: 8 },
                frameRate: 8,
                repeat: -1
            },
            {
                key: 'worker-chop',
                texture: 'player-chop',
                frames: { start: 0, end: 7 },
                frameRate: 20,
                repeat: 0
            }
        ];

        animations.forEach(({ key, texture, frames, frameRate, repeat }) => {
            if (!this.scene.anims.exists(key)) {
                this.scene.anims.create({
                    key,
                    frames: this.scene.anims.generateFrameNumbers(texture, frames),
                    frameRate,
                    repeat
                });
            }
        });

        this.play('worker-idle');
    }

    protected findNearestResource(): Tree | null {
        const mainScene = this.scene as any;
        
        if (!mainScene.trees?.length) {
            return null;
        }

        this.cleanupBlacklist();

        const availableTrees = this.getAvailableTrees(mainScene.trees);
        
        if (availableTrees.length === 0) {
            return this.expandSearchRadius(mainScene.trees);
        }

        return this.selectOptimalTree(availableTrees);
    }

    private getAvailableTrees(allTrees: Tree[]): Tree[] {
        return allTrees.filter(tree => {
            const distance = Phaser.Math.Distance.Between(this.x, this.y, tree.x, tree.y);
            const tileKey = this.getTileKey(tree.x, tree.y);
            
            return !this.blacklistedTiles.has(tileKey) &&
                   tree.isAvailableForHarvest(this) &&
                   distance <= this.lumberjackConfig.workRadius;
        });
    }

    private expandSearchRadius(allTrees: Tree[]): Tree | null {
        console.log('Lumberjack: Expansion du rayon de recherche');
        
        const extendedRadius = this.lumberjackConfig.workRadius * 1.5;
        const extendedTrees = allTrees.filter(tree => {
            const distance = Phaser.Math.Distance.Between(this.x, this.y, tree.x, tree.y);
            const tileKey = this.getTileKey(tree.x, tree.y);
            
            return !this.blacklistedTiles.has(tileKey) &&
                   tree.isAvailableForHarvest(this) &&
                   distance <= extendedRadius;
        });

        return extendedTrees.length > 0 ? this.selectOptimalTree(extendedTrees) : null;
    }

    private selectOptimalTree(trees: Tree[]): Tree | null {
        // Trier par distance
        trees.sort((a, b) => {
            const distA = Phaser.Math.Distance.Between(this.x, this.y, a.x, a.y);
            const distB = Phaser.Math.Distance.Between(this.x, this.y, b.x, b.y);
            return distA - distB;
        });

        // Essayer les 3 premiers arbres pour éviter la contention
        const candidateCount = Math.min(3, trees.length);
        
        for (let i = 0; i < candidateCount; i++) {
            const tree = trees[i];
            if (tree.setHarvester(this)) {
                return tree;
            }
        }

        return null;
    }

    private getTileKey(x: number, y: number): string {
        const tileX = Math.floor(x / 16);
        const tileY = Math.floor(y / 16);
        return `${tileX},${tileY}`;
    }

    protected findNearestStorage(): TiledBuilding | null {
        const mainScene = this.scene as any;
        const buildings = mainScene.buildingManager?.getBuildings() || [];
        
        const sawmills = buildings.filter((building: TiledBuilding) => 
            building.getType() === 'sawmill'
        );

        if (sawmills.length === 0) {
            return null;
        }

        return this.findClosestBuilding(sawmills);
    }

    private findClosestBuilding(buildings: TiledBuilding[]): TiledBuilding {
        return buildings.reduce((closest, current) => {
            const closestDist = this.getDistanceToBuilding(closest);
            const currentDist = this.getDistanceToBuilding(current);
            return currentDist < closestDist ? current : closest;
        });
    }

    private getDistanceToBuilding(building: TiledBuilding): number {
        const pos = building.getPosition();
        return Phaser.Math.Distance.Between(this.x, this.y, pos.x, pos.y);
    }

    protected harvestResource(): void {
        if (!this.targetResource || this.harvestingState.inProgress) {
            this.setState(WorkerState.IDLE);
            return;
        }

        if (this.targetResource.isDestroyed) {
            this.releaseTarget();
            this.setState(WorkerState.IDLE);
            return;
        }

        this.startHarvesting();
    }

    private startHarvesting(): void {
        this.harvestingState.inProgress = true;
        this.harvestingState.startTime = Date.now();
        this.harvestingState.target = this.targetResource;

        this.stopMovement();
        this.orientTowardsTarget();
        this.playHarvestAnimation();

        console.log('Lumberjack: Début de la récolte');
        this.performHarvest();
    }

    private stopMovement(): void {
        this.setVelocity(0, 0);
    }

    private orientTowardsTarget(): void {
        if (!this.targetResource) return;
        
        const isFacingRight = this.targetResource.x > this.x;
        this.setFlipX(!isFacingRight);
    }

    private playHarvestAnimation(): void {
        this.play('worker-chop');
    }

    private async performHarvest(): Promise<void> {
        if (!this.targetResource?.workerHarvest) {
            console.error('Lumberjack: Méthode workerHarvest non disponible');
            this.finishHarvesting(false);
            return;
        }

        try {
            const treeDestroyed = await this.targetResource.workerHarvest(this);
            this.handleHarvestResult(treeDestroyed);
        } catch (error) {
            console.error('Lumberjack: Erreur lors de la récolte:', error);
            this.finishHarvesting(false);
        }
    }

    private handleHarvestResult(treeDestroyed: boolean): void {
        if (treeDestroyed) {
            console.log('Lumberjack: Arbre détruit');
            this.addWoodToInventory();
        }

        const shouldContinue = this.shouldContinueHarvesting(treeDestroyed);
        this.finishHarvesting(shouldContinue);
    }

    private addWoodToInventory(): void {
        const woodAdded = this.addToInventory('wood', this.lumberjackConfig.woodPerTree);
        console.log(`Lumberjack: ${woodAdded} bois ajouté. Total: ${this.inventory.get('wood')}`);
        this.updateInventoryDisplay();
    }

    private shouldContinueHarvesting(treeDestroyed: boolean): boolean {
        return !this.isInventoryFull() && 
               !treeDestroyed && 
               this.targetResource && 
               !this.targetResource.isDestroyed;
    }

    private finishHarvesting(continueHarvesting: boolean): void {
        this.releaseTarget();
        this.harvestingState.inProgress = false;
        this.play('worker-idle');

        if (continueHarvesting) {
            this.setState(WorkerState.HARVESTING);
            this.scene.time.delayedCall(500, () => {
                this.harvestingState.inProgress = false;
            });
        } else {
            this.setState(WorkerState.IDLE);
        }
    }

    private releaseTarget(): void {
        if (this.targetResource && typeof this.targetResource.releaseHarvester === 'function') {
            this.targetResource.releaseHarvester();
        }
        this.targetResource = null;
        this.harvestingState.target = null;
    }

    public playChopAnimation(onHitFrame?: () => void): void {
        console.log('Lumberjack: Animation de coupe manuelle');
        this.play('worker-chop', true);

        if (onHitFrame) {
            const handleAnimationUpdate = (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
                if (anim.key === 'worker-chop' && frame.index === 4) {
                    onHitFrame();
                }
            };

            this.on('animationupdate', handleAnimationUpdate);
            
            this.once('animationcomplete', () => {
                this.off('animationupdate', handleAnimationUpdate);
                this.play('worker-idle', true);
            });
        } else {
            this.once('animationcomplete', () => {
                this.play('worker-idle', true);
            });
        }
    }

    protected depositResources(): void {
        console.log('Lumberjack: Début du dépôt de ressources');
        
        const originalTint = this.tintTopLeft;
        this.setTint(0xFFFF00); // Jaune pendant le dépôt
        
        this.depositTimer = this.scene.time.delayedCall(1000, () => {
            this.restoreOriginalTint(originalTint);
            this.processDeposit();
            this.setState(WorkerState.IDLE);
        });
    }

    private restoreOriginalTint(originalTint: number): void {
        this.setTint(originalTint);
    }

    private processDeposit(): void {
        const woodAmount = this.inventory.get('wood') || 0;
        
        if (woodAmount <= 0) {
            return;
        }

        if (this.targetStorage?.addResourceToBuilding) {
            this.depositToBuilding(woodAmount);
        } else if (this.isAtDepositPoint()) {
            this.depositToPoint(woodAmount);
        } else {
            console.log('Lumberjack: Aucun dépôt valide trouvé');
        }

        this.updateInventoryDisplay();
    }

    private depositToBuilding(woodAmount: number): void {
        console.log('Lumberjack: Dépôt dans le bâtiment');
        
        const deposited = this.targetStorage.addResourceToBuilding(GameResourceType.WOOD, woodAmount);
        this.removeFromInventory('wood', deposited);
        
        console.log(`Lumberjack: ${deposited} bois déposé dans ${this.targetStorage.getType()}`);
        
        this.updateBuildingInterface();
        this.targetStorage = null;
    }

    private depositToPoint(woodAmount: number): void {
        console.log('Lumberjack: Dépôt au point de dépôt');
        
        (this.scene as any).events.emit('addWood', woodAmount);
        this.removeFromInventory('wood', woodAmount);
        
        console.log(`Lumberjack: ${woodAmount} bois déposé au point de dépôt`);
    }

    private isAtDepositPoint(): boolean {
        return this.depositPoint && 
               Math.abs(this.x - this.depositPoint.x) < 30 && 
               Math.abs(this.y - this.depositPoint.y) < 30;
    }

    private updateBuildingInterface(): void {
        const buildingUI = this.scene.scene.get('BuildingInfoUI') as any;
        if (buildingUI?.updateInterface) {
            buildingUI.updateInterface();
        }
    }

    private setupChoppingAnimations(): void {
        this.on('animationcomplete', (anim: Phaser.Animations.Animation) => {
            if (anim.key === 'worker-chop') {
                console.log('Lumberjack: Animation de coupe terminée');
                this.play('worker-idle');
            }
        });
    }

    protected findInteractionPoint(tree: Tree): WorkerPosition {
        if (!tree?.findNearestInteractionPoint) {
            console.warn('Lumberjack: Tree ne possède pas findNearestInteractionPoint');
            return { x: tree.x, y: tree.y };
        }
        
        return tree.findNearestInteractionPoint(this.x, this.y);
    }

    protected findStoragePoint(storage: TiledBuilding): WorkerPosition {
        const pos = storage.getPosition();
        const dim = storage.getDimensions();

        return {
            x: pos.x + (dim.tilesWidth * 16) / 2, // Milieu de la largeur
            y: pos.y + dim.tilesHeight * 16 + 16  // En dessous du bâtiment
        };
    }

    protected onStateChanged(from: WorkerState, to: WorkerState): void {
        super.onStateChanged(from, to);
        
        // Nettoyage spécifique aux transitions d'état
        if (from === WorkerState.HARVESTING && to !== WorkerState.HARVESTING) {
            this.cleanupHarvesting();
        }
    }

    private cleanupHarvesting(): void {
        if (this.harvestingState.inProgress) {
            this.releaseTarget();
            this.harvestingState.inProgress = false;
        }
        
        this.harvestTimer?.destroy();
        this.harvestTimer = null;
    }

    // Détection et récupération des états bloqués
    private isHarvestingStuck(): boolean {
        if (!this.harvestingState.inProgress) return false;
        
        const harvestDuration = Date.now() - this.harvestingState.startTime;
        return harvestDuration > this.lumberjackConfig.harvestTimeout;
    }

    private handleStuckState(): void {
        console.log('Lumberjack: Détection d\'état bloqué, réinitialisation');
        
        this.cleanupHarvesting();
        this.setState(WorkerState.IDLE);
        this.performanceTracking.lastResetTime = Date.now();
        
        // Forcer l'animation idle
        this.play('worker-idle');
    }

    private shouldTriggerIdleAction(): boolean {
        const timeSinceLastReset = Date.now() - this.performanceTracking.lastResetTime;
        return this.state === WorkerState.IDLE && 
               !this.performanceTracking.idleActionTriggered &&
               timeSinceLastReset > 1000; // Délai d'au moins 1 seconde
    }

    private triggerIdleAction(): void {
        console.log('Lumberjack: Déclenchement forcé de updateIdle');
        this.updateIdle();
        this.performanceTracking.idleActionTriggered = true;

        // Réinitialiser le flag après un délai
        this.scene.time.delayedCall(1000, () => {
            this.performanceTracking.idleActionTriggered = false;
        });
    }

    // Méthodes utilitaires publiques
    public getHarvestingProgress(): number {
        if (!this.harvestingState.inProgress) return 0;
        
        const elapsed = Date.now() - this.harvestingState.startTime;
        return Math.min(elapsed / this.lumberjackConfig.harvestSpeed, 1);
    }

    public isCurrentlyHarvesting(): boolean {
        return this.harvestingState.inProgress;
    }

    public getCurrentTarget(): Tree | null {
        return this.harvestingState.target;
    }

    public getWorkRadius(): number {
        return this.lumberjackConfig.workRadius;
    }

    public getEfficiencyMetrics(): { 
        readonly woodPerMinute: number;
        readonly utilizationRate: number; 
    } {
        const stats = this.getStats();
        const timeWorkedMinutes = stats.timeWorked / 60000; // Convert to minutes
        
        return {
            woodPerMinute: timeWorkedMinutes > 0 ? stats.totalHarvested / timeWorkedMinutes : 0,
            utilizationRate: stats.efficiency
        };
    }

    // Override du cycle de mise à jour
    update(): void {
        // Vérification des états bloqués
        if (this.isHarvestingStuck()) {
            this.handleStuckState();
            return;
        }

        // Déclenchement forcé de l'action idle si nécessaire
        if (this.shouldTriggerIdleAction()) {
            this.triggerIdleAction();
        } else if (this.state !== WorkerState.IDLE) {
            this.performanceTracking.idleActionTriggered = false;
        }

        // Vérifier si un arbre est en cours de récolte
        if (this.state === WorkerState.HARVESTING && !this.harvestingState.inProgress) {
            this.harvestResource();
        }

        // Appeler la mise à jour parent
        super.update();
    }

    // Nettoyage
    destroy(fromScene?: boolean): void {
        this.cleanupHarvesting();
        this.depositTimer?.destroy();
        
        super.destroy(fromScene);
    }
}