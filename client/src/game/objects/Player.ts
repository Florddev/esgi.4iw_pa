// src/game/objects/Player.ts
import { Scene } from 'phaser'

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private moveSpeed: number = 80
  private isMoving: boolean = false
  private facingLeft: boolean = false
  private isChopping: boolean = false
  private path: { x: number; y: number }[] = [];    // <-- tableau de points (tuiles) à suivre
  private currentTargetIndex: number = 0;           // <-- index du point courant dans le path

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
      frameRate: 16,
      repeat: 0
    })

    // Debug: Log de confirmation
    console.log('Animations créées:', {
      walk: this.anims.exists('walk'),
      idle: this.anims.exists('idle'),
      chop: this.anims.exists('chop')
    })
  }

  public setPath(path: { x: number; y: number }[]): void {
    // On retire le premier point du path s’il correspond à la position actuelle
    // (car le path inclut souvent la case de départ).
    if (path.length > 0) {
      const first = path[0];
      if (first.x === Math.floor(this.x / 16) && first.y === Math.floor(this.y / 16)) {
        path.shift();
      }
    }

    this.path = path;
    this.currentTargetIndex = 0;
  }

  public stopChopAnimation(): void {
    if (this.isChopping) {
      this.isChopping = false;
      this.anims.stop();
      this.play('idle', true);
    }
  }

  update(): void {
    // Si on est en train de couper l’arbre, pas de mouvement
    if (this.isChopping) return; 

    // Si on a encore des points dans le chemin, on avance vers le prochain
    if (this.path.length > 0 && this.currentTargetIndex < this.path.length) {
      const targetTile = this.path[this.currentTargetIndex];

      // Convertir coords tuile => coords monde
      const targetX = targetTile.x * 16 + 8;  // +8 pour centrer sur la tuile
      const targetY = targetTile.y * 16 + 8;

      // Calcul de la direction
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 2) {
        // On considère qu’on est arrivé à la tuile cible => passer à la suivante
        this.currentTargetIndex++;
        if (this.currentTargetIndex >= this.path.length) {
          // On a fini le chemin
          this.path = [];
          this.setVelocity(0, 0);
          this.play('idle', true);
          return;
        }
      } else {
        // On avance
        const angle = Math.atan2(dy, dx);
        const vx = Math.cos(angle) * this.moveSpeed;
        const vy = Math.sin(angle) * this.moveSpeed;
        this.setVelocity(vx, vy);

        // Gestion de l’animation de marche
        if (!this.anims.isPlaying || this.anims.currentAnim?.key !== 'walk') {
          this.play('walk', true);
        }

        // Gérer flipX pour orientation
        this.setFlipX(vx < 0);
      }
    } else {
      // Pas de path => on s’arrête
      this.setVelocity(0, 0);
      if (!this.anims.isPlaying || this.anims.currentAnim?.key !== 'idle') {
        this.play('idle', true);
      }
    }
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
    if (this.isChopping) return;

    this.isChopping = true;
    this.anims.stop();
    this.play('chop', true);

    this.on('animationupdate', (anim, frame) => {
      if (frame.index === 8 && onHitFrame) {
        onHitFrame();
      }
    });

    this.once('animationcomplete', () => {
      this.isChopping = false;
      this.play('idle', true);
      this.off('animationupdate');
    });
  }
}