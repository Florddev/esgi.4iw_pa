import { Scene } from 'phaser';
type Scene = typeof Scene;

export interface DialogConfig {
    readonly text: string;
    readonly duration?: number;
    readonly callback?: () => void;
    readonly priority?: DialogPriority;
    readonly style?: DialogStyle;
}

export enum DialogPriority {
    LOW = 0,
    NORMAL = 1,
    HIGH = 2,
    CRITICAL = 3
}

export interface DialogStyle {
    readonly fontSize?: string;
    readonly color?: string;
    readonly backgroundColor?: number;
    readonly backgroundAlpha?: number;
    readonly padding?: number;
    readonly wordWrapWidth?: number;
}

interface QueuedDialog extends DialogConfig {
    readonly id: string;
    readonly timestamp: number;
}

export class DialogService {
    private readonly scene: Scene;
    private readonly dialogQueue: QueuedDialog[] = [];
    private isDisplaying: boolean = false;
    private currentDialogId: string | null = null;
    private dialogUIScene: Phaser.Scene | null = null;
    
    private readonly DEFAULT_DURATION = 3000;
    private readonly DEFAULT_STYLE: Required<DialogStyle> = {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: 0x000000,
        backgroundAlpha: 0.7,
        padding: 20,
        wordWrapWidth: 0
    };

    constructor(scene: Scene) {
        this.scene = scene;
        this.initializeDialogUI();
    }

    public showDialog(config: DialogConfig): string {
        const dialogId = this.generateDialogId();
        const queuedDialog: QueuedDialog = {
            ...config,
            id: dialogId,
            timestamp: Date.now(),
            priority: config.priority ?? DialogPriority.NORMAL,
            duration: config.duration ?? this.DEFAULT_DURATION
        };

        this.addToQueue(queuedDialog);
        
        if (!this.isDisplaying) {
            this.processQueue();
        }

        return dialogId;
    }

    public showImportantDialog(text: string, callback?: () => void): string {
        return this.showDialog({
            text,
            callback,
            priority: DialogPriority.HIGH,
            duration: 4000
        });
    }

    public showCriticalDialog(text: string, callback?: () => void): string {
        return this.showDialog({
            text,
            callback,
            priority: DialogPriority.CRITICAL,
            duration: 6000,
            style: {
                color: '#ff4444',
                backgroundColor: 0x440000,
                backgroundAlpha: 0.9
            }
        });
    }

    public cancelDialog(dialogId: string): boolean {
        if (this.currentDialogId === dialogId) {
            this.skipCurrentDialog();
            return true;
        }

        const index = this.dialogQueue.findIndex(dialog => dialog.id === dialogId);
        if (index !== -1) {
            this.dialogQueue.splice(index, 1);
            return true;
        }

        return false;
    }

    public clearQueue(): void {
        this.dialogQueue.length = 0;
        if (this.isDisplaying) {
            this.skipCurrentDialog();
        }
    }

    public getQueueLength(): number {
        return this.dialogQueue.length;
    }

    public isDialogActive(): boolean {
        return this.isDisplaying;
    }

    private addToQueue(dialog: QueuedDialog): void {
        let insertIndex = this.dialogQueue.length;
        
        for (let i = 0; i < this.dialogQueue.length; i++) {
            if (this.dialogQueue[i].priority! < dialog.priority!) {
                insertIndex = i;
                break;
            }
        }
        
        this.dialogQueue.splice(insertIndex, 0, dialog);
    }

    private processQueue(): void {
        if (this.dialogQueue.length === 0) {
            this.isDisplaying = false;
            this.currentDialogId = null;
            return;
        }

        this.isDisplaying = true;
        const dialog = this.dialogQueue.shift()!;
        this.currentDialogId = dialog.id;
        
        this.displayDialog(dialog);
    }

    private displayDialog(dialog: QueuedDialog): void {
        if (!this.dialogUIScene) {
            console.error('DialogService: UI Scene not initialized');
            this.processQueue();
            return;
        }

        const style = { ...this.DEFAULT_STYLE, ...dialog.style };
        style.wordWrapWidth = style.wordWrapWidth || (window.innerWidth - (style.padding * 2));

        this.clearPreviousDialog();
        this.createDialogElements(dialog.text, style);

        this.scene.time.delayedCall(dialog.duration!, () => {
            if (this.currentDialogId === dialog.id) {
                this.executeCallback(dialog.callback);
                this.processQueue();
            }
        });
    }

    private initializeDialogUI(): void {
        const dialogUIConfig = {
            key: 'DialogUIScene',
            active: false,
            visible: false,
            create: this.createDialogScene.bind(this)
        };

        if (!this.scene.game.scene.getScene('DialogUIScene')) {
            this.dialogUIScene = this.scene.game.scene.add('DialogUIScene', dialogUIConfig, true);
        } else {
            this.dialogUIScene = this.scene.game.scene.getScene('DialogUIScene');
        }
    }

    private createDialogScene(): void {
        if (!this.dialogUIScene) return;

        (this.dialogUIScene as any).dialogGraphics = this.dialogUIScene.add.graphics();
        (this.dialogUIScene as any).dialogText = this.dialogUIScene.add.text(0, 0, '', {
            fontSize: '24px',
            color: '#ffffff',
            wordWrap: { width: window.innerWidth - 40 }
        });
    }

    private createDialogElements(text: string, style: Required<DialogStyle>): void {
        if (!this.dialogUIScene) return;

        const graphics = (this.dialogUIScene as any).dialogGraphics;
        const dialogText = (this.dialogUIScene as any).dialogText;

        if (!graphics || !dialogText) return;

        const textHeight = 120;
        const dialogY = window.innerHeight - textHeight;

        graphics.clear();
        graphics.fillStyle(style.backgroundColor, style.backgroundAlpha);
        graphics.fillRect(0, dialogY, window.innerWidth, textHeight);

        dialogText.setStyle({
            fontSize: style.fontSize,
            color: style.color,
            wordWrap: { width: style.wordWrapWidth }
        });
        
        dialogText.setText(text);
        dialogText.setPosition(style.padding, dialogY + style.padding);

        this.dialogUIScene.scene.setVisible(true);
        this.dialogUIScene.scene.setActive(true);
    }

    private clearPreviousDialog(): void {
        if (!this.dialogUIScene) return;

        const graphics = (this.dialogUIScene as any).dialogGraphics;
        const dialogText = (this.dialogUIScene as any).dialogText;

        if (graphics) graphics.clear();
        if (dialogText) dialogText.setText('');
    }

    private skipCurrentDialog(): void {
        this.clearPreviousDialog();
        
        if (this.dialogUIScene) {
            this.dialogUIScene.scene.setVisible(false);
            this.dialogUIScene.scene.setActive(false);
        }
        
        this.processQueue();
    }

    private executeCallback(callback?: () => void): void {
        if (callback) {
            try {
                callback();
            } catch (error) {
                console.error('Erreur dans le callback de dialogue:', error);
            }
        }
    }

    private generateDialogId(): string {
        return `dialog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    public showWelcomeSequence(): void {
        this.showDialog({
            text: "Bienvenue dans TinyTown! Pour commencer votre aventure, vous devez récolter du bois.",
            duration: 4000,
            priority: DialogPriority.HIGH,
            callback: () => {
                this.showDialog({
                    text: "Approchez-vous d'un arbre et cliquez dessus pour le couper. Objectif: 5 unités de bois.",
                    duration: 4000,
                    priority: DialogPriority.HIGH
                });
            }
        });
    }

    public showResourceError(message: string = 'Ressources insuffisantes!'): void {
        this.showDialog({
            text: message,
            duration: 2000,
            priority: DialogPriority.NORMAL,
            style: {
                color: '#ff4444',
                backgroundColor: 0x440000
            }
        });
    }

    public showSuccess(message: string): void {
        this.showDialog({
            text: message,
            duration: 3000,
            priority: DialogPriority.NORMAL,
            style: {
                color: '#44ff44',
                backgroundColor: 0x004400
            }
        });
    }

    public destroy(): void {
        this.clearQueue();
        
        if (this.dialogUIScene) {
            this.scene.game.scene.remove('DialogUIScene');
            this.dialogUIScene = null;
        }
    }
}