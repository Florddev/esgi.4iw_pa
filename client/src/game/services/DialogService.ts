// src/game/services/DialogService.ts
import { Scene } from 'phaser';

export interface DialogConfig {
  text: string;
  duration?: number;
  callback?: () => void;
}

export class DialogService {
  private scene: Scene;
  private dialogQueue: DialogConfig[] = [];
  private isDisplaying: boolean = false;
  private currentDialog?: Phaser.GameObjects.Container;
  
  constructor(scene: Scene) {
    this.scene = scene;
  }

  showDialog(config: DialogConfig) {
    this.dialogQueue.push(config);
    if (!this.isDisplaying) {
      this.displayNextDialog();
    }
  }

  private displayNextDialog() {
    if (this.dialogQueue.length === 0) {
      this.isDisplaying = false;
      return;
    }

    this.isDisplaying = true;
    const dialog = this.dialogQueue.shift()!;
    
    // Créer une scène UI séparée pour le dialogue
    if (!this.scene.game.scene.getScene('DialogUIScene')) {
      this.scene.game.scene.add('DialogUIScene', {
        create: function() {
          this.graphics = this.add.graphics();
          this.dialogText = this.add.text(0, 0, '', {
            fontSize: '24px',
            color: '#ffffff',
            wordWrap: { width: window.innerWidth - 40 }
          });
        }
      }, true);
    }

    const dialogScene = this.scene.game.scene.getScene('DialogUIScene') as Phaser.Scene;
    const graphics = (dialogScene as any).graphics;
    const dialogText = (dialogScene as any).dialogText;

    // Dessiner le fond
    graphics.clear();
    graphics.fillStyle(0x000000, 0.7);
    graphics.fillRect(0, window.innerHeight - 120, window.innerWidth, 120);

    // Configurer le texte
    dialogText.setText(dialog.text);
    dialogText.setPosition(20, window.innerHeight - 100);

    this.scene.time.delayedCall(dialog.duration || 3000, () => {
      if (dialog.callback) {
        dialog.callback();
      }
      graphics.clear();
      dialogText.setText('');
      this.displayNextDialog();
    });
  }
}