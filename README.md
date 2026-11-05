# ISP Box Card

Une carte pour les tableaux de bord **Home Assistant**, dédiée aux box Internet françaises : **Freebox, Livebox, SFR Box et Bbox**.

Interface sombre, couleurs par opérateur et informations adaptées aux données de votre box. La carte utilise les entités déjà présentes dans Home Assistant : elle ne se connecte pas directement à votre compte opérateur.

Projet indépendant, sans affiliation avec les opérateurs.

<img width="844" height="1073" alt="image" src="https://github.com/user-attachments/assets/15ee4de3-f31b-4230-829f-65bf9eb469b4" />

## Compatibilité

**Installez et configurez d’abord l’intégration de votre box dans Home Assistant.** Installer la carte seule ne crée pas les capteurs nécessaires.

| Fournisseur | Intégration nécessaire | Association des entités |
|---|---|---|
| Free | Freebox, intégration officielle HA (`freebox`) | Automatique, ou manuelle |
| Orange / Sosh | [Livebox HACS de Cyr-ius](https://github.com/cyr-ius/hass-livebox-component) (`livebox`) | Automatique, ou manuelle |
| SFR / RED | SFR Box, intégration officielle HA (`sfr_box`) | Automatique, ou manuelle |
| Bouygues | Bbox, intégration officielle historique (`bbox`) | Manuelle |

Les données dépendent du modèle, du firmware et des entités activées : débits courants, IP, durée de fonctionnement, températures, ventilation, état de ligne, optique, Wi-Fi ou redémarrage.

**Toutes les box ne proposent pas les mêmes informations ni les mêmes commandes.** La synchronisation DSL est distinguée du trafic courant, et les volumes cumulés ne sont pas affichés comme des débits.

La carte a été vérifiée sur **Freebox Ultra**. Les autres profils reposent sur l’audit des intégrations et des tests synthétiques ; les retours sur matériel réel sont bienvenus. Sosh et RED utilisent le profil de leur intégration et de leur matériel, sans garantie de compatibilité avec tous les modèles.

Détails : [capacités et limites par intégration](docs/INTEGRATIONS.md).

## Installation

Choisissez **une seule** méthode : HACS ou installation manuelle. Il n’est pas nécessaire d’installer Node.js, npm ou les fichiers sources pour utiliser la carte.

### Méthode 1 — HACS, recommandée

[HACS](https://www.hacs.xyz/) doit déjà être installé dans Home Assistant.

1. Ouvrez **HACS** puis le menu **⋮ → Dépôts personnalisés**.
2. Ajoutez le dépôt :

   ```text
   https://github.com/MendoxIta/ISP-Box-Card
   ```

3. Choisissez le type **Dashboard** et ajoutez le dépôt.
4. Recherchez **ISP Box Card**, puis téléchargez la version souhaitée.
5. Vérifiez la ressource ajoutée dans **Paramètres → Tableaux de bord → ⋮ → Ressources**. Si ce menu n’apparaît pas, activez le **mode avancé** dans votre profil utilisateur.

   | Paramètre | Valeur |
   |---|---|
   | URL | `/hacsfiles/ISP-Box-Card/isp-box-card.js` |
   | Type | Module JavaScript |

   HACS peut ajouter un paramètre `?hacstag=…` : conservez l’URL qu’il génère. Si la ressource existe déjà, n’en ajoutez pas une seconde ; sinon, créez-la avec l’URL ci-dessus.

6. Rechargez complètement le navigateur, puis ajoutez la carte à un tableau de bord.

**Vous migrez depuis une installation manuelle ?** Retirez l’ancienne entrée de ressource `/local/isp-box-card.js?...` pour ne pas charger les deux versions en parallèle. Conservez vos configurations de carte et vos images locales.

### Méthode 2 — Installation manuelle

1. Téléchargez **`isp-box-card.js`** depuis les fichiers joints d’une [release](https://github.com/MendoxIta/ISP-Box-Card/releases). Si le fichier n’est pas joint, ouvrez [dist/isp-box-card.js](https://github.com/MendoxIta/ISP-Box-Card/blob/main/dist/isp-box-card.js) et utilisez **Download raw file**.
2. Copiez ce fichier sur Home Assistant :

   ```text
   /config/www/isp-box-card.js
   ```

   Créez le dossier `www` s’il n’existe pas. Le fichier JavaScript suffit : ne copiez pas le projet complet.

3. Dans **Paramètres → Tableaux de bord → ⋮ → Ressources**, ajoutez une ressource :

   | Paramètre | Valeur |
   |---|---|
   | URL | `/local/isp-box-card.js?v=0.3.1` |
   | Type | Module JavaScript |

   Activez le **mode avancé** de votre profil si le menu Ressources n’est pas visible.

4. Si vous venez de créer le dossier `www` pour la première fois et que `/local/` n’est pas accessible, redémarrez Home Assistant. Sinon, un rechargement complet du navigateur suffit généralement.
5. Ajoutez la carte à un tableau de bord.

## Ajouter et configurer la carte

1. Ouvrez votre tableau de bord et passez en mode **Modifier**.
2. Cliquez sur **Ajouter une carte**, puis recherchez **ISP Box Card**.
3. Choisissez votre fournisseur et, si nécessaire, l’appareil correspondant à votre box.
4. Vérifiez les entités associées et enregistrez.

Pour Freebox, Livebox et SFR, les entités compatibles peuvent être associées automatiquement. Si plusieurs box sont présentes, sélectionnez explicitement la bonne. Pour Bbox, renseignez les capteurs manuellement.

Vous pouvez aussi utiliser une carte manuelle en YAML :

```yaml
type: custom:isp-box-card
provider: free
model: Freebox Ultra
auto_detect: true
show_missing: false
hide_public_ip: true
```

| Fournisseur | Valeur de `provider` |
|---|---|
| Free | `free` |
| Orange / Sosh | `orange` |
| SFR / RED | `sfr` |
| Bouygues | `bouygues` |

### Options utiles

| Option | Effet |
|---|---|
| `model` | Personnalise le nom du modèle affiché |
| `hide_public_ip: true` | Masque l’IP à l’affichage ; un clic permet de la révéler |
| `hide_public_ip: false` | Affiche directement l’IP |
| `show_missing: false` | Masque les blocs sans source associée |
| `show_controls: false` | Masque et bloque les commandes depuis la carte |
| `download_max`, `upload_max` | Règlent l’échelle des jauges, en Mbit/s |
| `image` | Ajoute une image locale de votre box |

Les commandes disponibles dépendent de l’intégration. La carte demande confirmation avant un redémarrage ou une désactivation du Wi-Fi. Masquer une commande ou une IP ne remplace pas les permissions Home Assistant.

Exemples : [Freebox Ultra](examples/freebox-ultra.yaml) · [Freebox sans commandes](examples/freebox-ultra-readonly.yaml) · [Livebox](examples/livebox.yaml) · [SFR Box](examples/sfr-box.yaml) · [Bbox](examples/bbox.yaml).

Les identifiants fictifs présents dans les exemples doivent être remplacés par vos propres entités. Pour les associations manuelles, attributs et diagnostics supplémentaires : [configuration avancée](docs/CONFIGURATION.md).

### Ajouter une image de la box, facultatif

Copiez une image que vous êtes autorisé à utiliser dans :

```text
/config/www/isp-box-card/ma-box.png
```

Puis ajoutez à la configuration :

```yaml
image: /local/isp-box-card/ma-box.png
```

Les images opérateur ne sont pas fournies avec la carte. Elles restent indépendantes de l’installation et des mises à jour HACS. Seuls les chemins locaux absolus sont acceptés.

## Personnaliser le format et les couleurs

L’éditeur est organisé en quatre sections : **Box et connexion**, **Affichage et confidentialité**, **Apparence et format**, **Données avancées**. Dans **Apparence et format**, choisissez le format, ajustez les dimensions, puis ouvrez la palette souhaitée : **Fonds, textes et bordures**, **Couleurs des débits** ou **États et commandes**. Les sections ouvertes et le focus sont conservés pendant les modifications. Le bouton **Réinitialiser l’apparence** restaure le rendu par défaut sans modifier vos entités ni vos options réseau.

- **Complet** (`full`, défaut) : présentation illustrée habituelle.
- **Compact** (`compact`) : en-tête sans grande illustration et blocs plus denses, avec les mêmes mesures, diagnostics et commandes.

Exemple YAML :

```yaml
type: custom:isp-box-card
provider: free
layout: compact
show_missing: false
appearance:
  radius: 12
  gap: 10
  padding: 12
  colors:
    accent: "#7c3aed"
    background: "#f8fafc"
    surface: "#ffffff"
    text: "#172033"
    muted: "#475569"
    border: "#cbd5e1"
    download: "#0369a1"
    upload: "#15803d"
```

Les couleurs non renseignées conservent leur valeur par défaut ; sans accent personnalisé, la couleur suit l’opérateur. Les espacements sont adaptés aux petits écrans. Choisissez des couleurs suffisamment contrastées pour préserver la lisibilité. [Toutes les options d’apparence](docs/CONFIGURATION.md#apparence).

## Mise à jour

- **HACS** : installez la mise à jour proposée, puis rechargez complètement le navigateur. Conservez la ressource gérée par HACS.
- **Manuelle** : remplacez `/config/www/isp-box-card.js`, puis modifiez le paramètre de version dans la ressource existante, par exemple `?v=0.3.1` vers le numéro de la version installée. N’ajoutez pas une deuxième ressource.

Conservez vos images et la configuration de vos cartes. Consultez le [journal des versions](CHANGELOG.md) avant une mise à jour.

## Dépannage

### « Custom element doesn't exist: isp-box-card »

Vérifiez que le fichier JavaScript est accessible à l’URL de la ressource, que son type est **Module JavaScript** et que la ressource n’est déclarée qu’une seule fois. Rechargez ensuite complètement le navigateur ou videz son cache.

### La carte n’affiche pas certaines données

Vérifiez d’abord que l’intégration de la box fonctionne et que les entités attendues sont activées et disponibles dans Home Assistant. Certaines données ou commandes ne sont pas exposées par tous les modèles.

Si nécessaire, sélectionnez à nouveau le bon appareil, rechargez la page ou associez les entités manuellement. Les diagnostics désactivés ne sont pas activés automatiquement par la carte.

### L’image ne s’affiche pas

Vérifiez le chemin et la casse du nom du fichier. Un fichier placé dans `/config/www/isp-box-card/ma-box.png` doit être accessible via `/local/isp-box-card/ma-box.png` depuis votre navigateur connecté à Home Assistant.

## Signaler un problème

Ouvrez une [issue GitHub](https://github.com/MendoxIta/ISP-Box-Card/issues) avec le modèle de box, le nom et la version de l’intégration, les versions de Home Assistant et de la carte, ainsi qu’une description du problème.

Si vous partagez une configuration ou une capture, retirez vos tokens, mots de passe et données personnelles ; masquez notamment votre IP publique si vous ne souhaitez pas la publier.

## Licence

Code sous [licence MIT](LICENSE). Les marques et visuels restent la propriété de leurs détenteurs.
