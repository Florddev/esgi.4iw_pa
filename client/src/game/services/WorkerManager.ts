// src/game/services/WorkerManager.ts
import { Scene } from 'phaser';
import { Worker, WorkerState } from '../objects/workers/Worker';
import { Lumberjack } from '../objects/workers/Lumberjack';

export class WorkerManager {
    private scene: Scene;
    private workers: Worker[] = [];
    private readonly STORAGE_KEY = 'WORKERS_STORAGE';
    private workerLastPositions: Map<Worker, { x: number, y: number, unchangedCount: number }> = new Map();

    constructor(scene: Scene) {
        this.scene = scene;

        this.scene.time.addEvent({
            delay: 5000, // Vérifier toutes les 5 secondes
            callback: this.checkStuckWorkers,
            callbackScope: this,
            loop: true
        });
    }

    public createLumberjack(x: number, y: number, depositPoint?: { x: number, y: number }): Lumberjack {
        const lumberjack = new Lumberjack(this.scene, x, y, depositPoint);
        this.workers.push(lumberjack);
        this.saveState();
        return lumberjack;
    }

    private checkStuckWorkers(): void {
        try {
            this.workers.forEach(worker => {
                // Vérifier que le worker est toujours valide
                if (!worker || !worker.scene) {
                    return; // Ignorer les workers qui ont été détruits
                }

                const lastPos = this.workerLastPositions.get(worker);
                const currentPos = { x: worker.x, y: worker.y };

                if (!lastPos) {
                    // Premier enregistrement de la position
                    this.workerLastPositions.set(worker, {
                        x: currentPos.x,
                        y: currentPos.y,
                        unchangedCount: 0
                    });
                } else {
                    // Vérifier si la position est inchangée
                    const distance = Phaser.Math.Distance.Between(lastPos.x, lastPos.y, currentPos.x, currentPos.y);

                    if (distance < 5) { // Pratiquement immobile
                        lastPos.unchangedCount++;

                        // Si le travailleur est bloqué depuis un certain temps
                        if (lastPos.unchangedCount >= 3) { // 15 secondes
                            console.log('WorkerManager: Worker bloqué détecté, reset forcé');

                            try {
                                // Forcer un reset de l'ouvrier
                                worker.cleanup();
                                worker.setState(WorkerState.IDLE);

                                // Réinitialiser le compteur
                                lastPos.unchangedCount = 0;
                            } catch (error) {
                                console.error('Erreur lors du reset forcé du worker:', error);

                                // Tenter une approche plus directe
                                try {
                                    worker.setState(WorkerState.IDLE);
                                } catch (e) {
                                    console.error('Impossible de réinitialiser le worker:', e);
                                }
                            }
                        }
                    } else {
                        // L'ouvrier s'est déplacé, réinitialiser le compteur
                        lastPos.x = currentPos.x;
                        lastPos.y = currentPos.y;
                        lastPos.unchangedCount = 0;
                    }

                    this.workerLastPositions.set(worker, lastPos);
                }
            });

            // Nettoyer les entrées pour les workers qui n'existent plus
            this.workerLastPositions.forEach((value, worker) => {
                if (!this.workers.includes(worker)) {
                    this.workerLastPositions.delete(worker);
                }
            });
        } catch (error) {
            console.error('Erreur lors de la vérification des workers bloqués:', error);
        }
    }

    private saveState(): void {
        // Sauvegarder l'état des travailleurs (position, type, etc.)
        const state = this.workers.map(worker => {
            const data: any = {
                type: worker.constructor.name,
                x: worker.x,
                y: worker.y
            };

            // Ajouter le point de dépôt s'il existe
            if ((worker as any).depositPoint) {
                data.depositPoint = (worker as any).depositPoint;
            }

            return data;
        });

        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    }

    public loadState(): void {
        const stored = sessionStorage.getItem(this.STORAGE_KEY);
        if (!stored) return;

        try {
            const state = JSON.parse(stored);
            state.forEach(data => {
                if (data.type === 'Lumberjack') {
                    this.createLumberjack(data.x, data.y, data.depositPoint);
                }
                // Ajouter d'autres types d'ouvriers au besoin
            });
        } catch (error) {
            console.error('Erreur chargement travailleurs:', error);
        }
    }

    public updateWorkers(): void {
        this.workers.forEach(worker => worker.update());
    }

    public getWorkers(): Worker[] {
        return this.workers;
    }

    public removeWorker(worker: Worker): void {
        const index = this.workers.indexOf(worker);
        if (index !== -1) {
            this.workers.splice(index, 1);
            worker.destroy();
            this.saveState();
        }
    }
}