# Configuration avancée

[Retour au guide d’installation](../README.md)

Ces options sont facultatives. Commencer par choisir le fournisseur et l’appareil dans l’éditeur visuel.

## Apparence

Ces options ne changent ni l’intégration utilisée, ni les capteurs ni les services appelés. Les configurations existantes sans `layout` ni `appearance` conservent le format complet et leur palette opérateur.

| Option | Valeurs |
|---|---|
| `layout` | `full` (défaut) ou `compact` |
| `appearance.radius` | Entier de 0 à 40 px ; 0 donne des angles droits |
| `appearance.gap` | Entier de 0 à 24 px entre les blocs |
| `appearance.padding` | Entier de 0 à 32 px pour les marges intérieures de la carte et des blocs |
| `appearance.colors` | Objet de couleurs au format `"#RGB"` ou `"#RRGGBB"` |

Les couleurs doivent être entre guillemets en YAML : sans guillemets, `#` commence un commentaire. Les couleurs CSS libres, les URL et les variables CSS ne sont pas acceptées. Dans l’éditeur visuel, les sélecteurs RGB sont convertis automatiquement en hexadécimal.

Rôles disponibles dans `appearance.colors` :

| Clé | Zone |
|---|---|
| `accent` | Marque, séparateur et halo opérateur |
| `background` | Fond principal et fond du bandeau |
| `surface` | Fond des blocs et des contrôles |
| `text` | Texte principal |
| `muted` | Texte secondaire et libellés |
| `border` | Bordures et séparateurs |
| `download` | Jauge descendante et repères bleus |
| `upload` | Jauge montante |
| `success` | État connecté, Wi-Fi actif et repères verts |
| `warning` | Repères d’information et avertissements |
| `danger` | Erreurs et commande de redémarrage |

Les styles sont limités à cette carte et ne modifient pas le thème HA ou les autres cartes. Le changement d’opérateur conserve les personnalisations explicites. Retirer une clé rétablit sa valeur par défaut ; le bouton de réinitialisation retire `layout` et `appearance` seulement.

Sur les cartes étroites, les marges et l’espacement sont plafonnés pour conserver la lisibilité. Le format compact retire l’illustration mais pas les mesures ni les commandes ; `show_controls: false` reste le réglage pour masquer les commandes. La largeur continue à dépendre du tableau de bord, et la hauteur du contenu : aucune hauteur fixe n’est imposée.

## Détection automatique et associations manuelles

- Freebox, Livebox et SFR : la carte utilise les registres appareil et entités de Home Assistant. Les associations reposent sur l’intégration, l’appareil et les identifiants internes, pas sur des noms d’entités supposés.
- Si plusieurs box sont présentes, sélectionner `device_id` dans l’éditeur. Les appareils ne sont pas fusionnés automatiquement.
- Les entités désactivées ne sont pas activées par la carte. Les modifications des registres actualisent les associations automatiques ; si l’abonnement aux événements est refusé, recharger la page.
- Les identifiants explicitement saisis dans `entities` restent prioritaires et doivent être corrigés manuellement après renommage.
- `auto_detect: false` permet une configuration entièrement manuelle. Si l’accès aux registres est refusé, les associations explicites restent utilisables.
- Bbox historique : utiliser les associations manuelles, sans détection fondée sur les noms.
- Changer d’opérateur dans l’éditeur réinitialise les associations, le modèle, l’image et les plafonds de l’ancien profil.

## Clés disponibles dans `entities`

| Clé | Usage |
|---|---|
| `connection` | État WAN fiable : `on/off`, `up/down`, `connected/disconnected`, `online/offline` |
| `download`, `upload` | Trafic courant, jamais synchronisation de ligne |
| `sync_download`, `sync_upload` | Synchronisation DSL, affichée distinctement dans les informations |
| `download_limit`, `upload_limit` | Bande passante disponible, notamment Bbox |
| `public_ip`, `uptime` | IPv4 et durée/date de démarrage |
| `optical_rx`, `optical_tx` | Puissances optiques, généralement en dBm |
| `devices` | Total uniquement si la source est exhaustive |
| `ethernet_devices`, `wifi_devices` | Compteurs de clients ; sur Livebox, dépendent du suivi activé |
| `missed_calls`, `reboots` | Appels manqués non lus et compteur de démarrages |
| `wifi`, `guest_wifi` | Entités `switch.*` uniquement |
| `reboot` | Entité `button.*` uniquement |

Exemple d’associations explicites — **remplacer les identifiants fictifs par les entités réelles** :

```yaml
type: custom:isp-box-card
provider: free
auto_detect: false
entities:
  download: sensor.mon_debit_descendant
  upload: sensor.mon_debit_montant
  public_ip: device_tracker.ma_freebox
  uptime: device_tracker.ma_freebox
attributes:
  public_ip: IPv4
  uptime: uptime
```

Les attributs nommés sont acceptés pour `public_ip`, `uptime`, `ethernet_devices` et `wifi_devices`. La détection Freebox utilise `IPv4` et `uptime` du tracker routeur. Livebox utilise notamment `wan_ipaddress`, `wired clients` et `wireless clients` du capteur WAN.

## Unités et jauges

Unités de taux reconnues : `bit/s`, `b/s`, `kbit/s`, `kbps`, `Mbit/s`, `Mbps`, `Gbit/s`, `Gbps`, `B/s`, `kB/s`, `KB/s`, `MB/s`, `GB/s`. La casse B/b est respectée et l’unité de l’état HA est utilisée pour la conversion.

`download_max` et `upload_max` définissent des plafonds positifs en Mbit/s pour les jauges. Ce sont des échelles d’affichage, pas des vitesses mesurées ou garanties. Sans plafond explicite, un capteur Bbox `download_limit` ou `upload_limit` associé peut fournir cette échelle ; sans échelle disponible, aucune progression arbitraire n’est inventée.

La durée depuis un timestamp de démarrage utilise le fuseau configuré dans HA, y compris les changements d’heure. Sans fuseau exploitable pour une date locale, la carte conserve une date explicite.

## Diagnostics supplémentaires

Les diagnostics sont en lecture seule. Ils ne créent pas de nouveaux capteurs dans Home Assistant.

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

Formats : `text` (défaut, unité native conservée), `rate` (conversion en Mbit/s), `duration` (unités `s/min/h/d`) et `binary`. Une propriété `attribute` et éventuellement `unit` permettent une extraction explicite. Les attributs numériques d’un binary sensor restent numériques, sauf demande explicite d’interprétation binaire.

Les diagnostics YAML explicites sont prioritaires sur les diagnostics automatiques.

## Débits Ethernet par port

Utiliser cette configuration uniquement si une source fournit réellement ces mesures. Aucun profil audité ne promet de débits par port ; les ports sans entités sont masqués.

```yaml
ports:
  - name: Port 1
    download: sensor.mon_port_rx
    upload: sensor.mon_port_tx
```

## Commandes et confidentialité

`show_controls: false` masque et bloque les commandes depuis ce composant ; ce n’est pas un changement des permissions HA. La carte demande confirmation avant redémarrage ou désactivation du Wi-Fi.

`hide_public_ip: true` masque l’IP à l’affichage ; le clic permet de la révéler. Ce masquage visuel n’est pas un mécanisme d’autorisation. Vérifier les informations affichées avant de publier une capture.

L’historique nominatif des appels, les listes de baux et les numéros de série ne sont pas affichés automatiquement. Une température CPU Freebox ne représente pas une charge CPU ; un tracker `home` ne prouve pas une connexion WAN.

Pour les capacités par intégration, les réserves matérielles et les sources : [inventaire des intégrations](INTEGRATIONS.md).
