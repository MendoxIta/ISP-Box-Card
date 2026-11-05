# Changelog

## 0.3.1

- Éditeur réorganisé en quatre sections : box, affichage/confidentialité, apparence/format, données avancées.
- Couleurs regroupées en trois palettes et réglages de dimensions alignés selon la largeur disponible.
- Correction de la fermeture des sections et de la perte de focus après modification : formulaires montés une seule fois et schémas stables lors du retour de configuration HA.
- Régression reproduite puis testée avec des mises à jour répétées et l’éditeur natif Home Assistant, sans modifier les dashboards ni appeler de service réseau.

## 0.3.0

- Formats complet et compact, sans perte de mesures ni de commandes.
- Palette personnalisable par rôle, arrondis, espacements et marges intérieures.
- Sélecteurs de couleurs dans l’éditeur visuel et bouton de réinitialisation limité à l’apparence.
- Styles propres à chaque carte ; compatibilité des configurations existantes et validation stricte des valeurs.
- Démonstration interactive d’apparence, tests de géométrie/couleurs et contrôle de l’éditeur natif HA.

## 0.2.0

- Profils fondés sur l’audit Core 2026.10.4 et Livebox HACS Cyr-ius 2.6.0.
- Détection par registre/appareil pour Freebox, SFR et Livebox ; mapping Bbox historique explicitement manuel.
- Diagnostics réels : températures, ventilation, appels, firmware, optique, DSL, volumes et taux d’interface selon l’intégration.
- Synchronisation et bande passante disponible distinctes du trafic courant ; aucun WAN inféré d’un tracker.
- Éditeur adapté au profil et reset des données de l’ancien opérateur ; sélection multi-box non ambiguë.
- Mise à jour sur événements des registres, désabonnement au démontage et récupération après échec de lecture ; les attributs numériques d’un binary sensor restent des nombres.
- Tests synthétiques des quatre profils et vérification connectée sur Freebox Ultra, sans commandes ni modifications distantes.

## 0.1.2

- Composition rapprochée de la référence : bandeau illustré, cadrans teintés et gradués, commande de redémarrage horizontale.
- Exemples Freebox avec IP affichée, durée en jours/heures calculée dans le fuseau HA et échelle de jauge configurable.
- Mode `show_missing` pour conserver tous les blocs en signalant les sources absentes ; mode `show_controls` pour retirer les commandes.
- Préparation optionnelle du visuel officiel pour usage local, sans l’inclure dans les sources MIT.
- Tests de fuseaux et heure d’été/hiver, composition complète sans sources et tests connectés HA.

## 0.1.1

- Prise en charge des attributs `public_ip` et `uptime`, notamment ceux du tracker Freebox v9.
- Affichage des dates de démarrage sans fuseau sans supposer le fuseau du navigateur.
- Tests connectés dans le frontend Home Assistant 2026.10.4 avec une Freebox Ultra : débits, confidentialité IP, date de démarrage et éditeur natif.
- Aucun service réseau exécuté ; dashboards et ressources inchangés.

## 0.1.0

- Première carte autonome multi-opérateur : Free, Orange, Bouygues, SFR.
- Interface sombre responsive, entités explicites, jauges avec conversion des unités.
- Visuel local configurable et confidentialité visuelle de l’IP.
- Commandes Home Assistant avec confirmations et gestion des erreurs.
- Éditeur visuel HA, exemples, démonstration simulée, tests unitaires et navigateur.
- Validation sur box et Home Assistant connectés encore à réaliser.
