# Fonctionnalité B — Dépendances & blocages

## Critères d’acceptation

1. **Champ de dépendances** — Chaque ticket possède `bloquePar`, un tableau d’identifiants.  
   *Exemple :* création du ticket `#12` → `bloquePar: []`.

2. **Déclarer un ou plusieurs bloquants** — Une dépendance relie le ticket bloqué aux IDs de ses bloquants et est conservée avec le ticket.  
   *Exemple :* définir `#12.bloquePar = [3, 5]` → le ticket `#12` référence les tickets `#3` et `#5`.

3. **Empêcher le passage en « En cours »** — Le déplacement vers `encours` est refusé si au moins un ticket dans `bloquePar` n’est pas `termine`; le message identifie les bloquants non terminés. Il est permis quand ils sont tous terminés.  
   *Exemple :* `#12.bloquePar = [3, 5]`, `#3` terminé et `#5` en revue → déplacement de `#12` refusé; après achèvement de `#5` → accepté.

4. **Badge des dépendances** — Une carte avec des bloquants affiche un badge 🔒 qui permet d’identifier la liste des tickets bloquants.  
   *Exemple :* `#12.bloquePar = [3]` → carte de `#12` affiche 🔒 et `#3` (identifiant et titre).

5. **Nettoyer les références à la suppression** — Supprimer un ticket enlève son ID des `bloquePar` de tous les autres tickets, sans altérer leurs autres dépendances.  
   *Exemple :* supprimer `#3` alors que `#12.bloquePar = [3, 5]` → `#12.bloquePar = [5]`.

6. **Refuser les cycles avec leur parcours complet** — Toute dépendance qui créerait un cycle est refusée sans être enregistrée; le message montre le cycle complet, y compris le ticket de départ. Cela inclut l’auto-dépendance.  
   *Exemple :* `#1` est bloqué par `#2`, `#2` par `#3`; ajouter `#3` bloqué par `#1` → refus avec un message tel que `Cycle détecté : #3 → #1 → #2 → #3`. Ajouter `#1` bloqué par lui-même → refus avec `#1 → #1`.

7. **Migration de la version 4 à la version 5** — La migration conserve les données existantes et ajoute `bloquePar: []` à chaque ancien ticket dépourvu de ce champ.  
   *Exemple :* ticket version 4 avec `id`, `titre` et `statut`, sans `bloquePar` → mêmes valeurs après migration, plus `bloquePar: []`; utilisateurs et journal inchangés.

## Questions ouvertes

- Où et comment l’utilisateur gère-t-il les dépendances : formulaire de ticket, carte, modal ou autre ?
- Peut-on ajouter plusieurs fois le même bloquant ? Peut-on définir comme bloquant un ticket déjà terminé ?
- Quel comportement adopter si un ID référencé est introuvable, notamment après import ?
- L’interdiction d’entrer en « En cours » doit-elle aussi s’appliquer aux imports et à toutes les autres voies de changement de statut ?
- Quel format exact doit avoir le message de blocage hors cycle, et où doit-il être affiché ?

## Décisions (relecture Xavier)

- Gestion des dépendances : dans le formulaire d'édition du ticket (liste des bloquants).
- Un même bloquant n'est jamais ajouté deux fois. Un ticket déjà terminé peut être bloquant.
- Un ID introuvable dans `bloquePar` est ignoré (non bloquant) et retiré à la prochaine sauvegarde.
- Le blocage « En cours » s'applique uniquement au déplacement (`deplacerTickets`).
- Message de blocage : `Bloqué par #3, #5 (non terminés).`, affiché dans le toast d'erreur.

## Fonctions attendues (contrat entre Testeur-QA et Dev-JS)

- `ajouterBloquant(liste, idTicket, idBloquant)` → `{ ok, erreur }`, refuse les cycles et les doublons.
- `deplacerTickets(liste, idTicket, versStatut)` → refuse `encours` si un bloquant n'est pas terminé.
- `listerBloquants(liste, ticket)` → tableau `[{ id, titre }]` utilisé par le badge 🔒.
- `supprimerTicketEtReferences(liste, idTicket)` → nouvelle liste sans le ticket ni ses références.
- `migrerV4versV5(data)` + `VERSION_ACTUELLE = 5`.