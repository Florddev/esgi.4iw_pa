export class InteractionZone extends Phaser.GameObjects.Zone {
    private isPlayerInRange: boolean = false;
    private interactionKey: Phaser.Input.Keyboard.Key;
    private actionButton?: Phaser.GameObjects.Image;
    private woodCount: number = 0;
    private woodCountText?: Phaser.GameObjects.Text;
    private player?: Player;
  
    constructor(scene: Scene, x: number, y: number, width: number, height: number) {
      super(scene, x, y, width, height);
      scene.add.existing(this);
      scene.physics.add.existing(this, true);
  
      this.interactionKey = scene.input.keyboard.addKey('E');
  
      // Création du bouton d'action (invisible par défaut)
      this.actionButton = scene.add.image(x + 25, y + 15, 'action-button')
        .setScale(0.1)
        .setVisible(false)
        .setInteractive()
        .on('pointerdown', () => this.triggerInteraction());
  
      // Création du texte pour afficher le compte de bois
      this.woodCountText = scene.add.text(10, 10, 'Bois: 0', {
        fontSize: '24px',
        color: '#ffffff'
      });
      this.woodCountText.setScrollFactor(0);
    }
  
    public setupPlayerCollision(player: Player): void {
      this.player = player;
      this.scene.physics.add.overlap(
        player,
        this,
        this.handleOverlap.bind(this),
        undefined,
        this
      );
    }
  
    private handleOverlap(): void {
      if (!this.isPlayerInRange) {
        this.isPlayerInRange = true;
        if (this.actionButton) this.actionButton.setVisible(true);
      }
    }
  
    private triggerInteraction(): void {
      if (!this.isPlayerInRange || !this.player) {
        return;
      }
  
      // Vérifier si le joueur n'est pas déjà en train d'interagir
      if (this.player.isInteracting()) {
        return;
      }
  
      this.woodCount++;
      if (this.woodCountText) {
        this.woodCountText.setText(`Bois: ${this.woodCount}`);
      }
      
      this.player.playChopAnimation();
    }
  
    public update(): void {
      if (!this.player) return;
  
      // Vérifier si le joueur est toujours dans la zone
      if (!this.scene.physics.overlap(this.player, this)) {
        this.isPlayerInRange = false;
        if (this.actionButton) this.actionButton.setVisible(false);
      }
  
      // Vérifier si la touche E est pressée
      if (this.isPlayerInRange && 
          Phaser.Input.Keyboard.JustDown(this.interactionKey) && 
          !this.player.isInteracting()) {
        this.triggerInteraction();
      }
    }
  }