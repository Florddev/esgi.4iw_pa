import { Scene } from 'phaser';

// Définir WorkerState directement dans ce fichier pour éviter les problèmes d'import circulaire
export enum WorkerState {
    IDLE = 'idle',
    MOVING_TO_RESOURCE = 'movingToResource',
    HARVESTING = 'harvesting',
    MOVING_TO_STORAGE = 'movingToStorage',
    DEPOSITING = 'depositing'
}

export type ResourceType = 'wood' | 'stone' | 'food';

// Interfaces locales pour éviter les dépendances circulaires
interface WorkerConfig {
    readonly maxInventory: number;
    readonly harvestSpeed: number;
    readonly moveSpeed: number;
    readonly workRadius?: number;
    readonly efficiency?: number;
}

interface WorkerStats {
    readonly totalHarvested: number;
    readonly totalDeposited: number;
    readonly timeWorked: number;
    readonly efficiency: number;
}

interface WorkerPosition {
    readonly x: number;
    readonly y: number;
}

interface PathNode {
    readonly x: number;
    readonly y: number;
}

interface WorkerDisplayConfig {
    readonly inventoryFontSize: string;
    readonly inventoryBackgroundColor: number;
    readonly inventoryTextColor: string;
    readonly inventoryPadding: { x: number; y: number };
}

export abstract class Worker extends Phaser.Physics.Arcade.Sprite {
    // Configuration et état
    protected readonly config: WorkerConfig;
    protected state: WorkerState = WorkerState.IDLE;
    protected readonly stats: WorkerStats;

    // Inventaire et ressources
    protected readonly inventory = new Map<ResourceType, number>();
    protected targetResource: any = null;
    protected targetStorage: any = null;
    protected readonly depositPoint: WorkerPosition | null = null;

    // Pathfinding et mouvement
    protected path: PathNode[] = [];
    protected currentTargetIndex: number = 0;
    protected readonly blacklistedTiles = new Map<string, number>();
    protected readonly blacklistDuration = 30000; // 30 secondes

    // Interface utilisateur
    private readonly displayConfig: WorkerDisplayConfig;
    private inventoryText: Phaser.GameObjects.Text | null = null;

    // Timers et tasks
    protected currentTask: Phaser.Time.TimerEvent | null = null;

    constructor(
        scene: Scene, 
        x: number, 
        y: number, 
        texture: string, 
        config: WorkerConfig, 
        depositPoint?: WorkerPosition
    ) {
        super(scene, x, y, texture);

        this.config = { ...config };
        this.stats = this.createInitialStats();
        this.depositPoint = depositPoint ? { ...depositPoint } : null;
        
        this.displayConfig = {
            inventoryFontSize: '12px',
            inventoryBackgroundColor: 0x000000,
            inventoryTextColor: '#ffffff',
            inventoryPadding: { x: 3, y: 1 }
        };

        this.initializeWorker();
    }

    private initializeWorker(): void {
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);

        this.setupPhysics();
        this.createAnimations();
        this.createInventoryDisplay();
        
        this.play('worker-idle');
    }

    private setupPhysics(): void {
        this.body.setSize(12, 6);
        this.body.setOffset(42, 32);
    }

    private createInitialStats(): WorkerStats {
        return {
            totalHarvested: 0,
            totalDeposited: 0,
            timeWorked: 0,
            efficiency: 1.0
        };
    }

    protected abstract createAnimations(): void;

    // Gestion de l'inventaire
    public getInventoryTotal(): number {
        let total = 0;
        this.inventory.forEach(amount => total += amount);
        return total;
    }

    public isInventoryFull(): boolean {
        return this.getInventoryTotal() >= this.config.maxInventory;
    }

    public getInventoryState(): ReadonlyMap<ResourceType, number> {
        return new Map(this.inventory);
    }

    protected addToInventory(type: ResourceType, amount: number): number {
        const currentAmount = this.inventory.get(type) || 0;
        const availableSpace = this.config.maxInventory - this.getInventoryTotal();
        const canAdd = Math.min(amount, availableSpace);

        if (canAdd > 0) {
            this.inventory.set(type, currentAmount + canAdd);
            this.updateStats('harvested', canAdd);
        }

        return canAdd;
    }

    protected removeFromInventory(type: ResourceType, amount: number): number {
        const currentAmount = this.inventory.get(type) || 0;
        const canRemove = Math.min(amount, currentAmount);

        if (canRemove > 0) {
            this.inventory.set(type, currentAmount - canRemove);
            this.updateStats('deposited', canRemove);
        }

        return canRemove;
    }

    // Interface utilisateur
    private createInventoryDisplay(): void {
        this.inventoryText = this.scene.add.text(
            this.x,
            this.y - 25,
            this.getInventoryDisplayText(),
            {
                fontSize: this.displayConfig.inventoryFontSize,
                color: this.displayConfig.inventoryTextColor,
                backgroundColor: '#' + this.displayConfig.inventoryBackgroundColor.toString(16).padStart(6, '0'),
                padding: this.displayConfig.inventoryPadding
            }
        );
        
        this.inventoryText.setOrigin(0.5);
        this.inventoryText.setDepth(1000);
    }

    private getInventoryDisplayText(): string {
        return `${this.getInventoryTotal()}/${this.config.maxInventory}`;
    }

    protected updateInventoryDisplay(): void {
        if (!this.inventoryText) return;

        this.inventoryText.setText(this.getInventoryDisplayText());
        this.inventoryText.setPosition(this.x, this.y - 25);
    }

    // Gestion d'état
    public getState(): WorkerState {
        return this.state;
    }

    public setState(state: WorkerState): void {
        if (this.state !== state) {
            const previousState = this.state;
            this.state = state;
            this.onStateChanged(previousState, state);
        }
    }

    protected onStateChanged(from: WorkerState, to: WorkerState): void {
        // Override dans les classes enfants si nécessaire
        console.log(`Worker state changed: ${from} -> ${to}`);
    }

    // Pathfinding et mouvement
    public setPath(path: PathNode[]): void {
        // Retirer le premier point s'il correspond à la position actuelle
        if (path.length > 0) {
            const firstTile = path[0];
            const currentTile = this.getCurrentTilePosition();
            
            if (firstTile.x === currentTile.x && firstTile.y === currentTile.y) {
                path.shift();
            }
        }

        this.path = [...path]; // Copie défensive
        this.currentTargetIndex = 0;
    }

    private getCurrentTilePosition(): WorkerPosition {
        return {
            x: Math.floor(this.x / 16),
            y: Math.floor(this.y / 16)
        };
    }

    protected moveToTarget(
        target: WorkerPosition, 
        onArrival: () => void, 
        onFailure?: () => void
    ): void {
        const mainScene = this.scene as any;
        const currentTile = this.getCurrentTilePosition();
        const targetTile = this.worldToTilePosition(target);

        // Vérifier si déjà à destination
        if (currentTile.x === targetTile.x && currentTile.y === targetTile.y) {
            onArrival();
            return;
        }

        // Vérifier les limites de la carte
        if (!this.isValidTilePosition(mainScene, targetTile)) {
            console.log('Worker: Cible hors limites');
            onFailure?.();
            return;
        }

        // Calculer le chemin
        mainScene.easyStar.findPath(
            currentTile.x, currentTile.y,
            targetTile.x, targetTile.y,
            (path: PathNode[] | null) => {
                this.handlePathfindingResult(path, target, onArrival, onFailure);
            }
        );

        mainScene.easyStar.calculate();
    }

    private worldToTilePosition(worldPos: WorkerPosition): WorkerPosition {
        return {
            x: Math.floor(worldPos.x / 16),
            y: Math.floor(worldPos.y / 16)
        };
    }

    private isValidTilePosition(mainScene: any, tilePos: WorkerPosition): boolean {
        return tilePos.x >= 0 && 
               tilePos.y >= 0 &&
               tilePos.x < mainScene.map.width &&
               tilePos.y < mainScene.map.height;
    }

    private handlePathfindingResult(
        path: PathNode[] | null,
        target: WorkerPosition,
        onArrival: () => void,
        onFailure?: () => void
    ): void {
        if (!path) {
            console.log('Worker: Aucun chemin trouvé');
            this.handlePathfindingFailure();
            onFailure?.();
            return;
        }

        console.log(`Worker: Chemin trouvé avec ${path.length} étapes`);
        this.setPath(path);
        this.waitForArrival(target, onArrival);
    }

    private handlePathfindingFailure(): void {
        // Ajouter la position cible à la liste noire temporairement
        if (this.state === WorkerState.MOVING_TO_RESOURCE && this.targetResource) {
            const tileKey = this.getTileKey(this.targetResource.x, this.targetResource.y);
            this.blacklistedTiles.set(tileKey, Date.now());
            
            if (typeof this.targetResource.releaseHarvester === 'function') {
                this.targetResource.releaseHarvester();
            }
            this.targetResource = null;
        }
    }

    private getTileKey(x: number, y: number): string {
        const tilePos = this.worldToTilePosition({ x, y });
        return `${tilePos.x},${tilePos.y}`;
    }

    private waitForArrival(target: WorkerPosition, onArrival: () => void): void {
        const checkInterval = this.scene.time.addEvent({
            delay: 100,
            callback: () => {
                const distance = Phaser.Math.Distance.Between(
                    this.x, this.y, target.x, target.y
                );

                const pathCompleted = this.path.length > 0 && 
                                    this.currentTargetIndex >= this.path.length;

                if (distance < 20 || pathCompleted) {
                    checkInterval.destroy();
                    this.stopMovement();
                    
                    this.scene.time.delayedCall(300, () => {
                        onArrival();
                    });
                }
            },
            loop: true
        });
    }

    protected updateMovement(): void {
        if (this.path.length === 0 || this.currentTargetIndex >= this.path.length) {
            this.stopMovement();
            return;
        }

        const targetTile = this.path[this.currentTargetIndex];
        const targetWorld = this.tileToWorldPosition(targetTile);
        
        const distance = Phaser.Math.Distance.Between(
            this.x, this.y, targetWorld.x, targetWorld.y
        );

        if (distance < 2) {
            this.moveToNextPathNode();
        } else {
            this.moveTowardsTarget(targetWorld);
        }
    }

    private tileToWorldPosition(tile: PathNode): WorkerPosition {
        return {
            x: tile.x * 16 + 8, // Centré sur la tuile
            y: tile.y * 16 + 8
        };
    }

    private moveToNextPathNode(): void {
        this.currentTargetIndex++;
        
        if (this.currentTargetIndex >= this.path.length) {
            this.path = [];
            this.stopMovement();
        }
    }

    private moveTowardsTarget(target: WorkerPosition): void {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const velocityX = (dx / distance) * this.config.moveSpeed;
            const velocityY = (dy / distance) * this.config.moveSpeed;
            
            this.setVelocity(velocityX, velocityY);
            this.updateMovementAnimation(velocityX);
        }
    }

    private updateMovementAnimation(velocityX: number): void {
        if (!this.anims.isPlaying || this.anims.currentAnim?.key !== 'worker-walk') {
            this.play('worker-walk', true);
        }
        this.setFlipX(velocityX < 0);
    }

    private stopMovement(): void {
        this.setVelocity(0, 0);
        
        if (!this.anims.isPlaying || this.anims.currentAnim?.key !== 'worker-idle') {
            this.play('worker-idle', true);
        }
    }

    // Exploration aléatoire
    protected exploreRandomly(): void {
        console.log('Worker: Exploration aléatoire démarrée');

        const explorationRadius = 100;
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * explorationRadius;

        const targetX = this.x + Math.cos(angle) * distance;
        const targetY = this.y + Math.sin(angle) * distance;

        const mainScene = this.scene as any;
        const mapWidth = mainScene.map.widthInPixels;
        const mapHeight = mainScene.map.heightInPixels;

        const finalTarget = {
            x: Math.max(32, Math.min(mapWidth - 32, targetX)),
            y: Math.max(32, Math.min(mapHeight - 32, targetY))
        };

        this.moveToTarget(
            finalTarget,
            () => {
                console.log('Worker: Exploration terminée avec succès');
                this.setState(WorkerState.IDLE);
            },
            () => {
                console.log('Worker: Échec de l\'exploration, nouvel essai');
                this.scene.time.delayedCall(1000, () => {
                    this.setState(WorkerState.IDLE);
                });
            }
        );
    }

    // Nettoyage de la liste noire
    protected cleanupBlacklist(): void {
        const now = Date.now();
        for (const [tileKey, timestamp] of this.blacklistedTiles.entries()) {
            if (now - timestamp > this.blacklistDuration) {
                this.blacklistedTiles.delete(tileKey);
            }
        }
    }

    // Statistiques
    private updateStats(type: 'harvested' | 'deposited', amount: number): void {
        if (type === 'harvested') {
            (this.stats as any).totalHarvested += amount;
        } else {
            (this.stats as any).totalDeposited += amount;
        }
    }

    public getStats(): Readonly<WorkerStats> {
        return { ...this.stats };
    }

    // Méthodes abstraites
    protected abstract findNearestResource(): any;
    protected abstract findNearestStorage(): any;
    protected abstract harvestResource(): void;
    protected abstract depositResources(): void;
    protected abstract findInteractionPoint(target: any): WorkerPosition;
    protected abstract findStoragePoint(storage: any): WorkerPosition;

    // Méthodes du cycle de vie
    protected updateIdle(): void {
        this.cleanupBlacklist();

        if (this.isInventoryFull()) {
            this.handleFullInventory();
        } else {
            this.handleEmptyInventory();
        }
    }

    private handleFullInventory(): void {
        // Prioriser les bâtiments de stockage
        const storage = this.findNearestStorage();
        
        if (storage) {
            this.startStorageDeposit(storage);
        } else if (this.depositPoint) {
            this.startDepositPointDeposit();
        } else {
            this.exploreRandomly();
        }
    }

    private handleEmptyInventory(): void {
        const resource = this.findNearestResource();
        
        if (resource) {
            this.startResourceHarvesting(resource);
        } else {
            this.exploreRandomly();
        }
    }

    private startStorageDeposit(storage: any): void {
        this.targetStorage = storage;
        this.setState(WorkerState.MOVING_TO_STORAGE);

        const storagePoint = this.findStoragePoint(storage);
        this.moveToTarget(
            storagePoint,
            () => {
                this.setState(WorkerState.DEPOSITING);
                this.depositResources();
            },
            () => this.handleStorageFailure()
        );
    }

    private startDepositPointDeposit(): void {
        this.targetStorage = null;
        this.setState(WorkerState.MOVING_TO_STORAGE);

        this.moveToTarget(
            this.depositPoint!,
            () => {
                this.setState(WorkerState.DEPOSITING);
                this.depositResources();
            },
            () => {
                console.log('Worker: Impossible d\'atteindre le point de dépôt');
                this.exploreRandomly();
            }
        );
    }

    private startResourceHarvesting(resource: any): void {
        this.targetResource = resource;
        this.setState(WorkerState.MOVING_TO_RESOURCE);

        const interactionPoint = this.findInteractionPoint(resource);
        this.moveToTarget(
            interactionPoint,
            () => {
                this.setState(WorkerState.HARVESTING);
                this.harvestResource();
            },
            () => this.handleResourceFailure()
        );
    }

    private handleStorageFailure(): void {
        console.log('Worker: Échec d\'accès au stockage');
        if (this.depositPoint) {
            this.startDepositPointDeposit();
        } else {
            this.exploreRandomly();
        }
    }

    private handleResourceFailure(): void {
        console.log('Worker: Échec d\'accès à la ressource');
        if (this.targetResource && typeof this.targetResource.releaseHarvester === 'function') {
            this.targetResource.releaseHarvester();
        }
        this.targetResource = null;
        this.setState(WorkerState.IDLE);
    }

    // Nettoyage et cycle de vie
    public cleanup(): void {
        if (this.targetResource && typeof this.targetResource.releaseHarvester === 'function') {
            this.targetResource.releaseHarvester();
        }
        
        this.targetResource = null;
        this.targetStorage = null;
        this.currentTask?.destroy();
        this.currentTask = null;
        this.setState(WorkerState.IDLE);
    }

    public setDepositPoint(x: number, y: number): void {
        (this.depositPoint as any) = { x, y };
    }

    update(): void {
        this.updateInventoryDisplay();

        switch (this.state) {
            case WorkerState.IDLE:
                this.updateIdle();
                break;
            case WorkerState.MOVING_TO_RESOURCE:
            case WorkerState.MOVING_TO_STORAGE:
                this.updateMovement();
                break;
            case WorkerState.HARVESTING:
            case WorkerState.DEPOSITING:
                this.setVelocity(0, 0);
                break;
        }
    }

    destroy(fromScene?: boolean): void {
        this.inventoryText?.destroy();
        this.currentTask?.destroy();
        this.cleanup();
        
        super.destroy(fromScene);
    }
}