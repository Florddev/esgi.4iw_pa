import type { BuildingConfig } from '../types'
import { ResourceType } from '../types'

export class BuildingRegistry {
  private static instance: BuildingRegistry
  private readonly buildings = new Map<string, BuildingConfig>()

  private constructor() {
    this.initializeBuildings()
  }

  public static getInstance(): BuildingRegistry {
    if (!BuildingRegistry.instance) {
      BuildingRegistry.instance = new BuildingRegistry()
    }
    return BuildingRegistry.instance
  }

  private initializeBuildings(): void {
    const buildingConfigs: BuildingConfig[] = [
      {
        key: 'house',
        name: 'Maison',
        template: 'house-template',
        icon: 'house',
        cost: { [ResourceType.WOOD]: 10 },
        description: 'Logement pour les ouvriers, améliore leur efficacité'
      },
      {
        key: 'sawmill',
        name: 'Scierie',
        template: 'sawmill-template',
        icon: 'sawmill',
        cost: { [ResourceType.WOOD]: 20 },
        description: 'Traite le bois et stocke les ressources'
      },
      {
        key: 'mine',
        name: 'Mine',
        template: 'mine-template',
        icon: 'mine',
        cost: { 
          [ResourceType.WOOD]: 15, 
          [ResourceType.STONE]: 10 
        },
        description: 'Extrait pierre et métaux du sous-sol'
      },
      {
        key: 'farm',
        name: 'Ferme',
        template: 'farm-template',
        icon: 'farm',
        cost: { [ResourceType.WOOD]: 12 },
        description: 'Produit de la nourriture pour les ouvriers'
      }
    ]

    buildingConfigs.forEach(config => {
      this.buildings.set(config.key, config)
    })
  }

  public getBuilding(key: string): BuildingConfig | undefined {
    return this.buildings.get(key)
  }

  public getAllBuildings(): readonly BuildingConfig[] {
    return Array.from(this.buildings.values())
  }

  public getBuildingCost(key: string): Record<string, number> {
    const building = this.buildings.get(key)
    return building?.cost || {}
  }

  public getBuildingName(key: string): string {
    const building = this.buildings.get(key)
    return building?.name || key
  }

  public isValidBuilding(key: string): boolean {
    return this.buildings.has(key)
  }

  public canAffordBuilding(
    buildingKey: string, 
    availableResources: Map<ResourceType, number>
  ): boolean {
    const cost = this.getBuildingCost(buildingKey)
    
    return Object.entries(cost).every(([resource, amount]) => {
      const available = availableResources.get(resource as ResourceType) || 0
      return available >= amount
    })
  }
}