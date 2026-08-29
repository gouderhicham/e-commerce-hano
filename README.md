# pc store .39

Boutique en ligne d'informatique reconditionnée pour le marché algérien.
Bilingue français / arabe (RTL), paiement à la livraison sur les 69 zones de
livraison (les 58 wilayas + les 11 circonscriptions administratives déléguées
qui ont leur propre tarif).

## Architecture

Une seule application, déployée comme **un seul Cloudflare Worker**. L'API
NestJS d'origine (74 endpoints) a été portée dans `front-end/src/server/` :
mêmes routes, mêmes règles métier, même contrat d'erreur.

```
front-end/
  app/                     pages Next.js (App Router) + back-office /admin
  app/api/[[...route]]/    ← toute l'API (routeur Hono), même Worker
  app/media/[...key]/      images téléversées, servies depuis Postgres
  src/server/routes/       couche HTTP — validation, gardes, formats de réponse
  src/server/services/     logique de données, réutilisée par les pages serveur
  src/server/domain/       règles métier sans framework
  src/server/infra/        mots de passe, JWT, cookies, stockage, e-mail
  prisma/                  schéma, migrations, seed
```

Détail de l'application :

```
front-end/app/(public)/   vitrine (invité — ni compte ni connexion)
front-end/app/admin/      back-office (protégé par proxy.ts + layout)
front-end/app/login/      connexion admin
front-end/src/lib/data/   types, règles, interfaces de dépôt
front-end/src/components/ kit UI, blocs vitrine, briques admin
front-end/public/images/  images du catalogue livrées avec le seed
```

Les règles métier non négociables sont dans
[`front-end/AGENTS.md`](./front-end/AGENTS.md).

| Élément | Choix | Pourquoi |
| ------- | ----- | -------- |
| Hébergement | Cloudflare Workers (via OpenNext) | Pas de démarrage à froid, contrairement aux fonctions serverless classiques |
| Base de données | **Neon Postgres**, via Hyperdrive | Hyperdrive n'est pas une base : c'est un pool de connexions devant *votre* Neon, qui évite la poignée de main TCP+TLS à chaque requête |
| API | Hono, montée dans Next.js | Un composant serveur atteint l'API **en mémoire**, sans aucun aller-retour réseau |
| Fichiers téléversés | table `MediaObject` (Postgres) | Aucun second fournisseur de stockage à provisionner |
| Sessions | JWT HS256 (`jose`) en cookie httpOnly | Web Crypto natif, vérifiable sans base |
| E-mail | Resend (HTTP) | Les Workers n'ont pas de socket TCP : SMTP est impossible |

> **En production**, l'application ne lit rien dans `process.env` : chaque
> valeur arrive comme *binding* ou *secret* (voir `front-end/wrangler.jsonc`),
> car il n'existe pas d'environnement de processus sur Workers. En local, et
> uniquement là, `src/server/runtime.ts` reconstitue ces valeurs à partir de
> `.env.local`.

---

## Démarrage

Deux choses à lancer : **Postgres dans Docker**, puis **l'application dans votre
terminal**. Il n'y a plus de back-end séparé — l'API fait partie de
l'application.

### 1. La base de données

```bash
docker compose up -d          # Postgres sur localhost:5435
```

Le projet Docker s'appelle `pcstore39_hono_ver` et publie le port **5435**, donc
il cohabite sans conflit avec l'ancienne stack NestJS (`pcstore39`, port 5434) :
noms de conteneurs, volumes et ports sont tous distincts. Les deux peuvent
tourner en même temps.

```bash
docker compose ps             # vérifier que la base est "healthy"
```

### 2. L'application

```bash
cd front-end
npm install
npm run prisma:deploy         # applique les migrations
npm run prisma:seed           # jeu de données de démonstration
npm run dev                   # http://localhost:3000
```

C'est tout : la vitrine, le back-office `/admin` et l'API `/api/*` sont servis
par ce seul processus, sur le seul port 3000.

Vérifier que tout répond :

```bash
curl http://localhost:3000/api/health     # {"status":"ok","products":6}
```

`npm run dev` ne démarre **pas** workerd : les bindings Cloudflare sont
remplacés en local par les variables de `front-end/.env.local`
(`src/server/runtime.ts`), donc rien de natif n'a besoin de se lancer. Pour
tester avec les vrais bindings, `CLOUDFLARE_DEV=1 npm run dev`, ou mieux
`npm run cf:preview`, qui exécute le Worker réellement construit.

**Comptes de démonstration** (créés par le seed) :

| Rôle   | Email                 | Mot de passe |
| ------ | --------------------- | ------------ |
| Admin  | `admin@pcstore39.dz`  | `admin123`   |
| Client | `client@pcstore39.dz` | `client123`  |

### Arrêter

```bash
# Ctrl+C dans le terminal de `npm run dev`
docker compose stop           # arrête Postgres, données conservées
```

---

## Déploiement sur Cloudflare

### Ce qu'il faut réunir

| # | Élément | Où l'obtenir | Coût |
| - | ------- | ------------ | ---- |
| 1 | Un dépôt GitHub | vous poussez ce dossier | — |
| 2 | Un compte Cloudflare | [dash.cloudflare.com](https://dash.cloudflare.com) | gratuit |
| 3 | La chaîne de connexion Neon | tableau de bord Neon → Connection string | gratuit (500 Mo) |
| 4 | Une clé de signature de session | `openssl rand -base64 32` | — |
| 5 | *(option)* Une clé API Resend | [resend.com](https://resend.com) — sinon les e-mails sont ignorés | gratuit (3 000/mois) |
| 6 | *(option)* Un nom de domaine | sinon `*.workers.dev` suffit | — |

Rien d'autre : pas de serveur, pas de stockage objet, pas de service d'images.

### 1. Pousser le dépôt

```bash
git add -A
git commit -m "Version Hono / Cloudflare Workers"
git push -u origin <votre-branche>
```

### 2. Connecter Neon à Cloudflare (Hyperdrive)

```bash
cd front-end
npx wrangler login
npx wrangler hyperdrive create pc-store-39-db   --connection-string="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
```

La commande affiche un `id`. Le reporter dans `wrangler.jsonc`, à la place de
`REPLACE_WITH_HYPERDRIVE_ID`, puis commiter ce changement.

### 3. Préparer la base Neon

```bash
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" npm run prisma:deploy
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" npm run prisma:seed
```

Le seed est idempotent : il crée le catalogue de démonstration, les 69 zones de
livraison et **les images, compressées, dans la base**. Sautez-le si vous
partez d'un catalogue vide.

### 4. Renseigner les secrets

```bash
npx wrangler secret put JWT_SECRET       # obligatoire — signature des sessions
npx wrangler secret put RESEND_API_KEY   # option — sans lui, les e-mails sont ignorés
npx wrangler secret put MAIL_TO          # option — destinataire des alertes
```

Ajuster aussi `PUBLIC_BASE_URL` dans `vars` (`wrangler.jsonc`) : c'est lui qui
construit les URLs `/media/<clé>` des images.

### 5. Déployer

Deux possibilités, au choix.

**Depuis GitHub (recommandé).** Ajouter dans *Settings → Secrets and variables →
Actions* du dépôt :

- `CLOUDFLARE_API_TOKEN` — Cloudflare → My Profile → API Tokens → *Edit
  Cloudflare Workers*
- `CLOUDFLARE_ACCOUNT_ID` — affiché dans l'URL du tableau de bord Cloudflare

Chaque push sur `main` lance alors typecheck → lint → tests → build → déploiement.

**Depuis votre machine.**

```bash
npm run cf:deploy
```

> **Sur Windows**, cette commande échoue avec `EPERM: operation not permitted,
> symlink` : le bundler d'OpenNext crée des liens symboliques, que Windows
> refuse par défaut. Une seule des trois options suffit, définitivement :
>
> - activer le **mode développeur** (Paramètres → Confidentialité et sécurité →
>   Espace développeurs) — le plus simple, à faire une fois ;
> - lancer la commande depuis un terminal **administrateur** ;
> - laisser la CI GitHub déployer (son runner est sous Linux).

### 6. Vérifier

```bash
curl https://<votre-worker>.workers.dev/api/health
# {"status":"ok","products":6}
```

---

## Images et quota de la base

Les images téléversées sont des lignes de la table `MediaObject`, donc elles
consomment le quota Neon. Le budget est tenu par `src/server/domain/image-policy.ts`,
respecté aux trois endroits qui écrivent une image :

- **le navigateur** ré-encode en WebP (1600 px max, qualité 82) *avant* de
  téléverser — un Worker ne peut pas exécuter de bibliothèque d'images native,
  et le faire en JS coûterait du temps CPU facturé à chaque envoi ;
- **le seed** fait la même chose avec sharp (dépendance de développement) ;
- **le serveur** refuse tout ce qui dépasse le plafond, quel que soit l'envoyeur.

Ce que cela donne en pratique :

| | Taille | Images dans 500 Mo |
| - | ------ | ------------------ |
| Images du seed, après compression | 68 Ko en moyenne | ~7 500 |
| Plafond serveur (`MAX_STORED_BYTES`) | 600 Ko | **~850 garanties** |

Le seed compresse ses 12 images de 2 900 Ko à 810 Ko, soit **72 % de moins**.
Pour aller plus loin, baisser `MAX_IMAGE_DIMENSION` ou `IMAGE_QUALITY` dans
`image-policy.ts` : les trois écritures suivent automatiquement.

---

## Bilinguisme (FR / AR)

Deux sources de texte, jamais mélangées :

| Type de texte | Où il vit | Traduit par |
| ------------- | --------- | ----------- |
| Chrome d'interface (boutons, libellés, messages) | `front-end/src/lib/i18n/dictionaries/{fr,ar}.ts` | Le dictionnaire de la locale |
| Données de la boutique (produits, catégories, blocs éditoriaux, wilayas) | Colonnes `*Ar` en base, saisies dans le back-office | `pick()` — `src/lib/i18n/localize.ts` |

Règles :

- **Aucune traduction en dur dans un composant.** Pas de
  `locale === "ar" ? "..." : "..."` : utiliser `t.*` pour l'interface et
  `pick(locale, valeur, valeurAr)` pour une colonne de la base.
- La locale vit dans **un seul** endroit : le cookie `pcstore39_locale`, lu
  côté serveur pour rendre `<html lang dir>` dès le premier octet.
- Une colonne `*Ar` vide **retombe sur le français** : jamais de texte vide.
- Le back-office est **français uniquement** ; les messages d'erreur de l'API
  sont écrits en français puis traduits à la sortie selon l'en-tête `x-locale`
  (`src/server/domain/messages.ts`).

---

## À savoir : le relais Telegram

Le formulaire de contact relaie les messages vers Telegram **depuis le
navigateur**, comme la maquette de référence. Le token du bot et l'identifiant
de conversation sont modifiables dans Admin → Paramètres plutôt que codés en
dur, mais ils sont **servis à la page et donc lisibles par quiconque ouvre les
outils de développement**. Utilisez un bot dédié à cet usage, et laissez les
champs vides pour désactiver le relais.

---

## Intégration continue

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) exécute
`typecheck` → `lint` → `test` → `build` sur chaque push et PR vers `main`, puis
déploie sur Cloudflare depuis `main`. Renseignez les secrets `CLOUDFLARE_API_TOKEN`
et `CLOUDFLARE_ACCOUNT_ID` dans les paramètres du dépôt.

Déployer depuis la CI est aussi la façon la plus simple de contourner le
problème de liens symboliques sous Windows : le runner est sous Linux.

---

## Commandes utiles

```bash
cd front-end

npm run dev              # site + API en watch (:3000)
npm run build            # build Next.js
npm run cf:build         # build du Worker (OpenNext)
npm run cf:preview       # exécuter le Worker localement
npm run cf:deploy        # déployer sur Cloudflare

npm test                 # tests unitaires (vitest)
npm run typecheck        # vérification de types
npm run lint             # eslint

npm run prisma:migrate   # créer/appliquer une migration (dev)
npm run prisma:deploy    # appliquer les migrations (production)
npm run prisma:seed      # re-seed (idempotent)
npm run prisma:studio    # explorer la base
```

### Docker (base de données uniquement)

Projet `pcstore39_hono_ver` — conteneur `pcstore39_hono_ver_postgres`, volume
`pcstore39_hono_ver_pgdata`, port `5435`.

```bash
docker compose up -d              # démarrer Postgres
docker compose ps                 # état + port publié
docker compose logs -f postgres   # suivre les logs
docker compose stop               # arrêter (données conservées)
docker compose down               # supprimer le conteneur (volume conservé)
docker compose down -v            # tout supprimer, données comprises
```

Sauvegarder / restaurer la base :

```bash
docker compose exec -T postgres pg_dump -U pcstore39 -d pcstore39 --clean --if-exists > dump.sql
docker compose exec -T postgres psql   -U pcstore39 -d pcstore39 < dump.sql
```

> Faites une sauvegarde avant tout `docker compose down -v`. Les images
> téléversées depuis le back-office vivent dans la table `MediaObject` : le seed
> ne les recrée pas, seules les images livrées dans `public/images/` reviennent.

> Le conteneur `pcstore39_postgres` et le volume `pcstore39_pcstore39_pgdata`
> qui subsistent appartiennent à l'ancienne stack NestJS (son compose portait le
> même nom de projet, `pcstore39`). Ils ne sont **pas** utilisés ici et ne
> doivent pas être supprimés sans vérifier que cette stack n'en a plus besoin.
