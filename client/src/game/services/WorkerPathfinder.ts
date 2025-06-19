import EasyStar from 'easystarjs';

export class WorkerPathfinder {
    private static instance: WorkerPathfinder;
    private easyStar: EasyStar.js;
    private grid: number[][] = [];
    private tileSize: number = 16;

    private constructor() {
        this.easyStar = new EasyStar.js();
        this.easyStar.setAcceptableTiles([0]);
        this.easyStar.enableDiagonals();
        this.easyStar.disableCornerCutting();
    }

    public static getInstance(): WorkerPathfinder {
        if (!WorkerPathfinder.instance) {
            WorkerPathfinder.instance = new WorkerPathfinder();
        }
        return WorkerPathfinder.instance;
    }

    public initializeGrid(grid: number[][]): void {
        this.grid = grid.map(row => [...row]);
        this.easyStar.setGrid(this.grid);
    }

    public findPath(
        startX: number,
        startY: number,
        endX: number,
        endY: number
    ): Promise<{ x: number; y: number }[] | null> {
        return new Promise((resolve) => {
            const startTileX = Math.floor(startX / this.tileSize);
            const startTileY = Math.floor(startY / this.tileSize);
            const endTileX = Math.floor(endX / this.tileSize);
            const endTileY = Math.floor(endY / this.tileSize);

            // Vérifier les limites
            if (!this.isValidTile(startTileX, startTileY) || !this.isValidTile(endTileX, endTileY)) {
                resolve(null);
                return;
            }

            this.easyStar.findPath(startTileX, startTileY, endTileX, endTileY, (path) => {
                if (path === null) {
                    resolve(null);
                } else {
                    const worldPath = path.map(tile => ({
                        x: tile.x * this.tileSize + this.tileSize / 2,
                        y: tile.y * this.tileSize + this.tileSize / 2
                    }));
                    resolve(worldPath);
                }
            });

            this.easyStar.calculate();
        });
    }

    public findNearestWalkableTile(targetX: number, targetY: number, maxRadius: number = 5): { x: number; y: number } | null {
        const tileX = Math.floor(targetX / this.tileSize);
        const tileY = Math.floor(targetY / this.tileSize);

        for (let radius = 1; radius <= maxRadius; radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                        const checkX = tileX + dx;
                        const checkY = tileY + dy;

                        if (this.isWalkableTile(checkX, checkY)) {
                            return {
                                x: checkX * this.tileSize + this.tileSize / 2,
                                y: checkY * this.tileSize + this.tileSize / 2
                            };
                        }
                    }
                }
            }
        }
        return null;
    }

    private isValidTile(x: number, y: number): boolean {
        return x >= 0 && y >= 0 && y < this.grid.length && x < this.grid[0].length;
    }

    private isWalkableTile(x: number, y: number): boolean {
        return this.isValidTile(x, y) && this.grid[y][x] === 0;
    }
}