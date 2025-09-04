# 🏗️ DAO Management System

Un système de gestion des DAOs (Dossiers d'Appel d'Offres) moderne et sécurisé, construit avec React, Express, et TypeScript.

## 🚀 Démarrage Rapide

### Prérequis

- **Node.js** ≥ 18.0.0
- **pnpm** ≥ 8.0.0 (recommandé) ou npm
- **MongoDB** (optionnel, fallback sur stockage en mémoire)

### Installation

```bash
# Cloner le projet
git clone <repo-url>
cd dao-management

# Installer les dépendances
pnpm install

# Configurer les variables d'environnement
cp .env.example .env

# Démarrer en mode développement
pnpm dev
```

L'application sera disponible sur :

- **Frontend** : http://localhost:8080
- **Backend API** : http://localhost:3001

## 🔐 Connexion

### Comptes par défaut

- **Admin** : `admin@2snd.fr` / `admin123`
- **Utilisateur** : `marie.dubois@2snd.fr` / `marie123`
- **Utilisateur** : `pierre.martin@2snd.fr` / `pierre123`

## 📁 Structure du Projet

```
code/
├── frontend/              # Application React + TypeScript
│   ├── components/        # Composants réutilisables
│   ├── pages/            # Pages de l'application
│   ├── services/         # Services API
│   ├── contexts/         # Contexts React (Auth, Notifications)
│   └── utils/            # Utilitaires
├── backend-express/       # Serveur Express + TypeScript
│   ├── routes/           # Routes API
│   ├── services/         # Services métier
│   ├── middleware/       # Middleware (auth, sécurité)
│   └── utils/            # Utilitaires serveur
├── shared/               # Types partagés
└── test/                 # Configuration des tests
```

## 🛠️ Scripts Disponibles

```bash
# Développement
pnpm dev                  # Lance frontend + backend
pnpm dev:frontend         # Lance uniquement le frontend
pnpm dev:backend          # Lance uniquement le backend

# Tests
pnpm test                 # Lance tous les tests
pnpm test:watch           # Tests en mode watch
pnpm test:coverage        # Tests avec couverture

# Build & Production
pnpm build                # Build complet
pnpm start                # Lance la version production

# Qualité du code
pnpm typecheck            # Vérification TypeScript
pnpm lint                 # Analyse ESLint
pnpm format.fix           # Formatage Prettier

# Maintenance
pnpm audit:security       # Audit de sécurité
pnpm update:deps          # Mise à jour des dépendances
```

## 🔒 Sécurité

### Variables d'Environnement Requises

```bash
# JWT Secret (OBLIGATOIRE en production)
JWT_SECRET=<secret-fort-256-bits>

# Configuration de base
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-domain.com

# Base de données (optionnel)
MONGODB_URI=mongodb://user:pass@host:port/db

# Session (optionnel)
SESSION_SECRET=<session-secret>
```

⚠️ **IMPORTANT** : Générez des secrets forts en production !

### Fonctionnalités de Sécurité

- ✅ **Authentification JWT** avec expiration
- ✅ **Hachage bcrypt** des mots de passe
- ✅ **Validation Zod** des entrées
- ✅ **Rate limiting** sur les routes sensibles
- ✅ **Headers de sécurité** (Helmet)
- ✅ **CORS** configuré
- ✅ **Audit logging** des actions sensibles

## 🧪 Tests

```bash
# Lancer tous les tests
pnpm test

# Tests avec couverture
pnpm test:coverage

# Tests d'un fichier spécifique
pnpm test authService.test.ts
```

### Écriture de Tests

```typescript
// Exemple de test pour un service
import { describe, it, expect } from "vitest";
import { authService } from "./authService";

describe("AuthService", () => {
  it("should login with valid credentials", async () => {
    // Test logic here
  });
});
```

## 📊 Performance

### Optimisations Implémentées

- **Lazy Loading** des pages avec Suspense
- **React Query** pour la gestion du cache
- **Bundle splitting** automatique
- **Tree shaking** pour réduire la taille
- **Compression** et minification

### Monitoring

```bash
# Analyser la taille du bundle
pnpm build
pnpm preview --analyze
```

## 🔧 API Documentation

### Authentification

```typescript
// POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}

// Response
{
  "user": { "id": "1", "name": "User", "email": "...", "role": "user" },
  "token": "jwt-token"
}
```

### DAOs

```typescript
// GET /api/dao - Liste tous les DAOs
// GET /api/dao/:id - Récupère un DAO spécifique
// POST /api/dao - Crée un nouveau DAO (admin only)
// PUT /api/dao/:id - Met à jour un DAO
// DELETE /api/dao/:id - Supprime un DAO (admin only)
```

### Tasks

```typescript
// POST /api/dao/:daoId/tasks - Ajoute une tâche
// PUT /api/dao/:daoId/tasks/:taskId - Met à jour une tâche
// DELETE /api/dao/:daoId/tasks/:taskId - Supprime une tâche
```

## 🚀 Déploiement

### Variables d'Environnement Production

```bash
NODE_ENV=production
JWT_SECRET=<secret-production-fort>
MONGODB_URI=<mongodb-production-uri>
FRONTEND_URL=<votre-domain-production>
```

### Build Production

```bash
# Build complet
pnpm build

# Lancer en production
NODE_ENV=production pnpm start
```

## 🤝 Contribution

### Guidelines

1. **Fork** le repository
2. **Créer** une branche feature (`git checkout -b feature/amazing-feature`)
3. **Commiter** les changes (`git commit -m 'Add amazing feature'`)
4. **Push** vers la branche (`git push origin feature/amazing-feature`)
5. **Ouvrir** une Pull Request

### Standards de Code

- **TypeScript strict** activé
- **ESLint** + **Prettier** pour le formatage
- **Tests** requis pour les nouvelles fonctionnalités
- **Documentation** des fonctions complexes

## 📚 Technologies Utilisées

### Frontend

- **React 18** + **TypeScript**
- **React Router** pour la navigation
- **React Query** pour la gestion d'état serveur
- **Tailwind CSS** + **Radix UI** pour le design
- **Vite** pour le bundling

### Backend

- **Express.js** + **TypeScript**
- **JWT** pour l'authentification
- **Bcrypt** pour le hachage
- **Zod** pour la validation
- **Helmet** pour la sécurité

### Outils

- **Vitest** pour les tests
- **ESLint** + **Prettier** pour la qualité
- **pnpm** pour la gestion des packages

## 📈 Roadmap

- [ ] **Migration MongoDB** complète
- [ ] **API REST** → **GraphQL**
- [ ] **Notifications temps réel** (WebSocket)
- [ ] **Export PDF** avancé
- [ ] **Dashboard analytics**
- [ ] **Mobile app** (React Native)

## 🐛 Support

- **Issues** : [GitHub Issues](link-to-issues)
- **Documentation** : [Wiki](link-to-wiki)
- **Chat** : [Discord/Slack](link-to-chat)

## 📄 License

Ce projet est sous licence [MIT](LICENSE).

---

**Développé avec ❤️ par l'équipe 2SND**
