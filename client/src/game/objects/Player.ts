import { Scene } from 'phaser'
type Scene = typeof Scene;

import { AnimationType } from '../services/AnimationRegistry'
import { AnimationUtils } from '../utils/AnimationUtils'

interface PlayerConfig {
    moveSpeed: number
    bodyWidth: number
    bodyHeight: number
}

interface Position {
    x: number
    y: number
}

interface PathNode {
    x: number
    y: number
}

export class Player extends Phaser.Physics.Arcade.Sprite {
    public readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys
    
    private readonly config: PlayerConfig = {
        moveSpeed: 80,
        bodyWidth: 12,
        bodyHeight: 6
    }

    private isChopping: boolean = false
    private path: PathNode[] = []
    private currentTargetIndex: number = 0
    private animationHandler: ReturnType<typeof AnimationUtils.createAnimationHandler>

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'player-idle')

        this.cursors = scene.input.keyboard.createCursorKeys()
        
        this.initializePlayer()
        this.setupAnimations()
        this.animationHandler.idle(AnimationType.PLAYER_IDLE)
    }

    private initializePlayer(): void {
        this.scene.add.existing(this)
        this.scene.physics.add.existing(this)
        
        this.setCollideWorldBounds(true)
        this.setupHitbox()
    }

    private setupHitbox(): void {
        const { bodyWidth, bodyHeight } = this.config

        const offsetX = (96 - bodyWidth) / 2
        const offsetY = (64 - bodyHeight) / 1.8

        if(this.body) {
            this.body.setSize(bodyWidth, bodyHeight)
            this.body.setOffset(offsetX, offsetY)
        }
    }

    private setupAnimations(): void {
        AnimationUtils.initializeEntityAnimations(this, 'player')

        this.animationHandler = AnimationUtils.createAnimationHandler(this)
    }

    public setPath(path: PathNode[]): void {
        if (path.length > 0) {
            const firstTile = path[0]
            const currentTile = this.getCurrentTilePosition()
            
            if (firstTile.x === currentTile.x && firstTile.y === currentTile.y) {
                path.shift()
            }
        }

        this.path = [...path]
        this.currentTargetIndex = 0
    }

    private getCurrentTilePosition(): Position {
        return {
            x: Math.floor(this.x / 16),
            y: Math.floor(this.y / 16)
        }
    }

    public stopChopAnimation(): void {
        if (!this.isChopping) return

        this.isChopping = false
        this.animationHandler.stop(AnimationType.PLAYER_IDLE)
    }

    public async playChopAnimation(onHitFrame?: () => void): Promise<void> {
        if (this.isChopping) return

        this.isChopping = true
        
        try {
            if (onHitFrame) {
                await this.animationHandler.action(AnimationType.PLAYER_CHOP, 7, onHitFrame)
            } else {
                await this.animationHandler.action(AnimationType.PLAYER_CHOP)
            }
        } finally {
            this.finishChopAnimation()
        }
    }

    private finishChopAnimation(): void {
        this.isChopping = false
        this.animationHandler.idle(AnimationType.PLAYER_IDLE)
    }

    public isFacingObject(objectX: number, objectY: number): boolean {
        const dx = objectX - this.x
        const dy = objectY - this.y
        const absDx = Math.abs(dx)
        const absDy = Math.abs(dy)
        const isFlippedX = this.flipX

        if (absDx > absDy) {
            return (dx > 0 && !isFlippedX) || (dx < 0 && isFlippedX)
        } else {
            return true
        }
    }

    public isInteracting(): boolean {
        return this.isChopping
    }

    private updatePathMovement(): void {
        if (this.path.length === 0 || this.currentTargetIndex >= this.path.length) {
            this.stopMovement()
            return
        }

        const targetTile = this.path[this.currentTargetIndex]
        const targetWorldPos = this.tileToWorldPosition(targetTile)
        
        const distance = Phaser.Math.Distance.Between(
            this.x, this.y,
            targetWorldPos.x, targetWorldPos.y
        )

        if (distance < 2) {
            this.moveToNextPathNode()
        } else {
            this.moveTowardsTarget(targetWorldPos)
        }
    }

    private tileToWorldPosition(tile: PathNode): Position {
        return {
            x: tile.x * 16 + 8,
            y: tile.y * 16 + 8
        }
    }

    private moveToNextPathNode(): void {
        this.currentTargetIndex++
        
        if (this.currentTargetIndex >= this.path.length) {
            this.path = []
            this.stopMovement()
        }
    }

    private moveTowardsTarget(target: Position): void {
        const dx = target.x - this.x
        const dy = target.y - this.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance > 0) {
            const velocityX = (dx / distance) * this.config.moveSpeed
            const velocityY = (dy / distance) * this.config.moveSpeed
            
            this.setVelocity(velocityX, velocityY)
            this.updateMovementAnimation(velocityX, velocityY)
        }
    }

    private updateMovementAnimation(velocityX: number, velocityY: number): void {
        // Use the animation handler to manage movement animations
        this.animationHandler.movement(
            velocityX, 
            velocityY,
            AnimationType.PLAYER_IDLE,
            AnimationType.PLAYER_WALK
        )
    }

    private stopMovement(): void {
        this.setVelocity(0, 0)
        this.animationHandler.idle(AnimationType.PLAYER_IDLE)
    }

    update(): void {
        if (this.isChopping) return
        this.updatePathMovement()
    }
}