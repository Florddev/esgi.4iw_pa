import { Scene } from 'phaser'
import { Player } from './Player'

export class Tree extends Phaser.Physics.Arcade.Sprite {
    private isPlayerInRange: boolean = false
    private hitCount: number = 0
    private maxHits: number = 4
    private woodValue: number = 3
    private isBeingHit: boolean = false
    private isDestroyed: boolean = false
    private player?: Player
    private baseCollider?: Phaser.Types.Physics.Arcade.ImageWithDynamicBody
    private respawnTime: number = 60000
    private stump?: Phaser.GameObjects.Sprite
    private initialX: number
    private initialY: number
    private tileObject: any
    private detectionZone?: Phaser.GameObjects.Zone
    private maxHealth: number = 100
    private currentHealth: number = this.maxHealth
    private damagePerHit: number = 25
    private healthBar?: Phaser.GameObjects.Sprite;
    private healingTimer?: Phaser.Time.TimerEvent
    private lastPlayerPosition?: { x: number, y: number }
    private autoHitTimer?: Phaser.Time.TimerEvent
    private leavesParticles: Phaser.GameObjects.Sprite[] = []

    constructor(scene: Scene, x: number, y: number, tileObject: any) {
        super(scene, x, y, 'tree')

        this.initialX = x
        this.initialY = y
        this.tileObject = tileObject;

        this.setInteractive()
        this.setupCursorEvents()

        scene.add.existing(this)
        scene.physics.add.existing(this, true)

        // Création d'une zone de détection séparée
        this.detectionZone = scene.add.zone(x, y, 31, 32)
        scene.physics.add.existing(this.detectionZone, true)

        // Création du collider de base (souche)
        this.baseCollider = scene.physics.add.image(x, y + (tileObject.height / 2), 'tree')
            .setSize(tileObject.width, tileObject.height)
            .setVisible(false)
            .setImmovable(true);

        // Création des animations
        this.createAnimations()
        this.play('tree-idle')

        // Création de la souche (invisible au début)
        this.stump = scene.add.sprite(x, y, 'tree', 5)
            .setVisible(false)

        // Définir la profondeur initiale
        this.setDepth(10) // Au-dessus du joueur par défaut
        this.createHealthBar()

        this.createLeavesAnimation()
    }

    private createLeavesAnimation(): void {
        // Créer l'animation pour les feuilles qui tombent
        this.scene.anims.create({
            key: 'leaves-fall',
            frames: this.scene.anims.generateFrameNumbers('leaves-hit', {
                start: 0,
                end: 9 // 10 frames au total (0-9)
            }),
            frameRate: 12,
            repeat: 0 // Ne joue qu'une fois
        })
    }

    private createLeafParticle(offsetX: number = 0, offsetY: number = 0): void {
        // Créer une nouvelle feuille
        const leaf = this.scene.add.sprite(
            this.x + offsetX,
            this.y + offsetY,
            'leaves-hit'
        )
        
        // Définir la profondeur pour qu'elle apparaisse au-dessus de l'arbre
        leaf.setDepth(this.depth + 1)
        
        // Jouer l'animation
        leaf.play('leaves-fall')
        
        // Ajouter un mouvement de chute avec Tweens
        this.scene.tweens.add({
            targets: leaf,
            y: leaf.y - 5, // Distance de chute
            x: leaf.x /*+ (Math.random() * 40 - 20)*/, // Mouvement aléatoire horizontal
            duration: 1000,
            ease: 'Power1',
            onComplete: () => {
                leaf.destroy() // Supprimer la feuille une fois l'animation terminée
                const index = this.leavesParticles.indexOf(leaf)
                if (index > -1) {
                    this.leavesParticles.splice(index, 1)
                }
            }
        })

        this.leavesParticles.push(leaf)
    }

    private spawnLeaves(): void {
        // Créer plusieurs feuilles avec des positions légèrement décalées
        this.createLeafParticle(0, 0)
    }

    private createHealthBar(): void {
        // Créer la barre de vie
        this.healthBar = this.scene.add.sprite(this.x, this.y - 20, 'health-bar');
        
        // La cacher par défaut
        this.healthBar.setVisible(false);
        
        // Définir la profondeur pour qu'elle soit toujours visible
        this.healthBar.setDepth(1000);
    }

    public startChoppingSequence(player: Player): void {
        // Vérifie si l'arbre n'est pas déjà en train d'être coupé
        if (this.isBeingHit || this.isDestroyed) return;
    
        const interactionPoint = this.findNearestInteractionPoint(player.x, player.y);
        
        // Convertir en coordonnées de tuiles pour le pathfinding
        const targetTileX = Math.floor(interactionPoint.x / 16);
        const targetTileY = Math.floor(interactionPoint.y / 16);
        const playerTileX = Math.floor(player.x / 16);
        const playerTileY = Math.floor(player.y / 16);
    
        // Obtenir la référence à la scène principale
        const mainScene = this.scene as any;
        
        // Utiliser le pathfinding pour se rendre au point d'interaction
        mainScene.easyStar.findPath(
            playerTileX,
            playerTileY,
            targetTileX,
            targetTileY,
            (path) => {
                if (path === null) {
                    console.log('Impossible d\'atteindre l\'arbre');
                    return;
                }
    
                // Définir le chemin pour le joueur
                player.setPath(path);
                
                // Variables pour suivre si le joueur est arrêté
                let lastX = player.x;
                let lastY = player.y;
                let stablePositionCount = 0; // Compte combien de fois le joueur est resté immobile
                
                // Attendre que le joueur arrive à destination
                const checkInterval = mainScene.time.addEvent({
                    delay: 100,
                    callback: () => {
                        const distanceToTarget = Phaser.Math.Distance.Between(
                            player.x,
                            player.y,
                            interactionPoint.x,
                            interactionPoint.y
                        );
    
                        // Vérifier si le joueur est arrêté
                        const isNotMoving = lastX === player.x && lastY === player.y;
                        
                        // Mettre à jour les dernières positions
                        lastX = player.x;
                        lastY = player.y;
    
                        if (distanceToTarget < 20) { // Si assez proche
                            if (isNotMoving) {
                                stablePositionCount++;
                                
                                // Attendre que le joueur soit stable pendant 3 ticks (300ms)
                                if (stablePositionCount >= 1) {
                                    checkInterval.destroy();
                                    
                                    // S'assurer que le joueur est orienté vers l'arbre
                                    const facingDirection = this.x > player.x ? false : true;
                                    player.setFlipX(facingDirection);
                                    
                                    if (!this.isDestroyed) {
                                        player.setFlipX(facingDirection);
                                        this.isPlayerInRange = true;
                                        this.startAutoHitSequence().catch(console.error);
                                    }
                                }
                            } else {
                                stablePositionCount = 0; // Réinitialiser si le joueur bouge
                            }
                        } else {
                            stablePositionCount = 0; // Réinitialiser si trop loin
                        }
                    },
                    loop: true
                });
            }
        );
    
        mainScene.easyStar.calculate();
    }

    private updateHealthBar(forceShow: boolean = false): void {
        if (!this.healthBar) return;
    
        // Calcul du pourcentage de vie
        const healthPercent = this.currentHealth / this.maxHealth;
    
        // Il y a 7 frames (0 à 6)
        // On mappe le pourcentage sur les frames disponibles
        const frame = Math.floor(healthPercent * 6);
        
        // Mettre à jour la frame
        this.healthBar.setFrame(frame);
    
        // Positionner la barre au-dessus de l'arbre
        this.healthBar.setPosition(this.x, this.y - 20);
    
        // Afficher la barre si la vie n'est pas pleine ou si forcé
        this.healthBar.setVisible(forceShow || this.currentHealth < this.maxHealth);
    }

    private startHealingTimer(): void {
        // Annuler le timer existant s'il y en a un
        if (this.healingTimer) {
            this.healingTimer.destroy()
        }

        // Créer un nouveau timer de 10 secondes
        this.healingTimer = this.scene.time.delayedCall(10000, () => {
            this.currentHealth = this.maxHealth
            this.updateHealthBar()
        })
    }

    private async startAutoHitSequence(): Promise<void> {
        //if (this.isBeingHit || !this.player || this.player.isInteracting() || this.isDestroyed) return

        // Vérifier la direction du joueur vers l'arbre
        const isFacingTree = this.player.isFacingObject(this.x, this.y);
        //if (!isFacingTree) return;

        this.isBeingHit = true
        this.setDepth(0)
    
        // Sauvegarder la position initiale du joueur
        this.lastPlayerPosition = {
            x: this.player.x,
            y: this.player.y
        };
    
        let isSequenceCancelled = false;

        console.log('start choping animation');
        while (this.currentHealth > 0 && !this.isDestroyed && !isSequenceCancelled) {
            console.log('while');
            // Vérifier si le joueur essaie de bouger
            if (this.player.cursors.left.isDown || 
                this.player.cursors.right.isDown || 
                this.player.cursors.up.isDown || 
                this.player.cursors.down.isDown) {

                console.log('sequenceCancelled: ', this.player.cursors.left.isDown,
                    this.player.cursors.right.isDown,
                    this.player.cursors.up.isDown,
                    this.player.cursors.down.isDown);

                this.stopAutoHit();
                isSequenceCancelled = true;
                break;
            }

            this.currentHealth -= this.damagePerHit;
            await this.performHit();
        }
    
        if (!isSequenceCancelled && this.currentHealth <= 0) {
            this.play('tree-destroy');
            await this.waitForAnimation('tree-destroy');
            this.scene.events.emit('addWood', this.woodValue);
            this.isDestroyed = true;
            this.cleanup();
        }
    
        this.isBeingHit = false;
    }

    private stopAutoHit(): void {
        this.isBeingHit = false;
        if (this.autoHitTimer) {
            this.autoHitTimer.destroy();
        }
        // Arrêter l'animation du joueur immédiatement
        if (this.player) {
            this.player.stopChopAnimation();
            this.play('tree-idle');
        }
        // Redémarrer le timer de guérison
        this.startHealingTimer();
    }

    private setupCursorEvents() {
        this.on('pointerover', () => {
            if (!this.isDestroyed && this.scene.uiScene) {
                this.scene.uiScene.defaultCursor.setVisible(false);
                this.scene.uiScene.hoverCursor.setVisible(true);
            }
        });
        
        this.on('pointerout', () => {
            if (this.scene.uiScene) {
                this.scene.uiScene.defaultCursor.setVisible(true);
                this.scene.uiScene.hoverCursor.setVisible(false);
            }
        });
    
        // Nouveau gestionnaire de clic
        this.on('pointerdown', () => {
            if (!this.isDestroyed && !this.isBeingHit && this.player) {
                this.startChoppingSequence(this.player);
            }
        });
    }

    public setRespawnTime(time: number): void {
        this.respawnTime = time
    }

    private createAnimations(): void {
        this.anims.create({
            key: 'tree-idle',
            frames: this.anims.generateFrameNumbers('tree', {
                start: 1,
                end: 4
            }),
            frameRate: 5,
            repeat: -1
        })

        // Animation de hit
        this.anims.create({
            key: 'tree-hit',
            frames: this.anims.generateFrameNumbers('tree', {
                start: 1,
                end: 4
            }),
            frameRate: 10,
            repeat: 0 // Jouer une seule fois
        })

        // Animation de destruction
        this.anims.create({
            key: 'tree-destroy',
            frames: this.anims.generateFrameNumbers('tree', {
                start: 5,
                end: 5
            }),
            frameRate: 10,
            repeat: 0
        })
    }

    public setupPlayerCollision(player: Player): void {
        this.player = player
        if (this.detectionZone) {
            // Utiliser la zone de détection pour l'overlap
            this.scene.physics.add.overlap(
                player,
                this.detectionZone,
                this.handlePlayerOverlap.bind(this),
                null,
                this
            )
        }

        if (this.baseCollider) {
            //this.scene.physics.add.collider(player, this.baseCollider)
        }
    }

    private handlePlayerOverlap(): void {
        if (!this.isDestroyed && !this.isBeingHit && !this.isPlayerInRange) {
            this.isPlayerInRange = true;

            const mousePointer = this.scene.input.mousePointer;
            const worldPoint = this.scene.cameras.main.getWorldPoint(mousePointer.x, mousePointer.y);
            
            const bounds = this.getBounds();
            if (bounds.contains(worldPoint.x, worldPoint.y) && this.scene.uiScene) {
                this.scene.uiScene.defaultCursor.setVisible(false);
                this.scene.uiScene.hoverCursor.setVisible(true);
            }
        }
    }

  
    public getTreeTilePosition(): { x: number, y: number } {
        return {
            x: Math.floor(this.x / 16),
            y: Math.floor(this.y / 16)
        };
    }
      
    public isBlockingPath(): boolean {
        // Que l'arbre soit vivant ou une souche, il bloque toujours le passage
        return true;
    }
    
    private cleanup(): void {
        this.isPlayerInRange = false;
        this.setVisible(false);
        this.isDestroyed = true;
    
        if (this.stump) {
            this.stump.setVisible(true);
        }
    
        //this.scene.uiScene.defaultCursor.setVisible(true);
        //this.scene.uiScene.hoverCursor.setVisible(false);
    
        if (this.healthBar) {
            this.healthBar.setVisible(false);
        }
    
        // Toujours maintenir la collision et la mise à jour du pathfinding
        if (this.scene && (this.scene as any).rebuildPathfindingGrid) {
            (this.scene as any).rebuildPathfindingGrid();
        }
    
        this.scene.time.delayedCall(this.respawnTime, () => this.respawn(), [], this);
    }

    private respawn(): void {
        if (this.stump) {
            this.stump.setVisible(false)
        }
    
        // Réinitialiser l'arbre
        this.isDestroyed = false
        this.isBeingHit = false
        this.hitCount = 0
        this.setVisible(true)
        this.play('tree-idle')
    
        // Réinitialiser la profondeur
        this.setDepth(10)
    
        // Vérifier si le joueur est déjà dans la zone après le respawn
        if (this.player && this.scene && this.detectionZone) {
            const overlap = this.scene.physics.overlap(this.player, this.detectionZone)
            if (overlap) {
                this.isPlayerInRange = true
            }
        }
        
        this.currentHealth = this.maxHealth
        this.updateHealthBar()
    
        // Mettre à jour la grille de pathfinding quand l'arbre repousse
        if (this.scene) {
            (this.scene as any).rebuildPathfindingGrid();
        }
    }

    public findNearestInteractionPoint(playerX: number, playerY: number): { x: number, y: number } {
        const tileSize = 16; // Taille d'une tuile
        
        // Position de l'arbre en tuiles
        const treeTileX = Math.floor(this.x / tileSize);
        const treeTileY = Math.floor(this.y / tileSize);
        
        // Positions possibles (gauche et droite de l'arbre)
        const positions = [
            { x: (treeTileX - 1) * tileSize, y: treeTileY * tileSize }, // Gauche
            { x: (treeTileX + 1) * tileSize, y: treeTileY * tileSize }  // Droite
        ];
        
        // Trouver la position la plus proche du joueur
        return positions.reduce((closest, current) => {
            const currentDist = Phaser.Math.Distance.Between(playerX, playerY, current.x, current.y);
            const closestDist = Phaser.Math.Distance.Between(playerX, playerY, closest.x, closest.y);
            return currentDist < closestDist ? current : closest;
        });
    }

    private async performHit(): Promise<void> {
        if (!this.player) return
    
        // Jouer l'animation du joueur avec un callback pour la barre de vie
        this.player.playChopAnimation(() => {
            // Afficher et mettre à jour la barre de vie
            if (this.healthBar) {
                this.healthBar.setPosition(this.x, this.y - 20)
                this.updateHealthBar()
                this.healthBar.setVisible(true)
            }
            // Créer l'effet de feuilles qui tombent
            this.spawnLeaves()
        })
    
        // Jouer l'animation de l'arbre
        this.play('tree-hit')
    
        // Attendre la fin des animations
        await Promise.all([
            this.waitForAnimation('tree-hit'),
            this.waitForPlayerAnimation()
        ])
    }

    public onInteractionStart(): void {
        if (!this.isBeingHit && !this.isDestroyed && this.player) {
            // Vérifier la direction du joueur vers l'arbre
            const isFacingTree = this.player.isFacingObject(this.x, this.y);
    
            if (isFacingTree) {
                // Arrêter le timer de guérison existant
                if (this.healingTimer) {
                    this.healingTimer.destroy()
                }
                this.startAutoHitSequence()
            }
        }
    }

    private waitForAnimation(key: string): Promise<void> {
        return new Promise((resolve) => {
            this.once('animationcomplete', function (animation: Phaser.Animations.Animation) {
                if (animation.key === key) {
                    resolve()
                }
            })
        })
    }

    private waitForPlayerAnimation(): Promise<void> {
        return new Promise((resolve) => {
            if (this.player) {
                this.player.once('animationcomplete', () => resolve())
            } else {
                resolve()
            }
        })
    }

    public setWoodValue(value: number): void {
        this.woodValue = value
    }

    public setMaxHealth(health: number): void {
        this.maxHealth = health
        this.currentHealth = health
        this.updateHealthBar()
    }

    public setDamagePerHit(damage: number): void {
        this.damagePerHit = damage
    }

    destroy(fromScene?: boolean): void {
        // Nettoyer toutes les particules de feuilles restantes
        this.leavesParticles.forEach(leaf => leaf.destroy())
        this.leavesParticles = []
        
        if (this.healthBar) {
            this.healthBar.destroy()
        }
        if (this.detectionZone) {
            this.detectionZone.destroy()
        }
        super.destroy(fromScene)
    }

    update(): void {
        if (!this.isDestroyed && this.player && this.scene) {
            const isOverlapping = this.scene.physics.overlap(this.player, this.detectionZone)
            
            if (isOverlapping) {
                // Vérifier si le joueur est tourné vers l'arbre
                const isFacingTree = this.player.isFacingObject(this.x, this.y);
    
                if (!isFacingTree && this.scene.uiScene) {
                    // Si le joueur est dans la zone mais ne regarde pas l'arbre
                    this.scene.uiScene.defaultCursor.setVisible(true);
                    this.scene.uiScene.hoverCursor.setVisible(false);
                } else if (isFacingTree && this.scene.uiScene) {
                    // Si le joueur est dans la zone ET regarde l'arbre
                    const mousePointer = this.scene.input.mousePointer;
                    const worldPoint = this.scene.cameras.main.getWorldPoint(mousePointer.x, mousePointer.y);
                    
                    const bounds = this.getBounds();
                    if (bounds.contains(worldPoint.x, worldPoint.y)) {
                        this.scene.uiScene.defaultCursor.setVisible(false);
                        this.scene.uiScene.hoverCursor.setVisible(true);
                    }
                }
            }
            
            if (!isOverlapping && this.isBeingHit) {
                this.stopAutoHit()
            }
            
            this.isPlayerInRange = isOverlapping
        }
    }

}