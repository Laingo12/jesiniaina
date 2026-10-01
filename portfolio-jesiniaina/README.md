# portfolio-jesiniaina

Portfolio statique (HTML/CSS/JS, **aucune compilation**) avec back-office en ligne.

- Site public : **https://jesiniaina.netlify.app**
- Back-office : **https://jesiniaina.netlify.app/admin**

## Structure

```
portfolio-jesiniaina/
├── index.html          ← la page (une section = un bloc « SECTION : … »)
├── 404.html            ← page « introuvable »
├── netlify.toml        ← réglages Netlify (en-têtes, cache, sécurité)
├── robots.txt          ← interdit l'indexation de /admin
├── admin/              ← back-office (/admin)
│   ├── index.html · admin.css · admin.js
│   └── admin-config.js ← dépôt GitHub + adresse du site (à remplir une fois)
└── assets/
    ├── css/            main.css + base/ + components/ (dont styles.css = toutes les variantes) + sections/
    ├── js/             config.js (tous les réglages) · theme.js · content.js · extras.js · nav · image-slots · reveal · links · main
    ├── images/         hero · smart-kids · cam · nexoria · projets · formation · aiky · temoignages · logos
    └── docs/           CV PDF
```

## 1. Mise en ligne (une seule fois, ≈ 15 min)

Principe : le site est stocké sur **GitHub** ; **Netlify** le publie automatiquement à chaque modification.
Le back-office `/admin` écrit sur GitHub avec un **jeton d'accès personnel** : sans ce jeton, personne ne peut rien modifier.

### Étape 1 — Mettre le code sur GitHub
1. Créer un compte sur https://github.com (gratuit) si besoin.
2. **New repository** → nom `portfolio-jesiniaina` → **Private** (conseillé) → *Create repository*.
3. Sur la page du dépôt : **uploading an existing file** → glisser **le contenu** du dossier `portfolio-jesiniaina`
   (les fichiers `index.html`, `netlify.toml`… et les dossiers `admin`, `assets` à la racine) → **Commit changes**.
   *(Développeurs : `git init && git add . && git commit -m "Portfolio" && git push` fonctionne aussi.)*

### Étape 2 — Brancher Netlify
1. https://app.netlify.com → **Add new site → Import an existing project → GitHub** → autoriser → choisir `portfolio-jesiniaina`.
2. Réglages de build : **Branch** `main` · **Build command** *(vide)* · **Publish directory** `.` → **Deploy**.
3. **Site configuration → Change site name** → `jesiniaina` → l'adresse devient **https://jesiniaina.netlify.app**
   (si le nom est pris, choisir une variante et mettre à jour `siteUrl` dans `admin/admin-config.js`).

### Étape 3 — Préparer l'accès au back-office
1. Dans `admin/admin-config.js`, renseigner `repo: "votre-compte/portfolio-jesiniaina"` (commit sur GitHub).
   La page de connexion ne demandera alors plus que le jeton.
2. Créer le jeton : GitHub → photo de profil → **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**
   - Expiration : 1 an · **Repository access** : *Only select repositories* → `portfolio-jesiniaina`
   - **Permissions → Contents : Read and write** → *Generate* → copier le jeton (`github_pat_…`).
3. Ouvrir **https://jesiniaina.netlify.app/admin**, coller le jeton, cocher « Se souvenir de moi » → **Se connecter**.

> 🔐 Le jeton ne donne accès qu'à ce dépôt. Ne le partagez pas. S'il est perdu ou compromis : GitHub → Fine-grained tokens → *Revoke*, puis en créer un nouveau.
> Il est mémorisé uniquement dans le navigateur de l'ordinateur utilisé (bouton ⏻ pour se déconnecter et l'effacer).

## 2. Mettre à jour le portfolio (au quotidien)

1. Aller sur **/admin** (connexion automatique si « Se souvenir de moi » était coché).
2. Modifier : deux aperçus montrent le résultat immédiatement (rien n'est encore public) :
   - **🔍 Aperçu détaillé** : quand vous cliquez sur un champ (texte, couleur, image, style…), il défile jusqu'à
     l'élément concerné et l'**encadre en orange avec son nom**. Vue ordinateur (mise à l'échelle) ou mobile.
   - **🗺 Aperçu global** : miniature de toute la page ; l'élément modifié y est repéré et le rectangle bleu montre
     la zone visible dans l'aperçu détaillé. Un clic dans la miniature y emmène l'aperçu détaillé.
   - **Dans l'autre sens** : cliquez sur un texte, une image ou un bouton dans un aperçu → le bon champ s'ouvre dans l'admin.
3. Cliquer sur **🚀 Publier** : toutes les modifications partent en **un seul envoi**. Le statut affiche
   « Netlify met le site à jour… » puis **« En ligne ! »** (≈ 30 s à 1 min).

- **↺ Annuler** : abandonne les modifications non publiées.
- **Brouillon** : si la page est fermée avant de publier, les textes et réglages sont proposés à la reprise
  (les nouvelles images, elles, sont à rechoisir).
- **Historique** : chaque publication est une version sur GitHub (onglet *Commits*) ; Netlify permet aussi de revenir
  à une version précédente en un clic (*Deploys → Publish deploy*).
- **💾** télécharge une copie de sauvegarde des réglages.

| Onglet | Ce qu'on peut faire |
|---|---|
| 🔗 **Liens** | E-mail, WhatsApp, LinkedIn, CV en PDF. Un champ vide masque le bouton. |
| ✨ **Style** | **7 thèmes prêts** (Charte CV, Corporate, Prestige, Tech néon, Verre moderne, Créatif 3D, Minimal) puis réglage fin : mode clair / sombre / automatique · finition mat, satinée, lumineuse ou verre · boutons plat 2D, relief 3D, dégradé, contour, néon, verre ou doux · forme pilule / arrondie / carrée · bordures · photos · fond · animations · en-tête partagé / centré / immersif · menu · espacement · taille du texte · majuscules · effets (barre de progression, retour en haut, compteurs animés, WhatsApp flottant, menu fixe). |
| 🎨 **Couleurs** | 8 couleurs par rôle (principale, accent, fonds, textes…) avec leur **nom calculé automatiquement** (ex. « Brun rouille », « Violet foncé »), police du texte, police des titres, arrondi des cartes. |
| 🧩 **Sections** | Afficher / masquer chaque section ou bloc. Le lien du menu disparaît aussi. |
| ✏️ **Textes** | Tous les textes du site, rangés par section, avec recherche. Champ vide = élément masqué ; « ↺ Rétablir » = texte d'origine. |
| 🖼 **Images** | Une photo par emplacement. Les photos lourdes sont **optimisées automatiquement** (WebP, 2000 px max). |

**Travailler sur l'ordinateur (sans Internet)** : ouvrir `admin/index.html` du dossier (Edge / Chrome) →
**« Choisir le dossier du portfolio »** → sélectionner **ce même dossier** (celui qui contient `index.html` et `admin`).
Chaque modification y est **enregistrée automatiquement** (pas de bouton « Publier »).
Le back-office vérifie que le dossier choisi est bien le sien : s'il s'agit d'une autre copie, il refuse et l'indique
(c'est ce qui faisait croire que « rien ne changeait »). Conseil : garder une seule copie dézippée du portfolio.
Pour mettre ensuite ces changements en ligne, envoyer les fichiers modifiés sur GitHub.

## 2. Comment ça marche (pour les développeurs)

- **Back-office** (`admin/admin.js`) : deux « backends » avec la même interface (`readText`, `readBlob`, `list`, `publish`) :
  **GitHub** (API REST ; `publish` crée un seul commit via l'API Git Data : blobs → tree → commit → ref) et **dossier local**
  (File System Access API). L'aperçu (iframe `../index.html`, même origine) lit le brouillon via
  `window.parent.PORTFOLIO_PREVIEW_CONFIG` (voir le début de `theme.js`) ; les images non publiées sont des URL `blob:`.
  Après publication, l'admin interroge `assets/js/config.js` en ligne jusqu'à y trouver le tampon `publishedAt`.
- Tous les réglages sont dans `assets/js/config.js` (`theme`, `style`, `sections`, `texts`, `images` + liens).
  `index.html` n'est **jamais modifié** par le back-office : il garde les textes d'origine.
- `theme.js` (dans `<head>`) applique couleurs, polices, arrondis et réglages de style sans « flash ».
  Les réglages deviennent des attributs sur `<html>` (`data-mode`, `data-finish`, `data-btn`, `data-border`, `data-bg`,
  `data-hero`, `data-nav`…) ; toutes les variantes sont dans `assets/css/components/styles.css`.
  Mode sombre : variables redéfinies dans `tokens.css` sous `html[data-mode="dark"]`.
- `extras.js` gère la barre de progression, le bouton retour en haut, le WhatsApp flottant, les compteurs animés
  et la liaison avec l'aperçu de l'admin (position de défilement).
- `content.js` (en fin de `<body>`) applique les textes et masque les sections. Les textes sont insérés en texte brut (pas de HTML).
- Le back-office **découvre automatiquement** ce qui est modifiable en lisant `index.html` :

| Attribut | Rôle |
|---|---|
| `data-edit="cle"` + `data-label="Nom affiché"` | Texte modifiable |
| `data-type="long"` | Paragraphe (zone de texte) |
| `data-type="lines"` | Retours à la ligne conservés (`<br>`) — ex. le nom du hero |
| `data-type="list"` | Une ligne = un élément enfant (même balise et classe que le premier enfant) |
| `data-section="cle"` + `data-section-label` | Groupe de textes ; avec `data-optional`, peut être masqué |
| `data-img="assets/images/dossier/nom.jpg"` | Emplacement d'image |

➡️ Pour rendre un nouveau texte modifiable, il suffit d'ajouter `data-edit` et `data-label` dans `index.html` : il apparaît tout seul dans l'admin.
⚠️ Ne pas renommer une clé `data-edit` existante : le texte personnalisé associé serait perdu.

## 3. Méthode manuelle (sans back-office)

### Liens
Dans `assets/js/config.js` : `cv`, `linkedin`, `email`, `whatsapp`. Une valeur vide masque le bouton.

### Images
1. Déposer la photo dans le **dossier de la section** (ex. `assets/images/hero/`), avec n'importe quel nom et extension.
2. Dans `config.js`, section `images`, écrire le nom exact : `"hero/portrait": "ma-photo.png",`
3. Actualiser la page (Ctrl + F5).

Raccourci : si le fichier porte le nom de la clé (ex. `portrait.jpg`), rien à écrire.

| Clé | Dossier | Contenu |
|---|---|---|
| `hero/portrait` | `assets/images/hero/` | Portrait professionnel (celui du CV, en haute définition) |
| `smart-kids/classe` | `assets/images/smart-kids/` | SMART KIDS — élèves en classe |
| `smart-kids/activite` | `assets/images/smart-kids/` | Activité pédagogique |
| `smart-kids/equipe` | `assets/images/smart-kids/` | Équipe enseignante |
| `logos/smart-kids` | `assets/images/logos/` | Logo SMART KIDS |
| `cam/campus` | `assets/images/cam/` | Visuel / perspective du campus CAM (Ivandry) |
| `nexoria/equipe` | `assets/images/nexoria/` | NEXORIA — équipe ou atelier client |
| `nexoria/plateforme` | `assets/images/nexoria/` | Capture : plateforme / tableau de bord IA |
| `nexoria/nexobot` | `assets/images/nexoria/` | Capture : chatbot WhatsApp NEXOBOT |
| `logos/nexoria` | `assets/images/logos/` | Logo NEXORIA |
| `projets/iscam-assist` | `assets/images/projets/` | Capture ISCAM ASSIST |
| `projets/escm` | `assets/images/projets/` | Visuel projet ESCM |
| `projets/academic-lab` | `assets/images/projets/` | Visuel NEXORIA Academic Lab |
| `formation/formation` | `assets/images/formation/` | Photo en situation de formation |
| `aiky/aiky` | `assets/images/aiky/` | Photo programme AIKY (avec accord des familles) |
| `temoignages/temoin-1` à `-3` | `assets/images/temoignages/` | Photos des témoignages |

### Style
Bloc `style` de `config.js` (valeurs possibles indiquées en commentaire). Exemple : `buttons: "3d"`, `mode: "sombre"`.

### Textes, sections, couleurs
- Textes : `texts` dans `config.js` (`"hero.accroche": "…"`), ou directement dans `index.html`.
- Sections : `sections` dans `config.js` (`"temoignages": false`).
- Couleurs par défaut : `assets/css/base/tokens.css` ; surcharges : `theme` dans `config.js`.
