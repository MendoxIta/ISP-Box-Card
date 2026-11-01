# ISP Box Card

Carte Lovelace sombre pour les box Internet françaises, distribuable comme Dashboard HACS. Projet indépendant, sans affiliation avec les opérateurs. **Version 0.2.0 : profils d’intégration et détection des données réelles.**

## Ce qui change selon l’opérateur

La carte conserve son identité visuelle mais adapte ses informations aux entités effectivement exposées. Elle ne se connecte jamais directement aux API des box et ne contient aucun identifiant opérateur.

| Profil | Affichage adapté | Association |
|---|---|---|
| Free / `freebox` Core | Trafic courant, IPv4, fonctionnement, températures, ventilation, appels manqués, firmware ; Wi-Fi global et redémarrage | Registres appareil/entités HA, noms personnalisés acceptés |
| Orange / `livebox` HACS Cyr-ius | État WAN, IPv4, optique selon modèle, fonctionnement, volumes cumulés, synchronisation DSL, trafic identifié par interface, clients suivis ; Wi-Fi principal/invité et redémarrage | Registres HA ; aucune interface choisie arbitrairement comme WAN |
| SFR / `sfr_box` Core | État WAN et ligne DSL/FTTH, synchronisation DSL, diagnostics activés, VoIP, firmware ; redémarrage si exposé | Registres HA ; pas de faux contrôle Wi-Fi |
| Bouygues / `bbox` Core historique | Trafic courant, bande passante disponible, démarrage timestamp, nombre de démarrages | **Manuelle** : pas de contrat de registre/unique_id fiable pour ces anciens capteurs |

Inventaire exact, versions auditées, unités, réserves matérielles et sources : **[docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)**. Sosh/RED utilisent ici le profil de leur matériel et de son intégration, pas une garantie commerciale universelle.

**Synchronisation, trafic courant et volumes cumulés ne sont pas interchangeables.** Les taux d’interface Livebox restent nommés par interface ; les volumes en B/MB/GB ne deviennent jamais des Mbit/s. Les températures CPU Freebox ne sont pas un taux de charge CPU. Un tracker `home` n’établit pas la connexion WAN.

## Installation et mise à jour

1. Copier `dist/isp-box-card.js` dans `/config/www/isp-box-card.js` sur HA. Conserver l’image et les autres fichiers déjà présents.
2. Déclarer ou mettre à jour **une seule** ressource Dashboard de type Module JavaScript : `/local/isp-box-card.js?v=0.2.0`. Ne pas ajouter une seconde ressource si l’ancienne existe.
3. Recharger complètement le navigateur. Le module embarque ses profils : aucun autre JS, npm ou accès CDN n’est nécessaire dans HA.
4. Ajouter **ISP Box Card**, choisir le fournisseur, puis l’appareil box. Si une seule box correspond, ou si les entités explicites désignent un seul appareil, la sélection est automatique.

```yaml
type: custom:isp-box-card
provider: free
model: Freebox Ultra
auto_detect: true
show_missing: false
hide_public_ip: false
# Facultatif : à choisir dans l’éditeur si plusieurs box sont présentes.
# device_id: identifiant_du_registre_ha
```

Exemples : `examples/freebox-ultra.yaml`, `freebox-ultra-readonly.yaml`, `livebox.yaml`, `sfr-box.yaml`, `bbox.yaml`. Les identifiants Bbox d’exemple sont des placeholders à remplacer, pas des entités annoncées comme découvertes.

### Détection fiable et limites

- La détection lit `config/entity_registry/list` et `config/device_registry/list` via la connexion HA authentifiée. Aucune commande de box n’est exécutée pendant cette lecture.
- Les associations utilisent la plateforme, l’appareil, la clé de traduction et/ou le `unique_id` du composant. **Aucun nom `entity_id` n’est deviné** ; les entités renommées restent reconnues.
- Plusieurs appareils ne sont jamais fusionnés automatiquement. Choisir `device_id` si la sélection est ambiguë.
- Les entités désactivées ne sont ni activées ni affichées comme de faux capteurs. Les événements de modification des registres actualisent les associations automatiques, y compris après un renommage. Si leur abonnement est refusé, recharger la page ; une modification de configuration retente aussi une lecture initialement échouée. Les associations explicitement saisies restent littérales et doivent être corrigées manuellement après renommage.
- `auto_detect: false` permet une configuration entièrement explicite. Si la lecture du registre est refusée, les associations explicites restent utilisables.
- `entities`, `attributes` et les diagnostics YAML explicites restent prioritaires. Changer d’opérateur dans l’éditeur réinitialise les associations, le modèle, l’image et les plafonds de l’ancien opérateur pour éviter un mélange.
- Sans capteur fiable de connexion, le bandeau indique le profil d’intégration plutôt qu’un faux statut « Connectée ».

## Affichage et données complémentaires

- `hide_public_ip: false` affiche directement l’IPv4 ; le clic permet encore de la masquer. Il s’agit d’une protection visuelle, pas d’une permission HA. Les captures connectées ne sont pas destinées à une publication automatique.
- `show_missing: false` est recommandé : seuls les blocs associés apparaissent. `true` n’affiche des emplacements vides que pour les capacités nominales du profil ; il ne réintroduit plus les blocs incompatibles d’un autre opérateur.
- `show_controls: false` retire les commandes et bloque leur exécution depuis le composant. Les droits HA restent la véritable frontière d’autorisation.
- `download_max` / `upload_max`, nombres positifs en Mbit/s, règlent l’échelle des jauges, pas un débit mesuré ou garanti. Sans maximum explicite, un capteur Bbox `download_limit` / `upload_limit` associé peut fournir cette échelle. Le trafic réel remplit l’arc ; sans maximum configuré, la mesure reste lisible sans progression arbitraire.
- La durée depuis un démarrage timestamp utilise le fuseau de HA, pas celui du navigateur. Sans fuseau exploitable, une date explicite est conservée.
- Un bloc « Informations de la box » rassemble les diagnostics effectivement détectés et le firmware disponible. L’historique nominatif des appels, les listes de baux et les numéros de série ne sont pas affichés automatiquement.

### Associations explicites disponibles

| Clé dans `entities` | Sémantique |
|---|---|
| `connection` | État WAN fiable : `on/off`, `up/down`, `connected/disconnected`, `online/offline` |
| `download`, `upload` | Trafic courant, jamais synchronisation de ligne |
| `sync_download`, `sync_upload` | Synchronisation DSL, affichée distinctement dans les informations |
| `download_limit`, `upload_limit` | Bande passante disponible, notamment Bbox, pas une synchronisation DSL supposée |
| `public_ip`, `uptime` | IPv4 et durée/date de démarrage |
| `optical_rx`, `optical_tx` | Puissances optiques, en général dBm |
| `devices` | Total uniquement si une source exhaustive existe |
| `ethernet_devices`, `wifi_devices` | Compteurs suivis ; sur Livebox, dépendent des options de tracking |
| `missed_calls`, `reboots` | Appels manqués non lus et compteur de démarrages |
| `wifi`, `guest_wifi` | `switch.*` uniquement |
| `reboot` | `button.*` uniquement |

Unités reconnues pour les taux : `bit/s`, `b/s`, `kbit/s`, `kbps`, `Mbit/s`, `Mbps`, `Gbit/s`, `Gbps`, `B/s`, `kB/s`, `KB/s`, `MB/s`, `GB/s`. La casse B/b est respectée et l’unité HA affichée est utilisée : pas de double conversion d’unité suggérée.

Les attributs nommés sont possibles pour `public_ip`, `uptime`, `ethernet_devices` et `wifi_devices`. La détection Freebox utilise `IPv4`/`uptime` du tracker routeur ; Livebox utilise notamment `wan_ipaddress`, `wired clients`, `wireless clients` de son capteur WAN.

Diagnostics manuels supplémentaires, en lecture seule :

```yaml
diagnostics:
  - entity: sensor.mon_capteur_temperature
    name: Température du module
  - entity: sensor.mon_capteur_duree
    name: Durée de connexion
    kind: duration
  - entity: binary_sensor.mon_etat_ligne
    name: Liaison
```

Formats : `text` (défaut, unité native conservée), `rate` (conversion Mbit/s), `duration` (unités `s/min/h/d`), `binary`. Une propriété `attribute` et éventuellement `unit` permettent une extraction explicite sans fabriquer de capteur backend.

Débits Ethernet par port : uniquement si une autre source réelle existe, via `ports: [{name: Port 1, download: sensor.mon_rx, upload: sensor.mon_tx}]`. Aucun profil audité ne promet ces compteurs et les anciens ports sans entités sont masqués.

## Visuel local

```yaml
image: /local/isp-box-card/freebox-ultra.png
```

Utiliser une photo personnelle ou un visuel dont l’usage est autorisé, copié dans `/config/www/`. Seuls les chemins locaux absolus sont acceptés. Aucune image opérateur n’est incorporée dans le module ni dans l’archive de code public.

Préparation facultative du visuel Freebox pour usage local : `npm ci`, puis `node scripts/prepare-freebox-image.mjs` (Chromium système ou Playwright requis). Copier le PNG obtenu vers le chemin HA ci-dessus. Le script recadre uniquement les marges transparentes ; le visuel de Free ne devient pas un contenu sous licence MIT.

## GitHub et HACS

Le dépôt doit être nommé **`isp-box-card`**. Versionner les sources, `dist/isp-box-card.js`, `hacs.json`, les exemples et les tests. Le fichier distribué est autonome : le dossier `src/` n’est pas chargé par HA.

Ajouter le dépôt comme dépôt personnalisé HACS, catégorie Dashboard, puis vérifier la ressource `/hacsfiles/isp-box-card/isp-box-card.js`. Ne pas charger en même temps cette ressource et une version `/local/`. L’ajout au catalogue HACS par défaut est une démarche distincte. Aucun dépôt ni release n’a été publié automatiquement.

## Développement et vérification

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:browser
# Archive publique vérifiée, sans données connectées ni artwork :
python3 scripts/package-release.py
python3 -m http.server 8129 --bind 127.0.0.1
```

- `/demo/providers.html` : exemples **synthétiques** distincts des quatre intégrations, avec le même mécanisme de registre que la carte.
- `/demo/index.html` : banc de régression des associations manuelles, pas une promesse de capacités de chaque box.
- Tests : profils renommés, multi-box, sources désactivées, synchronisation séparée du trafic, volumes conservés, état `problem`, permissions refusées et responsive.
- Freebox Ultra : nouveaux diagnostics et éditeur natif vérifiés avec les véritables états et registres de HA 2026.10.4, sans appels de services.
- Autres fournisseurs : audit de code et tests synthétiques uniquement, **pas de validation matérielle**. Les versions amont et modèles peuvent modifier les capacités.
- Non vérifié : exécution réelle Wi-Fi/redémarrage, installation via HACS/GitHub et Safari iPhone.

Pour rejouer l’essai connecté, définir `HASS_URL`/`HASS_TOKEN` dans l’environnement ou un `.env` exclu de Git (`HASS_ENV_FILE` pour un fichier externe), puis `node scripts/test-provider-home-assistant.mjs`. Cet essai suppose l’onglet `/dashboard-family-test/internet` et son ancien module déjà déclarés : la nouvelle version est fournie **uniquement à cette session de navigateur**. Il ne modifie ni le fichier `www` distant, ni les dashboards, ni les ressources. Le rapport précise cette limite ; les captures sont dans `artifacts/provider-adaptation/`, exclues du dépôt.

Licence MIT pour le code. Noms commerciaux et visuels restent la propriété de leurs détenteurs.
