import { AnimationRegistry, AnimationType, type AnimationFrameConfig } from '../services/AnimationRegistry'

/**
 * Utility class for common animation operations
 */
export class AnimationUtils {
  private static registry = AnimationRegistry.getInstance()

  /**
   * Initialize animations for a sprite-based entity
   */
  public static initializeEntityAnimations(
    sprite: Phaser.GameObjects.Sprite,
    entityType: 'player' | 'worker' | 'tree' | 'effects'
  ): void {
    const animationTypes = this.registry.getAnimationsForEntityType(entityType)
    const scene = sprite.scene

    // Register animations if not already done
    this.registry.registerAnimationsForScene(scene, animationTypes)

    // Validate textures
    const validation = this.registry.validateTextures(scene)
    if (!validation.isValid) {
      console.warn(`Missing textures for ${entityType}:`, validation.missingTextures)
    }
  }

  /**
   * Play an animation with promise-based completion
   */
  public static async playAnimation(
    sprite: Phaser.GameObjects.Sprite,
    type: AnimationType,
    options?: AnimationFrameConfig
  ): Promise<void> {
    return this.registry.playAnimation(sprite, type, options)
  }

  /**
   * Play animation with hit frame callback (useful for actions)
   */
  public static async playActionAnimation(
    sprite: Phaser.GameObjects.Sprite,
    type: AnimationType,
    hitFrame: number,
    onHit: () => void
  ): Promise<void> {
    return this.registry.playAnimation(sprite, type, {
      hitFrame,
      onHitFrame: onHit
    })
  }

  /**
   * Transition between animations smoothly
   */
  public static transitionAnimation(
    sprite: Phaser.GameObjects.Sprite,
    fromType: AnimationType,
    toType: AnimationType,
    immediate: boolean = false
  ): void {
    if (immediate) {
      this.registry.stopAnimation(sprite, toType)
    } else {
      // Check if current animation should complete first
      const currentAnim = sprite.anims.currentAnim
      if (currentAnim && !this.registry.isLoopingAnimation(fromType)) {
        sprite.once('animationcomplete', () => {
          sprite.play(toType, true)
        })
      } else {
        sprite.play(toType, true)
      }
    }
  }

  /**
   * Handle movement animation with direction
   */
  public static handleMovementAnimation(
    sprite: Phaser.GameObjects.Sprite,
    velocityX: number,
    velocityY: number,
    idleType: AnimationType,
    walkType: AnimationType
  ): void {
    const isMoving = Math.abs(velocityX) > 0 || Math.abs(velocityY) > 0

    if (isMoving) {
      if (!sprite.anims.isPlaying || sprite.anims.currentAnim?.key !== walkType) {
        sprite.play(walkType, true)
      }
      // Handle sprite direction
      if (velocityX !== 0) {
        sprite.setFlipX(velocityX < 0)
      }
    } else {
      if (!sprite.anims.isPlaying || sprite.anims.currentAnim?.key !== idleType) {
        sprite.play(idleType, true)
      }
    }
  }

  /**
   * Check if sprite is currently playing a specific animation
   */
  public static isPlayingAnimation(sprite: Phaser.GameObjects.Sprite, type: AnimationType): boolean {
    return sprite.anims.isPlaying && sprite.anims.currentAnim?.key === type
  }

  /**
   * Get the progress of current animation (0-1)
   */
  public static getAnimationProgress(sprite: Phaser.GameObjects.Sprite): number {
    if (!sprite.anims.isPlaying || !sprite.anims.currentAnim) {
      return 0
    }

    const currentFrame = sprite.anims.currentFrame?.index || 0
    const totalFrames = sprite.anims.currentAnim.frames.length
    
    return totalFrames > 0 ? currentFrame / totalFrames : 0
  }

  /**
   * Create a reusable animation handler for entities
   */
  public static createAnimationHandler(sprite: Phaser.GameObjects.Sprite) {
    return {
      idle: (type: AnimationType) => {
        if (!this.isPlayingAnimation(sprite, type)) {
          sprite.play(type, true)
        }
      },

      action: async (type: AnimationType, hitFrame?: number, onHit?: () => void) => {
        if (hitFrame !== undefined && onHit) {
          return this.playActionAnimation(sprite, type, hitFrame, onHit)
        }
        return this.playAnimation(sprite, type)
      },

      movement: (velocityX: number, velocityY: number, idleType: AnimationType, walkType: AnimationType) => {
        this.handleMovementAnimation(sprite, velocityX, velocityY, idleType, walkType)
      },

      stop: (fallbackType?: AnimationType) => {
        this.registry.stopAnimation(sprite, fallbackType)
      },

      transition: (fromType: AnimationType, toType: AnimationType, immediate?: boolean) => {
        this.transitionAnimation(sprite, fromType, toType, immediate)
      },

      isPlaying: (type: AnimationType) => {
        return this.isPlayingAnimation(sprite, type)
      },

      getProgress: () => {
        return this.getAnimationProgress(sprite)
      }
    }
  }

  /**
   * Batch register animations for multiple scenes
   */
  public static registerAnimationsForScenes(scenes: Phaser.Scene[], animationTypes?: AnimationType[]): void {
    scenes.forEach(scene => {
      this.registry.registerAnimationsForScene(scene, animationTypes)
    })
  }

  /**
   * Get animation timing information
   */
  public static getAnimationTiming(type: AnimationType): {
    duration: number
    isLooping: boolean
    frameCount: number
  } {
    const config = this.registry.getAnimationConfig(type)
    const duration = this.registry.getAnimationDuration(type)
    const isLooping = this.registry.isLoopingAnimation(type)
    
    return {
      duration,
      isLooping,
      frameCount: config ? (config.frames.end - config.frames.start + 1) : 0
    }
  }

  /**
   * Debug helper to log animation stats
   */
  public static logAnimationStats(): void {
    const stats = this.registry.getAnimationStats()
  }

  /**
   * Preload all animations for a scene based on entity types present
   */
  public static preloadSceneAnimations(
    scene: Phaser.Scene, 
    entityTypes: Array<'player' | 'worker' | 'tree' | 'effects'>
  ): void {
    const allAnimations = new Set<AnimationType>()
    
    entityTypes.forEach(entityType => {
      const animations = this.registry.getAnimationsForEntityType(entityType)
      animations.forEach(anim => allAnimations.add(anim))
    })

    this.registry.registerAnimationsForScene(scene, Array.from(allAnimations))
  }
}