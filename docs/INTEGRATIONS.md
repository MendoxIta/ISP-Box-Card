# Profils d’intégration et sources — ISP Box Card 0.2.0

## Versions et portée

Base de l’audit : **Home Assistant Core 2026.10.4**, et **Livebox HACS Cyr-ius 2.6.0**, commit `30c75a0993e625dec8343204edff76073cb2f0fc`. Ce document distingue les contrats de code des données effectivement activées sur un appareil. Une API présente dans un routeur ne devient pas automatiquement une entité HA.

La carte implémente une lecture des registres HA pour Freebox, SFR et Livebox, et un mapping manuel pour Bbox. Elle n’ajoute pas d’intégration backend, ne demande aucun identifiant opérateur et n’active aucune entité désactivée. Seule la Freebox Ultra de l’instance de test a fait l’objet d’une vérification connectée ; les autres profils ont des fixtures synthétiques.

## Freebox — `freebox`, Core

- `rate_down` / `rate_up` sont du **trafic courant**, en `kB/s`. Les températures et ventilateurs sont découverts dynamiquement selon l’API du modèle ; les capteurs CPU éventuels sont des températures, pas une charge CPU.[1]
- Le tracker routeur porte notamment les attributs exacts `IPv4`, `IPv6`, `uptime`, `connection_type` et `firmware_version`. `uptime` est une date de démarrage calculée. Le routeur est inséré avec `active=True` : `home` ne prouve donc pas l’état WAN.[2]
- `missed` est un nombre d’appels manqués nouveaux/non lus. Ses attributs peuvent contenir les noms des appelants : la carte n’en affiche que le compteur. Les partitions peuvent fournir un pourcentage d’espace libre ; ce n’est pas un volume de trafic.[1]
- Le switch `wifi` pilote la configuration Wi-Fi globale ; ce n’est pas un switch invité séparé.[9]
- Les boutons exposés sont `reboot` et `mark_calls_as_read`. La carte ne propose automatiquement que le redémarrage ; elle n’acquitte pas le journal des appels.[10]

**Affichage implémenté** : IPv4, durée, trafic descendant/montant, températures et ventilation activées, compteur d’appels, firmware, état RAID si présent, partitions des disques enfants explicitement rattachés au routeur. Aucun compteur total de clients, puissance optique ou débit par port n’est inventé.

La résolution utilise le domaine d’entité et les clés de traduction ou le suffixe `{mac} {key}`. Les capteurs Home et leurs batteries ne sont pas mélangés au diagnostic du routeur. Une sélection explicite d’appareil ou les associations existantes évitent de fusionner plusieurs box.

## SFR — `sfr_box`, Core

- Le binary sensor `wan_status` est un vrai état WAN. `dsl_status`, `ftth_status` et les états VoIP sont distincts et conditionnés par l’infrastructure ou l’authentification.[4]
- `dsl_rate_down` / `dsl_rate_up` sont des **vitesses de synchronisation DSL**, en `kbit/s`. Le composant expose aussi mode de ligne, tentatives, CRC, bruit/atténuation, infrastructure, température et tension selon les entités activées ; plusieurs diagnostics sont désactivés par défaut. Ces plateformes ne définissent pas de débit de trafic courant ou de puissance optique FTTH.[3]
- Le bouton `system_reboot` requiert l’accès authentifié. Il ne s’agit pas d’une commande Wi-Fi.[11]

**Affichage implémenté** : WAN, firmware, synchronisation clairement nommée, diagnostics de ligne/système/VoIP disponibles et reboot s’il existe. Pas de jauge de trafic alimentée par une synchronisation, pas de faux total clients, pas de faux Wi-Fi.

Les `unique_id` utilisent le scope (`wan`, `dsl`, `ftth`, `system`, `voip`) : la clé générique `status` seule est insuffisante. Si un capteur DSL connu est placé manuellement dans `download`/`upload`, la résolution le reclasse en synchronisation lorsque le registre permet de l’identifier.

## Orange/Sosh — `livebox`, HACS Cyr-ius

- `down` / `up` (traductions `down_rate` / `up_rate`) sont la synchronisation xDSL. `fiber_rx` / `fiber_tx` et `wifi_rx` / `wifi_tx` sont des **volumes cumulés** en octets, avec unités d’affichage éventuellement converties par HA. Les entités dynamiques `{interface}_rate_rx/tx` sont des taux d’interface, pas automatiquement du trafic WAN.[6]
- Les puissances `fiber_power_rx/tx` sont des états en dBm. Le capteur RX peut porter des attributs optiques, dont `Temperature (°C)`, `Voltage (V)`, `Bias (mA)`, `ONU State` et des capacités de liaison. La carte n’utilise pas l’attribut brut incohérent `Tx power (dbm)` comme un dBm normalisé.[6]
- `connectivity` expose l’état WAN et les attributs exacts `wan_ipaddress`, `wired clients`, `wireless clients`, entre autres. Les clients sont calculés selon les options de tracking : ce n’est pas un inventaire physique exhaustif. DDNS est de classe `problem` : `on` signifie problème.[7]
- Les entités héritées sont rattachées au routeur par son identifiant série ; les IDs sont `{SerialNumber}_{description.key}`. Le firmware provient aussi des métadonnées appareil.[8]
- Les switches Wi-Fi et invité sont distincts ; les switches WAN individuels concernent des clients, pas un WAN global.[12]
- Les boutons redémarrage, sonnerie et effacement des appels sont exposés. La carte ne rend automatiquement actionnable que le redémarrage ; ni sonnerie ni effacement ne sont déclenchés.[13]

**Affichage implémenté** : WAN/IPv4, fonctionnement, optique, volumes explicitement cumulés, taux par interface nommée, synchronisation DSL, compteurs suivis avec réserve visible, diagnostics optiques disponibles, firmware et commandes Wi-Fi/reboot. Aucune première interface n’est arbitrairement choisie pour remplir une jauge Internet.

Les puissances optiques ne sont pas sélectionnées automatiquement pour les modèles explicitement identifiés comme Livebox 3/4. Certains capteurs d’intégration peuvent malgré tout retourner zéro en repli d’une API manquante : la carte ne sait pas reconstruire la validité d’une donnée non fournie. Une puissance zéro n’est pas universellement interprétée comme absente. La compatibilité commerciale d’une offre Sosh, ou de toute box appelée « Livebox », n’est pas garantie sans son modèle/firmware.

## Bouygues — `bbox`, Core historique

- Six capteurs sont sélectionnables dans `monitored_variables` : `current_down_bandwidth`, `current_up_bandwidth`, `down_max_bandwidth`, `up_max_bandwidth`, `number_of_reboots`, `uptime`. Les taux sont en `Mbit/s`. Les maximums sont de la bande passante disponible, pas une synchronisation DSL déduite. `uptime` est un **timestamp de démarrage**, pas un nombre de secondes.[5]
- Les classes de capteurs ne définissent pas de `unique_id` moderne. Aucun switch ou bouton n’est fourni par cette plateforme ; le nombre de démarrages n’est pas une commande de redémarrage.[5]

**Affichage implémenté** : association manuelle des six capteurs, jauges de trafic courant, valeurs de bande passante disponible distinctes, démarrage/durée et compteur de démarrages. Aucun nom anglais/français ou préfixe d’entité n’est deviné. Aucun switch Wi-Fi ni reboot fictif.

Le source de la dépendance `pybbox` n’a pas été audité : les formules et unités retenues sont celles du composant Core sauvegardé. La compatibilité de tous les matériels/firmwares Bbox n’est pas prétendue.

## Résolution et limites communes

1. Sélectionner l’intégration et le bon appareil ; refuser une sélection multi-box ambiguë.
2. N’utiliser que les entités actives du registre, avec leurs états et unités HA actuels.
3. Conserver les associations manuelles prioritaires et un mode `auto_detect: false`.
4. Ne pas confondre désactivation, absence, `unknown`, `unavailable` et zéro.
5. Préserver la distinction entre problème, connectivité, synchronisation, trafic et volume.
6. Ne jamais afficher automatiquement les attributs contenant numéros de téléphone, noms d’appelants, adresses MAC des clients ou numéros de série.
7. Limiter les commandes automatiques aux véritables `switch` Wi-Fi et `button` reboot. Confirmer une interruption réseau ; aucun service spécifique hypothétique n’est utilisé.

Les tests de contrat n’établissent pas une validation matérielle. Les codes et documentations amont restent l’autorité sur leurs propres capacités ; les fixtures prouvent uniquement le comportement de l’adaptateur sur ces contrats.

## Sources

[1] https://raw.githubusercontent.com/home-assistant/core/2026.10.4/homeassistant/components/freebox/sensor.py
[2] https://raw.githubusercontent.com/home-assistant/core/2026.10.4/homeassistant/components/freebox/router.py
[3] https://raw.githubusercontent.com/home-assistant/core/2026.10.4/homeassistant/components/sfr_box/sensor.py
[4] https://raw.githubusercontent.com/home-assistant/core/2026.10.4/homeassistant/components/sfr_box/binary_sensor.py
[5] https://raw.githubusercontent.com/home-assistant/core/2026.10.4/homeassistant/components/bbox/sensor.py
[6] https://raw.githubusercontent.com/cyr-ius/hass-livebox-component/30c75a0993e625dec8343204edff76073cb2f0fc/custom_components/livebox/sensor.py
[7] https://raw.githubusercontent.com/cyr-ius/hass-livebox-component/30c75a0993e625dec8343204edff76073cb2f0fc/custom_components/livebox/binary_sensor.py
[8] https://raw.githubusercontent.com/cyr-ius/hass-livebox-component/30c75a0993e625dec8343204edff76073cb2f0fc/custom_components/livebox/entity.py
[9] https://raw.githubusercontent.com/home-assistant/core/2026.10.4/homeassistant/components/freebox/switch.py
[10] https://raw.githubusercontent.com/home-assistant/core/2026.10.4/homeassistant/components/freebox/button.py
[11] https://raw.githubusercontent.com/home-assistant/core/2026.10.4/homeassistant/components/sfr_box/button.py
[12] https://raw.githubusercontent.com/cyr-ius/hass-livebox-component/30c75a0993e625dec8343204edff76073cb2f0fc/custom_components/livebox/switch.py
[13] https://raw.githubusercontent.com/cyr-ius/hass-livebox-component/30c75a0993e625dec8343204edff76073cb2f0fc/custom_components/livebox/button.py
