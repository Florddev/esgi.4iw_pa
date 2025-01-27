# Jeu 2D avec Vue.js, Phaser et AdonisJS

Un jeu 2D avec système de récolte de ressources, développé avec Vue.js pour l'interface, Phaser pour le moteur de jeu, et AdonisJS pour le backend.

## Prérequis

- Node.js (version 18 ou supérieure)
- npm (inclus avec Node.js)
- Tiled Map Editor (pour l'édition des maps)

## Installation

1. Cloner le projet :
```bash
git clone https://github.com/Florddev/4ESGI_PA.git
cd 4ESGI_PA
```

2. Installation du backend (Adonis) :
```bash
cd server
npm install
node ace configure @adonisjs/auth
node ace configure @adonisjs/lucid
```

3. Installation du frontend (Vue) :
```bash
cd ../client
npm install
```

## Configuration

1. Configuration du backend :
   - Copier le fichier `.env.example` vers `.env` dans le dossier `server`
   - Configurer les variables d'environnement selon vos besoins

2. Configuration de la base de données :
```bash
cd server
node ace migration:run
```

## Développement

1. Lancer le serveur de développement backend :
```bash
cd server
npm run dev
```

2. Lancer le serveur de développement frontend :
```bash
cd client
npm run dev
```

3. Lancer le docker pour le serveur de base de données :
```bash
docker compose up -d
```

Le jeu sera accessible à l'adresse : `http://localhost:5173`

## Structure des dossiers

```
project/
├── client/                 # Frontend Vue.js
│   ├── public/
│   │   └── assets/        # Assets du jeu
│   │       ├── sprites/   # Sprites et spritesheets
│   │       ├── tilesets/  # Tilesets pour les maps
│   │       ├── maps/      # Maps exportées de Tiled
│   │       └── ui/        # Images UI (boutons, etc.)
│   └── src/
│       ├── game/          # Logic du jeu
│       │   ├── scenes/    # Scènes Phaser
│       │   └── objects/   # Objets du jeu
│       └── components/    # Composants Vue
│
└── server/                # Backend AdonisJS
    ├── app/
    │   ├── Controllers/
    │   └── Models/
    └── config/
```

## Création de maps avec Tiled

1. Configuration Tiled :
   - Taille des tiles : 16x16 pixels
   - Format d'export : JSON
   - Orientation : Orthogonal
   - Compression : Aucune

2. Propriétés des layers :
   - Ground : Layer de base
   - Walls : Layer avec collisions
   - Trees : Layer pour les arbres (object layer)

3. Export :
   - Exporter en JSON
   - Activer "Embed tilesets"
   - Sauvegarder dans `client/public/assets/maps/`

## Commandes utiles

```bash
# Lancer les tests (à venir)
npm run test

# Build pour production
cd client
npm run build

# Lancer les migrations
cd server
node ace migration:run

# Créer un nouveau controller
cd server
node ace make:controller NomController

# Vérifier le statut du serveur
cd server
node ace status
```

## Technologies utilisées

- Vue.js 3
- Phaser 3
- AdonisJS
- TypeScript
- Tiled Map Editor

## Contribution

1. Fork le projet
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Push sur la branche
5. Créer une Pull Request

## License

...