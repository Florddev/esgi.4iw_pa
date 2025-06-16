import { Scene } from 'phaser'
import { Worker, WorkerState } from '../objects/workers/Worker'
import { WorkerRegistry } from './WorkerRegistry'
import { WorkerType, type WorkerSaveData, type WorkerPosition } from '../types'

interface WorkerPerformanceData {
    x: number
    y: number
    unchangedCount: number
}

export class WorkerManager {
    private readonly scene: Scene
    private readonly workers: Worker[] = []
    private readonly workerRegistry: WorkerRegistry
    private readonly workerLastPositions = new Map<Worker, WorkerPerformanceData>()
    private readonly STORAGE_KEY = 'WORKERS_STORAGE'
    private readonly STUCK_CHECK_INTERVAL = 5000 // 5 seconds
    private readonly MAX_UNCHANGED_COUNT = 3 // 15 seconds total

    constructor(scene: Scene) {
        this.scene = scene
        this.workerRegistry = WorkerRegistry.getInstance()
        this.setupPerformanceMonitoring()
    }

    private setupPerformanceMonitoring(): void {
        this.scene.time.addEvent({
            delay: this.STUCK_CHECK_INTERVAL,
            callback: this.checkStuckWorkers,
            callbackScope: this,
            loop: true
        })
    }

    public createWorker(
        type: WorkerType,
        x: number,
        y: number,
        depositPoint?: WorkerPosition
    ): Worker | null {
        const worker = this.workerRegistry.createWorker(type, this.scene, x, y, depositPoint)
        
        if (worker) {
            this.workers.push(worker)
            this.saveState()
            
            console.log(`Created ${this.workerRegistry.getWorkerName(type)} at (${x}, ${y})`)
            return worker
        }
        
        console.error(`Failed to create worker of type ${type}`)
        return null
    }

    public createLumberjack(x: number, y: number, depositPoint?: WorkerPosition): Worker | null {
        return this.createWorker(WorkerType.LUMBERJACK, x, y, depositPoint)
    }

    public removeWorker(worker: Worker): boolean {
        const index = this.workers.indexOf(worker)
        if (index === -1) {
            return false
        }

        this.workers.splice(index, 1)
        this.workerLastPositions.delete(worker)
        
        try {
            worker.destroy()
        } catch (error) {
            console.error('Error destroying worker:', error)
        }
        
        this.saveState()
        return true
    }

    public getWorkers(): readonly Worker[] {
        return [...this.workers]
    }

    public getWorkersByType(type: WorkerType): readonly Worker[] {
        return this.workers.filter(worker => {
            const workerType = this.workerRegistry.getWorkerTypeFromInstance(worker)
            return workerType === type
        })
    }

    public getWorkerCount(): number {
        return this.workers.length
    }

    public getWorkerCountByType(type: WorkerType): number {
        return this.getWorkersByType(type).length
    }

    public updateWorkers(): void {
        // Update all workers
        this.workers.forEach(worker => {
            try {
                worker.update()
            } catch (error) {
                console.error('Error updating worker:', error)
            }
        })

        // Clean up destroyed workers
        this.cleanupDestroyedWorkers()
    }

    private cleanupDestroyedWorkers(): void {
        const initialCount = this.workers.length
        
        for (let i = this.workers.length - 1; i >= 0; i--) {
            const worker = this.workers[i]
            if (!worker.scene || !worker.active) {
                this.workers.splice(i, 1)
                this.workerLastPositions.delete(worker)
            }
        }

        if (this.workers.length !== initialCount) {
            console.log(`Cleaned up ${initialCount - this.workers.length} destroyed workers`)
            this.saveState()
        }
    }

    private checkStuckWorkers(): void {
        try {
            this.workers.forEach(worker => {
                if (!worker || !worker.scene) {
                    return
                }

                this.updateWorkerPerformanceData(worker)
                this.handleStuckWorker(worker)
            })

            this.cleanupOrphanedPerformanceData()
        } catch (error) {
            console.error('Error checking stuck workers:', error)
        }
    }

    private updateWorkerPerformanceData(worker: Worker): void {
        const lastPos = this.workerLastPositions.get(worker)
        const currentPos = { x: worker.x, y: worker.y }

        if (!lastPos) {
            this.workerLastPositions.set(worker, {
                x: currentPos.x,
                y: currentPos.y,
                unchangedCount: 0
            })
            return
        }

        const distance = Phaser.Math.Distance.Between(
            lastPos.x, lastPos.y,
            currentPos.x, currentPos.y
        )

        if (distance < 5) { // Practically immobile
            lastPos.unchangedCount++
        } else {
            // Worker has moved, reset counter
            lastPos.x = currentPos.x
            lastPos.y = currentPos.y
            lastPos.unchangedCount = 0
        }

        this.workerLastPositions.set(worker, lastPos)
    }

    private handleStuckWorker(worker: Worker): void {
        const performanceData = this.workerLastPositions.get(worker)
        
        if (performanceData && performanceData.unchangedCount >= this.MAX_UNCHANGED_COUNT) {
            console.log('WorkerManager: Stuck worker detected, force reset')

            try {
                worker.cleanup()
                worker.setState(WorkerState.IDLE)
                performanceData.unchangedCount = 0
            } catch (error) {
                console.error('Error resetting stuck worker:', error)
                
                // Try a more direct approach
                try {
                    worker.setState(WorkerState.IDLE)
                    performanceData.unchangedCount = 0
                } catch (e) {
                    console.error('Unable to reset worker:', e)
                    // Mark for removal if completely broken
                    this.removeWorker(worker)
                }
            }
        }
    }

    private cleanupOrphanedPerformanceData(): void {
        this.workerLastPositions.forEach((_, worker) => {
            if (!this.workers.includes(worker)) {
                this.workerLastPositions.delete(worker)
            }
        })
    }

    // Save/Load system
    private saveState(): void {
        try {
            const state: WorkerSaveData[] = this.workers.map(worker => {
                const workerType = this.workerRegistry.getWorkerTypeFromInstance(worker)
                const stats = worker.getStats()
                const inventory: Record<string, number> = {}
                
                // Convert inventory Map to plain object
                worker.getInventoryState().forEach((amount, resource) => {
                    inventory[resource] = amount
                })

                return {
                    type: workerType || WorkerType.LUMBERJACK, // Fallback
                    position: { x: worker.x, y: worker.y },
                    state: worker.getState(),
                    inventory,
                    depositPoint: (worker as any).depositPoint || undefined,
                    stats
                }
            })

            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(state))
        } catch (error) {
            console.error('Error saving worker state:', error)
        }
    }

    public loadState(): void {
        try {
            const stored = sessionStorage.getItem(this.STORAGE_KEY)
            if (!stored) return

            const state: WorkerSaveData[] = JSON.parse(stored)
            
            // Validate and load workers
            const validWorkers = state.filter(data => 
                this.workerRegistry.isValidWorkerType(data.type) &&
                typeof data.position.x === 'number' &&
                typeof data.position.y === 'number' &&
                !isNaN(data.position.x) &&
                !isNaN(data.position.y)
            )

            validWorkers.forEach(data => {
                const worker = this.createWorker(
                    data.type,
                    data.position.x,
                    data.position.y,
                    data.depositPoint
                )

                if (worker) {
                    // Restore worker state
                    try {
                        worker.setState(data.state)
                        
                        // Restore inventory if available
                        if (data.inventory) {
                            Object.entries(data.inventory).forEach(([resource, amount]) => {
                                worker.addToInventory(resource as any, amount)
                            })
                        }
                    } catch (error) {
                        console.error('Error restoring worker state:', error)
                        // Worker is created but might not have full state
                    }
                }
            })

            console.log(`Loaded ${validWorkers.length} workers`)
        } catch (error) {
            console.error('Error loading workers:', error)
            // Clean up corrupted storage
            sessionStorage.removeItem(this.STORAGE_KEY)
        }
    }

    // Statistics and utilities
    public getWorkerStatistics(): {
        readonly totalWorkers: number
        readonly workersByType: Record<string, number>
        readonly workersByState: Record<WorkerState, number>
        readonly averageEfficiency: number
    } {
        const workersByType: Record<string, number> = {}
        const workersByState: Record<WorkerState, number> = {
            [WorkerState.IDLE]: 0,
            [WorkerState.MOVING_TO_RESOURCE]: 0,
            [WorkerState.HARVESTING]: 0,
            [WorkerState.MOVING_TO_STORAGE]: 0,
            [WorkerState.DEPOSITING]: 0
        }

        let totalEfficiency = 0

        this.workers.forEach(worker => {
            // Count by type
            const workerType = this.workerRegistry.getWorkerTypeFromInstance(worker)
            const typeName = workerType ? this.workerRegistry.getWorkerName(workerType) : 'Unknown'
            workersByType[typeName] = (workersByType[typeName] || 0) + 1

            // Count by state
            const state = worker.getState()
            workersByState[state]++

            // Calculate efficiency
            totalEfficiency += this.workerRegistry.calculateWorkerEfficiency(worker)
        })

        return {
            totalWorkers: this.workers.length,
            workersByType,
            workersByState,
            averageEfficiency: this.workers.length > 0 ? totalEfficiency / this.workers.length : 0
        }
    }

    public getWorkerInRadius(position: WorkerPosition, radius: number): readonly Worker[] {
        return this.workers.filter(worker => {
            const distance = Phaser.Math.Distance.Between(
                position.x, position.y,
                worker.x, worker.y
            )
            return distance <= radius
        })
    }

    public findNearestWorker(position: WorkerPosition, type?: WorkerType): Worker | null {
        let candidates = this.workers

        if (type) {
            candidates = this.workers.filter(worker => {
                const workerType = this.workerRegistry.getWorkerTypeFromInstance(worker)
                return workerType === type
            })
        }

        if (candidates.length === 0) return null

        return candidates.reduce((nearest, current) => {
            const nearestDist = Phaser.Math.Distance.Between(
                position.x, position.y,
                nearest.x, nearest.y
            )
            const currentDist = Phaser.Math.Distance.Between(
                position.x, position.y,
                current.x, current.y
            )
            return currentDist < nearestDist ? current : nearest
        })
    }

    // Cleanup
    public clearAll(): void {
        console.log(`Removing ${this.workers.length} workers`)
        
        // Destroy all workers
        this.workers.forEach(worker => {
            try {
                worker.destroy()
            } catch (error) {
                console.error('Error destroying worker during clearAll:', error)
            }
        })

        // Clear collections
        this.workers.length = 0
        this.workerLastPositions.clear()

        // Clear storage
        try {
            sessionStorage.removeItem(this.STORAGE_KEY)
        } catch (error) {
            console.error('Error clearing worker storage:', error)
        }
    }

    public destroy(): void {
        this.clearAll()
    }
}