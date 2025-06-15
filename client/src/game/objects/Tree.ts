import { Scene } from 'phaser'
import { AnimationType } from '../services/AnimationRegistry'
import { AnimationUtils } from '../utils/AnimationUtils'
import type { Player } from './Player'

interface TreeConfig {
    respawnTime?: number
    woodValue?: number
    maxHealth?: number
    damagePerHit?: number
}

interface TreePosition {
    x: number
    y: number
}

export class Tree extends Phaser.Physics.Arcade.Sprite {
    public isDestroyed: boolean = false

    // Configuration
    private readonly config: Required<TreeConfig>
    private readonly tileObject: any
    private readonly initialPosition: TreePosition

    // State
    private currentHealth: number
    private isBeingHit: boolean = false
    private currentHarvester: any = null

    // Animation handling
    private animationHandler: ReturnType<typeof AnimationUtils.createAnimationHandler>

    // Phaser references
    private player?: Player
    private detectionZone?: Phaser.GameObjects.Zone
    private stump?: Phaser.GameObjects.Sprite
    private healthBar?: Phaser.GameObjects.Sprite

    // Timers
    private healingTimer?: Phaser.Time.TimerEvent

    // Particles
    private readonly leavesParticles: Phaser.GameObjects.Sprite[] = []

    constructor(scene: Scene, x: number, y: number, tileObject: any) {
        super(scene, x, y, 'tree')

        this.initialPosition = { x, y }
        this.tileObject = tileObject

        // Default configuration
        this.config = {
            respawnTime: 60000,
            woodValue: 3,
            maxHealth: 100,
            damagePerHit: 25
        }

        this.currentHealth = this.config.maxHealth

        this.initializeTree()
    }

    private initializeTree(): void {
        this.setInteractive()
        this.setupCursorEvents()

        this.scene.add.existing(this)
        this.scene.physics.add.existing(this, true)

        this.createDetectionZone()
        this.setupAnimations()
        this.createStump()
        this.createHealthBar()
        this.setupLeavesAnimations()

        this.animationHandler.idle(AnimationType.TREE_IDLE)
        this.setDepth(10)
    }

    private createDetectionZone(): void {
        this.detectionZone = this.scene.add.zone(this.x, this.y, 31, 32)
        this.scene.physics.add.existing(this.detectionZone, true)
    }

    private setupAnimations(): void {
        // Initialize tree and effects animations using the registry
        AnimationUtils.initializeEntityAnimations(this, 'tree')
        AnimationUtils.preloadSceneAnimations(this.scene, ['effects'])
        
        // Create animation handler for this sprite
        this.animationHandler = AnimationUtils.createAnimationHandler(this)
    }

    private setupLeavesAnimations(): void {
        // Leaves animations are handled by the registry now
        // No need to create them manually
    }

    private createStump(): void {
        this.stump = this.scene.add.sprite(this.x, this.y, 'tree', 5).setVisible(false)
    }

    private createHealthBar(): void {
        this.healthBar = this.scene.add.sprite(this.x, this.y - 20, 'health-bar')
            .setVisible(false)
            .setDepth(1000)
    }

    private setupCursorEvents(): void {
        this.on('pointerover', this.handlePointerOver.bind(this))
        this.on('pointerout', this.handlePointerOut.bind(this))
        this.on('pointerdown', this.handlePointerDown.bind(this))
    }

    private handlePointerOver(): void {
        if (!this.isDestroyed && this.scene.uiScene) {
            this.scene.uiScene.defaultCursor.setVisible(false)
            this.scene.uiScene.hoverCursor.setVisible(true)
        }
    }

    private handlePointerOut(): void {
        if (this.scene.uiScene) {
            this.scene.uiScene.defaultCursor.setVisible(true)
            this.scene.uiScene.hoverCursor.setVisible(false)
        }
    }

    private handlePointerDown(): void {
        if (!this.isDestroyed && !this.isBeingHit && this.player) {
            this.startChoppingSequence(this.player)
        }
    }

    public setupPlayerCollision(player: Player): void {
        this.player = player
        if (this.detectionZone) {
            this.scene.physics.add.overlap(
                player,
                this.detectionZone,
                this.handlePlayerOverlap.bind(this),
                undefined,
                this
            )
        }
    }

    private handlePlayerOverlap(): void {
        if (!this.isDestroyed && !this.isBeingHit) {
            this.updateCursorBasedOnFacing()
        }
    }

    private updateCursorBasedOnFacing(): void {
        if (!this.player || !this.scene.uiScene) return

        const isFacingTree = this.player.isFacingObject(this.x, this.y)
        const mousePointer = this.scene.input.mousePointer
        const worldPoint = this.scene.cameras.main.getWorldPoint(mousePointer.x, mousePointer.y)
        const bounds = this.getBounds()

        if (isFacingTree && bounds.contains(worldPoint.x, worldPoint.y)) {
            this.scene.uiScene.defaultCursor.setVisible(false)
            this.scene.uiScene.hoverCursor.setVisible(true)
        } else {
            this.scene.uiScene.defaultCursor.setVisible(true)
            this.scene.uiScene.hoverCursor.setVisible(false)
        }
    }

    public startChoppingSequence(player: Player, isWorker: boolean = false): void {
        if (this.isBeingHit || this.isDestroyed) return

        if (isWorker) {
            this.startAutoHitSequence(true).catch(console.error)
        } else {
            this.startPlayerChoppingSequence(player)
        }
    }

    private startPlayerChoppingSequence(player: Player): void {
        const interactionPoint = this.findNearestInteractionPoint(player.x, player.y)
        const mainScene = this.scene as any

        const playerTilePos = this.worldToTile(player.x, player.y)
        const targetTilePos = this.worldToTile(interactionPoint.x, interactionPoint.y)

        mainScene.easyStar.findPath(
            playerTilePos.x, playerTilePos.y,
            targetTilePos.x, targetTilePos.y,
            (path: { x: number; y: number }[] | null) => {
                if (!path) {
                    console.log('Impossible to reach tree')
                    return
                }

                player.setPath(path)
                this.waitForPlayerArrival(player, interactionPoint)
            }
        )

        mainScene.easyStar.calculate()
    }

    private worldToTile(x: number, y: number): TreePosition {
        return {
            x: Math.floor(x / 16),
            y: Math.floor(y / 16)
        }
    }

    private waitForPlayerArrival(player: Player, interactionPoint: TreePosition): void {
        const mainScene = this.scene as any
        let stableCount = 0
        let lastPosition = { x: player.x, y: player.y }

        const checkInterval = mainScene.time.addEvent({
            delay: 100,
            callback: () => {
                const distance = Phaser.Math.Distance.Between(
                    player.x, player.y,
                    interactionPoint.x, interactionPoint.y
                )

                const hasNotMoved = lastPosition.x === player.x && lastPosition.y === player.y
                lastPosition = { x: player.x, y: player.y }

                if (distance < 20 && hasNotMoved) {
                    stableCount++
                    if (stableCount >= 1) {
                        checkInterval.destroy()
                        if (!this.isDestroyed) {
                            player.setFlipX(this.x <= player.x)
                            this.startAutoHitSequence().catch(console.error)
                        }
                    }
                } else {
                    stableCount = 0
                }
            },
            loop: true
        })
    }

    private async startAutoHitSequence(isWorker: boolean = false): Promise<void> {
        if (!isWorker && this.isBeingHit) return

        this.isBeingHit = true
        this.setDepth(0)

        let isSequenceCancelled = false

        while (this.currentHealth > 0 && !this.isDestroyed && !isSequenceCancelled) {
            if (!isWorker && this.isPlayerMoving()) {
                this.stopAutoHit()
                isSequenceCancelled = true
                break
            }

            this.currentHealth -= this.config.damagePerHit
            await this.performHit(isWorker)

            if (this.currentHealth <= 0) break
        }

        if (!isSequenceCancelled && this.currentHealth <= 0) {
            this.destroyTree(isWorker)
        }

        this.isBeingHit = false
    }

    private isPlayerMoving(): boolean {
        return !!(this.player && (
            this.player.cursors.left.isDown ||
            this.player.cursors.right.isDown ||
            this.player.cursors.up.isDown ||
            this.player.cursors.down.isDown
        ))
    }

    private async performHit(isWorker: boolean = false): Promise<void> {
        if (!isWorker && this.player) {
            this.player.playChopAnimation(() => {
                this.updateHealthBar(true)
                this.spawnLeaves()
            })
        } else {
            this.updateHealthBar(true)
            this.spawnLeaves()
            if (this.currentHarvester) {
                this.scene.events.emit('worker_chopping', this.currentHarvester)
            }
        }

        // Use animation handler for tree hit animation
        await this.animationHandler.action(AnimationType.TREE_HIT)

        if (!isWorker && this.player) {
            // Wait for player animation to complete
            await this.waitForPlayerAnimation()
        } else {
            await this.delay(500)
        }
    }

    private destroyTree(isWorker: boolean): void {
        // Use animation handler for destroy animation
        this.animationHandler.action(AnimationType.TREE_DESTROY)

        if (!isWorker) {
            this.scene.events.emit('addWood', this.config.woodValue)

            window.dispatchEvent(new CustomEvent('game:woodHarvested', {
                detail: { amount: this.config.woodValue }
            }))
        }

        this.isDestroyed = true
        this.cleanup()
    }

    private stopAutoHit(): void {
        this.isBeingHit = false
        if (this.player) {
            this.player.stopChopAnimation()
            this.animationHandler.idle(AnimationType.TREE_IDLE)
        }
        this.startHealingTimer()
    }

    private updateHealthBar(forceShow: boolean = false): void {
        if (!this.healthBar) return

        const healthPercent = this.currentHealth / this.config.maxHealth
        const frame = Math.floor(healthPercent * 6)

        this.healthBar.setFrame(frame)
        this.healthBar.setPosition(this.x, this.y - 20)
        this.healthBar.setVisible(forceShow || this.currentHealth < this.config.maxHealth)
    }

    private spawnLeaves(): void {
        // Create leaves sprite and animate using the registry
        const leaf = this.scene.add.sprite(this.x, this.y, 'leaves-hit')
            .setDepth(this.depth + 1)

        // Use animation utils to play the leaves fall animation
        AnimationUtils.playAnimation(leaf, AnimationType.LEAVES_FALL)

        this.scene.tweens.add({
            targets: leaf,
            y: leaf.y - 5,
            duration: 1000,
            ease: 'Power1',
            onComplete: () => {
                leaf.destroy()
                const index = this.leavesParticles.indexOf(leaf)
                if (index > -1) {
                    this.leavesParticles.splice(index, 1)
                }
            }
        })

        this.leavesParticles.push(leaf)
    }

    private startHealingTimer(): void {
        this.healingTimer?.destroy()
        this.healingTimer = this.scene.time.delayedCall(10000, () => {
            this.currentHealth = this.config.maxHealth
            this.updateHealthBar()
        })
    }

    private cleanup(): void {
        this.setVisible(false)
        this.stump?.setVisible(true)

        if (this.currentHarvester) {
            this.releaseHarvester()
        }

        this.healthBar?.setVisible(false)

        if ((this.scene as any).rebuildPathfindingGrid) {
            (this.scene as any).rebuildPathfindingGrid()
        }

        this.scene.time.delayedCall(this.config.respawnTime, () => this.respawn(), [], this)
    }

    private respawn(): void {
        this.stump?.setVisible(false)

        this.isDestroyed = false
        this.isBeingHit = false
        this.setVisible(true)
        this.animationHandler.idle(AnimationType.TREE_IDLE)
        this.setDepth(10)

        this.currentHealth = this.config.maxHealth
        this.updateHealthBar()

        if ((this.scene as any).rebuildPathfindingGrid) {
            (this.scene as any).rebuildPathfindingGrid()
        }
    }

    private async waitForPlayerAnimation(): Promise<void> {
        return new Promise((resolve) => {
            if (this.player) {
                this.player.once('animationcomplete', () => resolve())
            } else {
                resolve()
            }
        })
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => {
            this.scene.time.delayedCall(ms, resolve)
        })
    }

    // Public API methods for harvesting
    public isAvailableForHarvest(harvester: any): boolean {
        return !this.isDestroyed && !this.isBeingHit &&
            (this.currentHarvester === null || this.currentHarvester === harvester)
    }

    public setHarvester(harvester: any): boolean {
        if (this.isAvailableForHarvest(harvester)) {
            this.currentHarvester = harvester
            return true
        }
        return false
    }

    public releaseHarvester(): void {
        this.currentHarvester = null
    }

    public findNearestInteractionPoint(workerX: number, workerY: number): TreePosition {
        const tileSize = 16
        const treeTileX = Math.floor(this.x / tileSize)
        const treeTileY = Math.floor(this.y / tileSize)

        const positions = [
            { x: (treeTileX - 1) * tileSize, y: treeTileY * tileSize },
            { x: (treeTileX + 1) * tileSize, y: treeTileY * tileSize }
        ]

        return positions.reduce((closest, current) => {
            const currentDist = Phaser.Math.Distance.Between(workerX, workerY, current.x, current.y)
            const closestDist = Phaser.Math.Distance.Between(workerX, workerY, closest.x, closest.y)
            return currentDist < closestDist ? current : closest
        })
    }

    public async workerHarvest(worker: any): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.isDestroyed || this.isBeingHit || this.currentHarvester !== worker) {
                resolve(false)
                return
            }

            this.currentHealth -= this.config.damagePerHit
            this.updateHealthBar(true)
            this.spawnLeaves()
            
            // Use animation handler for tree hit
            this.animationHandler.action(AnimationType.TREE_HIT).then(() => {
                if (this.currentHealth <= 0 && !this.isDestroyed) {
                    this.animationHandler.action(AnimationType.TREE_DESTROY)
                    this.isDestroyed = true
                    this.cleanup()
                    resolve(true)
                } else {
                    resolve(false)
                }
            })

            // Fallback timeout
            this.scene.time.delayedCall(2000, () => {
                if (!this.isDestroyed && this.currentHealth <= 0) {
                    this.animationHandler.action(AnimationType.TREE_DESTROY)
                    this.isDestroyed = true
                    this.cleanup()
                    resolve(true)
                } else if (!this.isDestroyed) {
                    resolve(false)
                }
            })
        })
    }

    // Configuration setters with validation
    public setRespawnTime(time: number): void {
        if (time > 0) {
            this.config.respawnTime = time
        }
    }

    public setWoodValue(value: number): void {
        if (value > 0) {
            this.config.woodValue = value
        }
    }

    public setMaxHealth(health: number): void {
        if (health > 0) {
            this.config.maxHealth = health
            this.currentHealth = health
            this.updateHealthBar()
        }
    }

    public setDamagePerHit(damage: number): void {
        if (damage > 0) {
            this.config.damagePerHit = damage
        }
    }

    // Utility methods
    public getTreeTilePosition(): TreePosition {
        return this.worldToTile(this.x, this.y)
    }

    public isBlockingPath(): boolean {
        return true // Trees and stumps always block the path
    }

    public isTreeDestroyed(): boolean {
        return this.isDestroyed
    }

    destroy(fromScene?: boolean): void {
        this.leavesParticles.forEach(leaf => leaf.destroy())
        this.leavesParticles.length = 0

        this.healthBar?.destroy()
        this.detectionZone?.destroy()
        this.stump?.destroy()
        this.healingTimer?.destroy()

        super.destroy(fromScene)
    }

    update(): void {
        if (this.isDestroyed || !this.player || !this.detectionZone) return

        const isOverlapping = this.scene.physics.overlap(this.player, this.detectionZone)

        if (isOverlapping) {
            this.updateCursorBasedOnFacing()
        } else if (this.isBeingHit) {
            this.stopAutoHit()
        }
    }
}