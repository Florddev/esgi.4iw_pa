// src/game/objects/Player.ts
import { Scene } from 'phaser'

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private moveSpeed: number = 50
  private isMoving: boolean = false
  private facingLeft: boolean = false
  private isChopping: boolean = false

  constructor(scene: Scene, x: number, y: number) {
    super(scene, x, y, 'player-idle')

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.setCollideWorldBounds(true)
    this.cursors = scene.input.keyboard.createCursorKeys()

    // Configuration de la hitbox
    const bodyWidth = 12
    const bodyHeight = 6
    this.body.setSize(bodyWidth, bodyHeight)

    const offsetX = (96 - bodyWidth) / 2
    const offsetY = (64 - bodyHeight) / 1.8
    this.body.setOffset(offsetX, offsetY)

    /*
    const offsetX = (96 - bodyWidth) / 1.95
    const offsetY = (64 - bodyHeight) / 1.95
    this.body.setCircle(5, offsetX, offsetY)
    */

    this.createAnimations()
    this.play('idle')

    // Debug: Afficher toutes les animations disponibles
    console.log('Animations disponibles:', this.anims.animationManager.anims.keys())
  }

  public isInteracting(): boolean {
    return this.isChopping;
  }

  private createAnimations(): void {
    // Animation de marche
    this.anims.create({
      key: 'walk',
      frames: this.anims.generateFrameNumbers('player-walk', {
        start: 0,
        end: 7
      }),
      frameRate: 12,
      repeat: -1
    })

    // Animation idle
    this.anims.create({
      key: 'idle',
      frames: this.anims.generateFrameNumbers('player-idle', {
        start: 0,
        end: 8
      }),
      frameRate: 8,
      repeat: -1
    })

    // Animation de coupe
    this.anims.create({
      key: 'chop',
      frames: this.anims.generateFrameNumbers('player-chop', {
        start: 0,
        end: 7  // Ajustez selon votre spritesheet
      }),
      frameRate: 12,
      repeat: 0
    })

    // Debug: Log de confirmation
    console.log('Animations créées:', {
      walk: this.anims.exists('walk'),
      idle: this.anims.exists('idle'),
      chop: this.anims.exists('chop')
    })
  }

  public stopChopAnimation(): void {
    if (this.isChopping) {
      this.isChopping = false;
      this.anims.stop();
      this.play('idle', true);
    }
  }

  update(): void {
    if (this.isChopping) return; // Ne pas permettre le mouvement pendant la coupe

    // Réinitialisation de la vélocité
    this.setVelocity(0)

    // Variable pour suivre si le personnage se déplace
    let isMoving = false

    // Gestion des mouvements
    if (this.cursors.left.isDown) {
      this.setVelocityX(-this.moveSpeed)
      this.setFlipX(true)
      this.facingLeft = true
      isMoving = true
    } else if (this.cursors.right.isDown) {
      this.setVelocityX(this.moveSpeed)
      this.setFlipX(false)
      this.facingLeft = false
      isMoving = true
    }

    if (this.cursors.up.isDown) {
      this.setVelocityY(-this.moveSpeed)
      isMoving = true
    } else if (this.cursors.down.isDown) {
      this.setVelocityY(this.moveSpeed)
      isMoving = true
    }

    // Normalisation de la vitesse en diagonale
    if (this.body.velocity.x !== 0 && this.body.velocity.y !== 0) {
      this.body.velocity.normalize().scale(this.moveSpeed)
    }

    // Gestion des animations si on ne coupe pas
    if (!this.isChopping) {
      if (isMoving) {
        if (!this.anims.isPlaying || this.anims.currentAnim?.key !== 'walk') {
          this.play('walk', true)
        }
      } else {
        if (!this.anims.isPlaying || this.anims.currentAnim?.key !== 'idle') {
          this.play('idle', true)
        }
      }
    }

    // Maintenir la direction du sprite
    this.setFlipX(this.facingLeft)
  }

  public isFacingObject(objectX: number, objectY: number): boolean {
    // Calculer la différence entre la position du joueur et de l'objet
    const dx = objectX - this.x;
    const dy = objectY - this.y;

    // Déterminer la direction dominante
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > absDy) {
        // Mouvement horizontal dominant
        return (dx > 0 && !this.facingLeft) || (dx < 0 && this.facingLeft);
    } else {
        // Mouvement vertical dominant
        return (dy > 0 && !this.facingLeft) || (dy < 0 && this.facingLeft);
    }
  }

  public playChopAnimation(onHitFrame?: () => void): void {
    // Si déjà en train de couper, ne rien faire
    if (this.isChopping) {
      return;
    }

    console.log('Démarrage animation de coupe');
    this.isChopping = true;

    // Arrêter les autres animations
    this.anims.stop();

    // Jouer l'animation de coupe
    this.play('chop', true);

    // Écouter la frame spécifique de frappe
    this.on('animationupdate', (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
        // Par exemple, à la 4ème frame (vous pouvez ajuster selon votre spritesheet)
        if (frame.index === 8 && onHitFrame) {
            onHitFrame();
        }
    });

    // Écouter la fin de l'animation
    this.once('animationcomplete', () => {
        console.log('Animation de coupe terminée');
        this.isChopping = false;
        this.play('idle', true);
        
        // Supprimer l'écouteur de mise à jour d'animation
        this.off('animationupdate');
    });
  }
}