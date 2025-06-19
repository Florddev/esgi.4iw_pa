import { Scene } from 'phaser'

export enum AnimationType {
  // Player animations
  PLAYER_IDLE = 'player-idle',
  PLAYER_WALK = 'player-walk',
  PLAYER_CHOP = 'player-chop',
  
  // Worker animations
  WORKER_IDLE = 'worker-idle',
  WORKER_WALK = 'worker-walk',
  WORKER_CHOP = 'worker-chop',
  
  // Tree animations
  TREE_IDLE = 'tree-idle',
  TREE_HIT = 'tree-hit',
  TREE_DESTROY = 'tree-destroy',

  // Coal Vein animation
  COAL_VEIN_IDLE = 'coal-vein-idle',
  
  // Effects animations
  LEAVES_FALL = 'leaves-fall'
}

export interface AnimationConfig {
  readonly key: AnimationType
  readonly texture: string
  readonly frames: {
    readonly start: number
    readonly end: number
  }
  readonly frameRate: number
  readonly repeat: number
  readonly description?: string
}

export interface AnimationFrameConfig {
  readonly hitFrame?: number
  readonly onHitFrame?: () => void
  readonly onComplete?: () => void
}

interface AnimationState {
  readonly config: AnimationConfig
  readonly isRegistered: boolean
  readonly usageCount: number
}

export class AnimationRegistry {
  private static instance: AnimationRegistry
  private readonly animations = new Map<AnimationType, AnimationConfig>()
  private readonly registrationState = new Map<AnimationType, AnimationState>()
  private readonly sceneAnimations = new Map<Scene, Set<AnimationType>>()
  
  private constructor() {
    this.initializeAnimations()
  }

  public static getInstance(): AnimationRegistry {
    if (!AnimationRegistry.instance) {
      AnimationRegistry.instance = new AnimationRegistry()
    }
    return AnimationRegistry.instance
  }

  private initializeAnimations(): void {
    const animationConfigs: AnimationConfig[] = [
      // Player animations
      {
        key: AnimationType.PLAYER_IDLE,
        texture: 'player-idle',
        frames: { start: 0, end: 8 },
        frameRate: 10,
        repeat: -1,
        description: 'Player idle animation'
      },
      {
        key: AnimationType.PLAYER_WALK,
        texture: 'player-walk',
        frames: { start: 0, end: 7 },
        frameRate: 12,
        repeat: -1,
        description: 'Player walking animation'
      },
      {
        key: AnimationType.PLAYER_CHOP,
        texture: 'player-chop',
        frames: { start: 0, end: 7 },
        frameRate: 16,
        repeat: 0,
        description: 'Player chopping animation'
      },

      // Worker animations
      {
        key: AnimationType.WORKER_IDLE,
        texture: 'player-idle',
        frames: { start: 0, end: 8 },
        frameRate: 8,
        repeat: -1,
        description: 'Worker idle animation'
      },
      {
        key: AnimationType.WORKER_WALK,
        texture: 'player-walk',
        frames: { start: 0, end: 7 },
        frameRate: 12,
        repeat: -1,
        description: 'Worker walking animation'
      },
      {
        key: AnimationType.WORKER_CHOP,
        texture: 'player-chop',
        frames: { start: 0, end: 7 },
        frameRate: 20,
        repeat: 0,
        description: 'Worker chopping animation'
      },

      // Tree animations
      {
        key: AnimationType.TREE_IDLE,
        texture: 'tree',
        frames: { start: 1, end: 4 },
        frameRate: 6,
        repeat: -1,
        description: 'Tree idle swaying animation'
      },
      {
        key: AnimationType.TREE_HIT,
        texture: 'tree',
        frames: { start: 1, end: 4 },
        frameRate: 10,
        repeat: 0,
        description: 'Tree being hit animation'
      },
      {
        key: AnimationType.TREE_DESTROY,
        texture: 'tree',
        frames: { start: 5, end: 5 },
        frameRate: 10,
        repeat: 0,
        description: 'Tree destruction animation'
      },

      // Coal animations
      {
        key: AnimationType.COAL_VEIN_IDLE,
        texture: 'coal_vein',
        frames: { start: 1, end: 1 },
        frameRate: 6,
        repeat: -1,
        description: 'Coal vien idle swaying animation'
      },

      // Effects animations
      {
        key: AnimationType.LEAVES_FALL,
        texture: 'leaves-hit',
        frames: { start: 0, end: 9 },
        frameRate: 12,
        repeat: 0,
        description: 'Falling leaves effect animation'
      }
    ]

    animationConfigs.forEach(config => {
      this.animations.set(config.key, config)
      this.registrationState.set(config.key, {
        config,
        isRegistered: false,
        usageCount: 0
      })
    })
  }

  /**
   * Register animations for a specific scene
   */
  public registerAnimationsForScene(scene: Scene, animationTypes?: AnimationType[]): void {
    const typesToRegister = animationTypes || Array.from(this.animations.keys())
    
    if (!this.sceneAnimations.has(scene)) {
      this.sceneAnimations.set(scene, new Set())
    }

    const sceneAnimations = this.sceneAnimations.get(scene)!

    typesToRegister.forEach(type => {
      const config = this.animations.get(type)
      
      if (!config) {
        console.warn(`Animation ${type} not found in registry`)
        return
      }

      // Only register if not already registered in this scene
      if (!scene.anims.exists(type)) {
        try {
          scene.anims.create({
            key: type,
            frames: scene.anims.generateFrameNumbers(config.texture, config.frames),
            frameRate: config.frameRate,
            repeat: config.repeat
          })

          sceneAnimations.add(type)
          
          // Update registration state
          const state = this.registrationState.get(type)!
          this.registrationState.set(type, {
            ...state,
            isRegistered: true,
            usageCount: state.usageCount + 1
          })

          console.log(`Animation ${type} registered for scene`)
        } catch (error) {
          console.error(`Failed to register animation ${type}:`, error)
        }
      }
    })
  }

  /**
   * Get animation configuration
   */
  public getAnimationConfig(type: AnimationType): AnimationConfig | undefined {
    return this.animations.get(type)
  }

  /**
   * Get all available animation types
   */
  public getAvailableAnimations(): readonly AnimationType[] {
    return Array.from(this.animations.keys())
  }

  /**
   * Check if animation is registered in scene
   */
  public isAnimationRegistered(scene: Scene, type: AnimationType): boolean {
    return scene.anims.exists(type)
  }

  /**
   * Play animation on sprite with advanced options
   */
  public playAnimation(
    sprite: Phaser.GameObjects.Sprite, 
    type: AnimationType, 
    options: AnimationFrameConfig = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!sprite.scene.anims.exists(type)) {
        console.error(`Animation ${type} not registered in scene`)
        reject(new Error(`Animation ${type} not found`))
        return
      }

      const config = this.animations.get(type)
      if (!config) {
        reject(new Error(`Animation configuration for ${type} not found`))
        return
      }

      // Set up frame callbacks if specified
      if (options.hitFrame !== undefined && options.onHitFrame) {
        const handleFrameUpdate = (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
          if (frame.index === options.hitFrame && options.onHitFrame) {
            options.onHitFrame()
          }
        }

        sprite.on('animationupdate', handleFrameUpdate)
        
        sprite.once('animationcomplete', () => {
          sprite.off('animationupdate', handleFrameUpdate)
        })
      }

      // Set up completion callback
      const handleComplete = () => {
        if (options.onComplete) {
          options.onComplete()
        }
        resolve()
      }

      if (config.repeat === 0) {
        sprite.once('animationcomplete', handleComplete)
      } else {
        // For looping animations, resolve immediately
        resolve()
      }

      // Play the animation
      sprite.play(type, true)
    })
  }

  /**
   * Stop animation and optionally play another
   */
  public stopAnimation(sprite: Phaser.GameObjects.Sprite, fallbackType?: AnimationType): void {
    sprite.anims.stop()

    if (fallbackType && sprite.scene.anims.exists(fallbackType)) {
      sprite.play(fallbackType, true)
    }
  }

  /**
   * Get animation statistics
   */
  public getAnimationStats(): {
    readonly totalAnimations: number
    readonly registeredAnimations: number
    readonly animationsByTexture: Record<string, number>
    readonly usageStats: Array<{ type: AnimationType; usageCount: number }>
  } {
    const animationsByTexture: Record<string, number> = {}
    const usageStats: Array<{ type: AnimationType; usageCount: number }> = []
    
    let registeredCount = 0

    for (const [type, state] of this.registrationState) {
      if (state.isRegistered) {
        registeredCount++
      }

      const texture = state.config.texture
      animationsByTexture[texture] = (animationsByTexture[texture] || 0) + 1
      
      usageStats.push({
        type,
        usageCount: state.usageCount
      })
    }

    return {
      totalAnimations: this.animations.size,
      registeredAnimations: registeredCount,
      animationsByTexture,
      usageStats: usageStats.sort((a, b) => b.usageCount - a.usageCount)
    }
  }

  /**
   * Validate that all required textures are loaded
   */
  public validateTextures(scene: Scene): {
    readonly isValid: boolean
    readonly missingTextures: string[]
  } {
    const missingTextures: string[] = []
    const requiredTextures = new Set<string>()

    // Collect all required textures
    this.animations.forEach(config => {
      requiredTextures.add(config.texture)
    })

    // Check if textures exist
    for (const texture of requiredTextures) {
      if (!scene.textures.exists(texture)) {
        missingTextures.push(texture)
      }
    }

    return {
      isValid: missingTextures.length === 0,
      missingTextures
    }
  }

  /**
   * Cleanup animations for a scene
   */
  public cleanupSceneAnimations(scene: Scene): void {
    const sceneAnimations = this.sceneAnimations.get(scene)
    
    if (sceneAnimations) {
      sceneAnimations.forEach(type => {
        const state = this.registrationState.get(type)
        if (state) {
          this.registrationState.set(type, {
            ...state,
            usageCount: Math.max(0, state.usageCount - 1)
          })
        }
      })

      this.sceneAnimations.delete(scene)
    }
  }

  /**
   * Get animation duration in milliseconds
   */
  public getAnimationDuration(type: AnimationType): number {
    const config = this.animations.get(type)
    if (!config) return 0

    const frameCount = config.frames.end - config.frames.start + 1
    return (frameCount / config.frameRate) * 1000
  }

  /**
   * Check if animation is looping
   */
  public isLoopingAnimation(type: AnimationType): boolean {
    const config = this.animations.get(type)
    return config ? config.repeat === -1 : false
  }

  /**
   * Get animations by texture
   */
  public getAnimationsByTexture(texture: string): AnimationType[] {
    return Array.from(this.animations.entries())
      .filter(([_, config]) => config.texture === texture)
      .map(([type, _]) => type)
  }

  /**
   * Register custom animation at runtime
   */
  public registerCustomAnimation(config: AnimationConfig): boolean {
    if (this.animations.has(config.key)) {
      console.warn(`Animation ${config.key} already exists`)
      return false
    }

    this.animations.set(config.key, config)
    this.registrationState.set(config.key, {
      config,
      isRegistered: false,
      usageCount: 0
    })

    return true
  }

  /**
   * Preload animations for specific entity types
   */
  public getAnimationsForEntityType(entityType: 'player' | 'worker' | 'tree' | 'effects' | 'coal_vein'): AnimationType[] {
    const entityAnimations = {
      player: [AnimationType.PLAYER_IDLE, AnimationType.PLAYER_WALK, AnimationType.PLAYER_CHOP],
      worker: [AnimationType.WORKER_IDLE, AnimationType.WORKER_WALK, AnimationType.WORKER_CHOP],
      tree: [AnimationType.TREE_IDLE, AnimationType.TREE_HIT, AnimationType.TREE_DESTROY],
      coal_vein: [AnimationType.COAL_VEIN_IDLE],
      effects: [AnimationType.LEAVES_FALL]
    }

    return entityAnimations[entityType] || []
  }
}