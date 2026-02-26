# 🌿 Frigo App — Guide de démarrage complet

> Application de gestion intelligente de vos courses.
> Stack : Next.js 14 · NextAuth · Google Sheets · Claude API · Vercel

---

## 📋 Vue d'ensemble

Cette app vous permet de :
- Scanner votre frigo par photo (IA Claude)
- Gérer votre liste de courses avec filtres par fournisseur
- Voir l'historique de vos commandes (Picnic, La Fourche, Le Fourgon, Marché)
- Recevoir des recommandations d'achat intelligentes

---

## 🚀 Installation en 4 étapes

### Étape 1 — Prérequis (5 min)

Installez Node.js (version 18 ou plus) sur votre ordinateur :
→ https://nodejs.org (prenez la version LTS)

Vérifiez l'installation en ouvrant un terminal :
```bash
node --version   # doit afficher v18.x ou plus
npm --version    # doit afficher 9.x ou plus
```

---

### Étape 2 — Créer le projet GitHub (10 min)

1. Allez sur https://github.com et connectez-vous
2. Cliquez sur **New repository**
3. Nommez-le `frigo-app`, mettez-le en **Private**
4. Cochez **Add a README file**
5. Cliquez **Create repository**

Ensuite, ouvrez un terminal et clonez le dépôt :
```bash
git clone https://github.com/VOTRE_PSEUDO/frigo-app.git
cd frigo-app
```

Copiez tous les fichiers de ce projet dans le dossier, puis :
```bash
npm install
```

---

### Étape 3 — Configurer Google Cloud (20 min)

#### A. Créer un projet Google Cloud

1. Allez sur https://console.cloud.google.com
2. Cliquez en haut à gauche sur le sélecteur de projet → **Nouveau projet**
3. Nom : `frigo-app` → **Créer**

#### B. Activer les APIs nécessaires

Dans le menu → **APIs et services** → **Bibliothèque**, cherchez et activez :
- `Google Sheets API`
- `Google Drive API`

#### C. Créer les identifiants OAuth (pour la connexion Google)

1. **APIs et services** → **Identifiants** → **Créer des identifiants** → **ID client OAuth**
2. Type : **Application Web**
3. Nom : `Frigo App`
4. **URI de redirection autorisés** — ajoutez ces deux URLs :
   ```
   http://localhost:3000/api/auth/callback/google
   https://VOTRE-APP.vercel.app/api/auth/callback/google
   ```
   (remplacez `VOTRE-APP` après déploiement sur Vercel)
5. Téléchargez le JSON ou notez le **Client ID** et **Client Secret**

#### D. Créer un compte de service (pour lire/écrire dans Google Sheets)

1. **IAM et administration** → **Comptes de service** → **Créer un compte de service**
2. Nom : `frigo-app-sheets`
3. Rôle : **Éditeur**
4. Une fois créé, cliquez dessus → **Clés** → **Ajouter une clé** → **JSON**
5. Le fichier JSON se télécharge — **gardez-le précieusement, ne le partagez jamais**

Dans ce fichier JSON, vous trouverez :
- `client_email` → c'est votre `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` → c'est votre `GOOGLE_SERVICE_ACCOUNT_KEY`

---

### Étape 4 — Configurer Google Sheets (10 min)

1. Créez un nouveau Google Sheets sur https://sheets.google.com
2. Nommez-le **Frigo App Data**
3. Créez ces 4 onglets (clic droit sur l'onglet → Renommer) :

**Onglet `Stock`** — en-têtes en ligne 1 :
```
ID | Nom | Catégorie | Quantité | Unité | Quantité min | Fournisseur | Mis à jour le
```

**Onglet `Commandes`** — en-têtes en ligne 1 :
```
ID | Date | Fournisseur | Articles | Total | Statut
```

**Onglet `Liste`** — en-têtes en ligne 1 :
```
ID | Nom | Quantité | Fournisseur | Coché
```

**Onglet `Produits`** — en-têtes en ligne 1 :
```
ID | Nom | Catégorie | Fournisseur habituel | Prix moyen
```

4. **Partagez le Google Sheets** avec l'email du compte de service :
   - Cliquez **Partager** en haut à droite
   - Entrez l'email du compte de service (`frigo-app-sheets@...iam.gserviceaccount.com`)
   - Donnez-lui le rôle **Éditeur**

5. Notez l'**ID du Sheets** depuis l'URL :
   ```
   https://docs.google.com/spreadsheets/d/CECI_EST_L_ID/edit
   ```

---

### Étape 5 — Obtenir la clé Claude API (5 min)

1. Allez sur https://console.anthropic.com
2. Créez un compte si nécessaire
3. **API Keys** → **Create Key**
4. Copiez la clé (commence par `sk-ant-`)

---

### Étape 6 — Configurer les variables d'environnement (10 min)

Copiez le fichier d'exemple :
```bash
cp .env.example .env.local
```

Ouvrez `.env.local` et remplissez toutes les valeurs avec ce que vous avez collecté :

```env
GOOGLE_CLIENT_ID=votre-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=votre-client-secret
NEXTAUTH_SECRET=une-chaine-aleatoire-de-32-caracteres
NEXTAUTH_URL=http://localhost:3000
GOOGLE_SHEETS_ID=votre-id-de-sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=frigo-app-sheets@votre-projet.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\nVotre clé\n-----END PRIVATE KEY-----\n"
ANTHROPIC_API_KEY=sk-ant-votre-cle
ALLOWED_EMAILS=vous@gmail.com,votrefemme@gmail.com
```

> ⚠️ Pour `NEXTAUTH_SECRET`, générez une chaîne aléatoire avec :
> ```bash
> openssl rand -base64 32
> ```

---

### Étape 7 — Lancer en local (2 min)

```bash
npm run dev
```

Ouvrez http://localhost:3000 dans votre navigateur.
Vous devriez voir la page de connexion.

---

## 🚀 Déployer sur Vercel

1. Allez sur https://vercel.com et connectez-vous avec GitHub
2. **New Project** → importez votre repo `frigo-app`
3. Dans **Environment Variables**, ajoutez toutes vos variables du `.env.local`
4. **Deploy**
5. Après déploiement, notez votre URL (ex: `frigo-app.vercel.app`)
6. Mettez à jour `NEXTAUTH_URL` dans Vercel avec cette URL
7. Ajoutez l'URL de callback dans Google Cloud Console (voir Étape 3-C)

---

## 📱 Installer comme app sur votre téléphone

Après déploiement sur Vercel :

**Sur iPhone :**
1. Ouvrez l'URL dans Safari
2. Appuyez sur le bouton Partager (carré avec flèche)
3. **Sur l'écran d'accueil**

**Sur Android :**
1. Ouvrez l'URL dans Chrome
2. Menu (3 points) → **Installer l'application** ou **Ajouter à l'écran d'accueil**

---

## 🗂️ Structure du projet

```
frigo-app/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/  → Authentification Google
│   │   └── scan-fridge/         → API scan frigo (Claude Vision)
│   ├── (app)/                   → Pages protégées (auth requise)
│   │   ├── dashboard/           → Accueil
│   │   ├── fridge/              → Scanner le frigo
│   │   ├── shopping-list/       → Liste de courses
│   │   └── history/             → Historique commandes
│   ├── login/                   → Page de connexion
│   └── globals.css              → Styles globaux
├── components/
│   ├── BottomNav.tsx            → Navigation mobile
│   ├── AppHeader.tsx            → En-tête des pages
│   └── Providers.tsx            → Contextes React
├── lib/
│   ├── auth.ts                  → Helpers d'authentification
│   ├── sheets.ts                → Client Google Sheets
│   └── utils.ts                 → Utilitaires
├── .env.example                 → Template des variables d'env
└── README.md                    → Ce fichier
```

---

## 🔮 Prochaines étapes (modules suivants)

- [ ] **Module 2** : Import historique Picnic (via `python-picnic-api`)
- [ ] **Module 3** : Parsing emails La Fourche & Le Fourgon
- [ ] **Module 4** : Analyse IA des habitudes d'achat
- [ ] **Module 5** : Recommandations et alertes automatiques

---

## 🆘 Problèmes fréquents

**"Non autorisé" à la connexion**
→ Vérifiez que votre email est dans `ALLOWED_EMAILS`

**Erreur Google Sheets**
→ Vérifiez que le compte de service a bien été invité dans le Sheets

**La clé privée ne fonctionne pas**
→ Dans `.env.local`, la clé doit être sur une seule ligne avec `\n` entre chaque ligne

**Le scan frigo ne fonctionne pas**
→ Vérifiez `ANTHROPIC_API_KEY` et que votre compte Anthropic a du crédit

---

*Fait avec ❤️ et 🌿*
