import { Scene } from 'phaser'
import { Worker, WorkerState } from './Worker'
import { WorkerRegistry } from '../../services/WorkerRegistry'
import { WorkerType } from '../../types'
import { AnimationType } from '../../services/AnimationRegistry'
import { AnimationUtils } from '../../utils/AnimationUtils'
import type { Tree } from '../Tree'
import type { TiledBuilding } from '../TiledBuilding'
import { ResourceType as GameResourceType } from '../../types/index'

interface WorkerPosition {
    readonly x: number
    readonly y: number
}

interface HarvestingState {
    inProgress: boolean
    startTime: number
    target: Tree | null
}

export class Lumberjack extends Worker {
    private readonly harvestingState: HarvestingState
    private readonly performanceTracking = {
        idleActionTriggered: false,
        lastResetTime: 0
    }

    // Timers
    private harvestTimer: Phaser.Time.TimerEvent | null = null
    private depositTimer: Phaser.Time.TimerEvent | null = null

    constructor(scene: Scene, x: number, y: number, depositPoint?: WorkerPosition) {
        const workerRegistry = WorkerRegistry.getInstance()
        const config = workerRegistry.getWorkerConfig(WorkerType.LUMBERJACK)
        
        if (!config) {
            throw new Error('Lumberjack configuration not found in WorkerRegistry')
        }

        super(scene, x, y, 'player-idle', config, depositPoint)
        
        this.harvestingState = {
            inProgress: false,
            startTime: 0,
            target: null
        }
        
        this.initializeLumberjack()
    }

    private initializeLumberjack(): void {
        this.inventory.set('wood', 0)
        this.setTint(0xdd9955)
        this.setDepth(1)
        this.setupChoppingAnimations()
    }

    private setupChoppingAnimations(): void {
        // Animation completion handler for chopping
        this.on('animationcomplete', (anim: Phaser.Animations.Animation) => {
            if (anim.key === AnimationType.WORKER_CHOP) {
                console.log('Lumberjack: Chopping animation completed')
                this.animationHandler.idle(AnimationType.WORKER_IDLE)
            }
        })
    }

    protected findNearestResource(): Tree | null {
        const mainScene = this.scene as any
        
        if (!mainScene.trees?.length) {
            return null
        }

        this.cleanupBlacklist()

        const availableTrees = this.getAvailableTrees(mainScene.trees)
        
        if (availableTrees.length === 0) {
            return this.expandSearchRadius(mainScene.trees)
        }

        return this.selectOptimalTree(availableTrees)
    }

    private getAvailableTrees(allTrees: Tree[]): Tree[] {
        const workRadius = this.config.workRadius || 500
        
        return allTrees.filter(tree => {
            const distance = Phaser.Math.Distance.Between(this.x, this.y, tree.x, tree.y)
            const tileKey = this.getTileKey(tree.x, tree.y)
            
            return !this.blacklistedTiles.has(tileKey) &&
                   tree.isAvailableForHarvest(this) &&
                   distance <= workRadius
        })
    }

    private expandSearchRadius(allTrees: Tree[]): Tree | null {
        console.log('Lumberjack: Expanding search radius')
        
        const extendedRadius = (this.config.workRadius || 500) * 1.5
        const extendedTrees = allTrees.filter(tree => {
            const distance = Phaser.Math.Distance.Between(this.x, this.y, tree.x, tree.y)
            const tileKey = this.getTileKey(tree.x, tree.y)
            
            return !this.blacklistedTiles.has(tileKey) &&
                   tree.isAvailableForHarvest(this) &&
                   distance <= extendedRadius
        })

        return extendedTrees.length > 0 ? this.selectOptimalTree(extendedTrees) : null
    }

    private selectOptimalTree(trees: Tree[]): Tree | null {
        // Sort by distance
        trees.sort((a, b) => {
            const distA = Phaser.Math.Distance.Between(this.x, this.y, a.x, a.y)
            const distB = Phaser.Math.Distance.Between(this.x, this.y, b.x, b.y)
            return distA - distB
        })

        // Try the first 3 trees to avoid contention
        const candidateCount = Math.min(3, trees.length)
        
        for (let i = 0; i < candidateCount; i++) {
            const tree = trees[i]
            if (tree.setHarvester(this)) {
                return tree
            }
        }

        return null
    }

    private getTileKey(x: number, y: number): string {
        const tileX = Math.floor(x / 16)
        const tileY = Math.floor(y / 16)
        return `${tileX},${tileY}`
    }

    protected findNearestStorage(): TiledBuilding | null {
        const mainScene = this.scene as any
        const buildings = mainScene.buildingManager?.getBuildings() || []
        
        const sawmills = buildings.filter((building: TiledBuilding) => 
            building.getType() === 'sawmill'
        )

        if (sawmills.length === 0) {
            return null
        }

        return this.findClosestBuilding(sawmills)
    }

    private findClosestBuilding(buildings: TiledBuilding[]): TiledBuilding {
        return buildings.reduce((closest, current) => {
            const closestDist = this.getDistanceToBuilding(closest)
            const currentDist = this.getDistanceToBuilding(current)
            return currentDist < closestDist ? current : closest
        })
    }

    private getDistanceToBuilding(building: TiledBuilding): number {
        const pos = building.getPosition()
        return Phaser.Math.Distance.Between(this.x, this.y, pos.x, pos.y)
    }

    protected harvestResource(): void {
        if (!this.targetResource || this.harvestingState.inProgress) {
            this.setState(WorkerState.IDLE)
            return
        }

        if (this.targetResource.isDestroyed) {
            this.releaseTarget()
            this.setState(WorkerState.IDLE)
            return
        }

        this.startHarvesting()
    }

    private startHarvesting(): void {
        this.harvestingState.inProgress = true
        this.harvestingState.startTime = Date.now()
        this.harvestingState.target = this.targetResource

        this.stopMovement()
        this.orientTowardsTarget()
        this.playHarvestAnimation()

        console.log('Lumberjack: Starting harvest')
        this.performHarvest()
    }

    private stopMovement(): void {
        this.setVelocity(0, 0)
    }

    private orientTowardsTarget(): void {
        if (!this.targetResource) return
        
        const isFacingRight = this.targetResource.x > this.x
        this.setFlipX(!isFacingRight)
    }

    private playHarvestAnimation(): void {
        // Use animation handler to play chopping animation
        this.animationHandler.action(AnimationType.WORKER_CHOP)
    }

    private async performHarvest(): Promise<void> {
        if (!this.targetResource?.workerHarvest) {
            console.error('Lumberjack: workerHarvest method not available')
            this.finishHarvesting(false)
            return
        }

        try {
            const treeDestroyed = await this.targetResource.workerHarvest(this)
            this.handleHarvestResult(treeDestroyed)
        } catch (error) {
            console.error('Lumberjack: Error during harvest:', error)
            this.finishHarvesting(false)
        }
    }

    private handleHarvestResult(treeDestroyed: boolean): void {
        if (treeDestroyed) {
            console.log('Lumberjack: Tree destroyed')
            this.addWoodToInventory()
        }

        const shouldContinue = this.shouldContinueHarvesting(treeDestroyed)
        this.finishHarvesting(shouldContinue)
    }

    private addWoodToInventory(): void {
        const woodPerTree = 3 // Could be configurable or from registry
        const woodAdded = this.addToInventory('wood', woodPerTree)
        console.log(`Lumberjack: ${woodAdded} wood added. Total: ${this.inventory.get('wood')}`)
        this.updateInventoryDisplay()
    }

    private shouldContinueHarvesting(treeDestroyed: boolean): boolean {
        return !this.isInventoryFull() && 
               !treeDestroyed && 
               this.targetResource && 
               !this.targetResource.isDestroyed
    }

    private finishHarvesting(continueHarvesting: boolean): void {
        this.releaseTarget()
        this.harvestingState.inProgress = false
        this.animationHandler.idle(AnimationType.WORKER_IDLE)

        if (continueHarvesting) {
            this.setState(WorkerState.HARVESTING)
            this.scene.time.delayedCall(500, () => {
                this.harvestingState.inProgress = false
            })
        } else {
            this.setState(WorkerState.IDLE)
        }
    }

    private releaseTarget(): void {
        if (this.targetResource && typeof this.targetResource.releaseHarvester === 'function') {
            this.targetResource.releaseHarvester()
        }
        this.targetResource = null
        this.harvestingState.target = null
    }

    protected depositResources(): void {
        console.log('Lumberjack: Starting resource deposit')
        
        const originalTint = this.tintTopLeft
        this.setTint(0xFFFF00) // Yellow during deposit
        
        this.depositTimer = this.scene.time.delayedCall(1000, () => {
            this.restoreOriginalTint(originalTint)
            this.processDeposit()
            this.setState(WorkerState.IDLE)
        })
    }

    private restoreOriginalTint(originalTint: number): void {
        this.setTint(originalTint)
    }

    private processDeposit(): void {
        const woodAmount = this.inventory.get('wood') || 0
        
        if (woodAmount <= 0) {
            return
        }

        if (this.targetStorage?.addResourceToBuilding) {
            this.depositToBuilding(woodAmount)
        } else if (this.isAtDepositPoint()) {
            this.depositToPoint(woodAmount)
        } else {
            console.log('Lumberjack: No valid deposit found')
        }

        this.updateInventoryDisplay()
    }

    private depositToBuilding(woodAmount: number): void {
        console.log('Lumberjack: Depositing to building')
        
        const deposited = this.targetStorage.addResourceToBuilding(GameResourceType.WOOD, woodAmount)
        this.removeFromInventory('wood', deposited)
        
        console.log(`Lumberjack: ${deposited} wood deposited to ${this.targetStorage.getType()}`)
        
        this.updateBuildingInterface()
        this.targetStorage = null
    }

    private depositToPoint(woodAmount: number): void {
        console.log('Lumberjack: Depositing to deposit point')
        
        ;(this.scene as any).events.emit('addWood', woodAmount)
        this.removeFromInventory('wood', woodAmount)
        
        console.log(`Lumberjack: ${woodAmount} wood deposited to deposit point`)
    }

    private isAtDepositPoint(): boolean {
        return this.depositPoint && 
               Math.abs(this.x - this.depositPoint.x) < 30 && 
               Math.abs(this.y - this.depositPoint.y) < 30
    }

    private updateBuildingInterface(): void {
        const buildingUI = this.scene.scene.get('BuildingInfoUI') as any
        if (buildingUI?.updateInterface) {
            buildingUI.updateInterface()
        }
    }

    protected findInteractionPoint(tree: Tree): WorkerPosition {
        if (!tree?.findNearestInteractionPoint) {
            console.warn('Lumberjack: Tree does not have findNearestInteractionPoint method')
            return { x: tree.x, y: tree.y }
        }
        
        return tree.findNearestInteractionPoint(this.x, this.y)
    }

    protected findStoragePoint(storage: TiledBuilding): WorkerPosition {
        const pos = storage.getPosition()
        const dim = storage.getDimensions()

        return {
            x: pos.x + (dim.tilesWidth * 16) / 2, // Center of width
            y: pos.y + dim.tilesHeight * 16 + 16  // Below the building
        }
    }

    protected onStateChanged(from: WorkerState, to: WorkerState): void {
        super.onStateChanged(from, to)
        
        // Cleanup specific to state transitions
        if (from === WorkerState.HARVESTING && to !== WorkerState.HARVESTING) {
            this.cleanupHarvesting()
        }
    }

    private cleanupHarvesting(): void {
        if (this.harvestingState.inProgress) {
            this.releaseTarget()
            this.harvestingState.inProgress = false
        }
        
        this.harvestTimer?.destroy()
        this.harvestTimer = null
    }

    // Performance monitoring
    private isHarvestingStuck(): boolean {
        if (!this.harvestingState.inProgress) return false
        
        const harvestTimeout = 10000 // 10 seconds
        const harvestDuration = Date.now() - this.harvestingState.startTime
        return harvestDuration > harvestTimeout
    }

    private handleStuckState(): void {
        console.log('Lumberjack: Stuck state detected, resetting')
        
        this.cleanupHarvesting()
        this.setState(WorkerState.IDLE)
        this.performanceTracking.lastResetTime = Date.now()
        
        this.animationHandler.idle(AnimationType.WORKER_IDLE)
    }

    // Public API
    public getHarvestingProgress(): number {
        if (!this.harvestingState.inProgress) return 0
        
        const elapsed = Date.now() - this.harvestingState.startTime
        return Math.min(elapsed / this.config.harvestSpeed, 1)
    }

    public isCurrentlyHarvesting(): boolean {
        return this.harvestingState.inProgress
    }

    public getCurrentTarget(): Tree | null {
        return this.harvestingState.target
    }

    public getWorkRadius(): number {
        return this.config.workRadius || 500
    }

    public getEfficiencyMetrics(): { 
        readonly woodPerMinute: number
        readonly utilizationRate: number 
    } {
        const stats = this.getStats()
        const timeWorkedMinutes = stats.timeWorked / 60000 // Convert to minutes
        
        return {
            woodPerMinute: timeWorkedMinutes > 0 ? stats.totalHarvested / timeWorkedMinutes : 0,
            utilizationRate: stats.efficiency
        }
    }

    update(): void {
        // Check for stuck states
        if (this.isHarvestingStuck()) {
            this.handleStuckState()
            return
        }

        // Force idle action trigger if necessary
        if (this.shouldTriggerIdleAction()) {
            this.triggerIdleAction()
        } else if (this.state !== WorkerState.IDLE) {
            this.performanceTracking.idleActionTriggered = false
        }

        // Check if a tree is being harvested
        if (this.state === WorkerState.HARVESTING && !this.harvestingState.inProgress) {
            this.harvestResource()
        }

        // Call parent update
        super.update()
    }

    private shouldTriggerIdleAction(): boolean {
        const timeSinceLastReset = Date.now() - this.performanceTracking.lastResetTime
        return this.state === WorkerState.IDLE && 
               !this.performanceTracking.idleActionTriggered &&
               timeSinceLastReset > 1000 // At least 1 second delay
    }

    private triggerIdleAction(): void {
        console.log('Lumberjack: Forcing idle action trigger')
        this.updateIdle()
        this.performanceTracking.idleActionTriggered = true

        // Reset the flag after a delay
        this.scene.time.delayedCall(1000, () => {
            this.performanceTracking.idleActionTriggered = false
        })
    }

    // Cleanup
    destroy(fromScene?: boolean): void {
        this.cleanupHarvesting()
        this.depositTimer?.destroy()
        
        super.destroy(fromScene)
    }
}