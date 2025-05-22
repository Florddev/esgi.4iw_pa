import { Scene } from 'phaser';

interface PlayerConfig {
    moveSpeed: number;
    bodyWidth: number;
    bodyHeight: number;
}

interface Position {
    x: number;
    y: number;
}

interface PathNode {
    x: number;
    y: number;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
    public readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;

    private readonly config: PlayerConfig = {
        moveSpeed: 80,
        bodyWidth: 12,
        bodyHeight: 6
    };

    private isChopping: boolean = false;
    private path: PathNode[] = [];
    private currentTargetIndex: number = 0;

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'player-idle');

        this.cursors = scene.input.keyboard.createCursorKeys();
        
        this.initializePlayer();
        this.createAnimations();
        this.play('idle');
    }

    private initializePlayer(): void {
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);
        
        this.setCollideWorldBounds(true);
        this.setupHitbox();
    }

    private setupHitbox(): void {
        const { bodyWidth, bodyHeight } = this.config;
        this.body.setSize(bodyWidth, bodyHeight);

        const offsetX = (96 - bodyWidth) / 2;
        const offsetY = (64 - bodyHeight) / 1.8;
        this.body.setOffset(offsetX, offsetY);
    }

    private createAnimations(): void {
        const animations = [
            {
                key: 'walk',
                texture: 'player-walk',
                frames: { start: 0, end: 7 },
                frameRate: 12,
                repeat: -1
            },
            {
                key: 'idle',
                texture: 'player-idle', 
                frames: { start: 0, end: 8 },
                frameRate: 8,
                repeat: -1
            },
            {
                key: 'chop',
                texture: 'player-chop',
                frames: { start: 0, end: 7 },
                frameRate: 16,
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
    }

    public setPath(path: PathNode[]): void {
        // Supprimer le premier point s'il correspond à la position actuelle
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

    private getCurrentTilePosition(): Position {
        return {
            x: Math.floor(this.x / 16),
            y: Math.floor(this.y / 16)
        };
    }

    public stopChopAnimation(): void {
        if (!this.isChopping) return;

        this.isChopping = false;
        this.anims.stop();
        this.play('idle', true);
    }

    public playChopAnimation(onHitFrame?: () => void): void {
        if (this.isChopping) return;

        this.isChopping = true;
        this.anims.stop();
        this.play('chop', true);

        if (onHitFrame) {
            const handleAnimationUpdate = (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
                if (frame.index === 8) {
                    onHitFrame();
                }
            };

            this.on('animationupdate', handleAnimationUpdate);
            
            this.once('animationcomplete', () => {
                this.off('animationupdate', handleAnimationUpdate);
                this.finishChopAnimation();
            });
        } else {
            this.once('animationcomplete', () => {
                this.finishChopAnimation();
            });
        }
    }

    private finishChopAnimation(): void {
        this.isChopping = false;
        this.play('idle', true);
    }

    public isFacingObject(objectX: number, objectY: number): boolean {
        const dx = objectX - this.x;
        const dy = objectY - this.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const isFlippedX = this.flipX;

        if (absDx > absDy) {
            // Mouvement horizontal dominant
            return (dx > 0 && !isFlippedX) || (dx < 0 && isFlippedX);
        } else {
            // Mouvement vertical dominant - toujours considéré comme "face à l'objet"
            return true;
        }
    }

    public isInteracting(): boolean {
        return this.isChopping;
    }

    private updatePathMovement(): void {
        if (this.path.length === 0 || this.currentTargetIndex >= this.path.length) {
            this.stopMovement();
            return;
        }

        const targetTile = this.path[this.currentTargetIndex];
        const targetWorldPos = this.tileToWorldPosition(targetTile);
        
        const distance = Phaser.Math.Distance.Between(
            this.x, this.y,
            targetWorldPos.x, targetWorldPos.y
        );

        if (distance < 2) {
            this.moveToNextPathNode();
        } else {
            this.moveTowardsTarget(targetWorldPos);
        }
    }

    private tileToWorldPosition(tile: PathNode): Position {
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

    private moveTowardsTarget(target: Position): void {
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
        if (!this.anims.isPlaying || this.anims.currentAnim?.key !== 'walk') {
            this.play('walk', true);
        }
        this.setFlipX(velocityX < 0);
    }

    private stopMovement(): void {
        this.setVelocity(0, 0);
        
        if (!this.anims.isPlaying || this.anims.currentAnim?.key !== 'idle') {
            this.play('idle', true);
        }
    }

    update(): void {
        // Si en train de couper, pas de mouvement
        if (this.isChopping) return;

        // Mise à jour du mouvement basé sur le chemin
        this.updatePathMovement();
    }
}