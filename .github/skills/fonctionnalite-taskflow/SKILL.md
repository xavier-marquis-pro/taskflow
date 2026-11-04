---
name: fonctionnalite-taskflow
description: 'Use when clarifying, implementing, testing, or reviewing a Taskflow feature or bug fix in this workspace.'
argument-hint: 'Describe the Taskflow feature, behavior change, or bug to address'
---

# Fonctionnalité Taskflow

Workflow de réalisation d'une fonctionnalité ou correction dans cette application.

## Quand utiliser

- Ajouter ou modifier une fonctionnalité Taskflow.
- Corriger un comportement ou analyser une demande produit liée à Taskflow.
- Vérifier une modification et ses auto-tests avant livraison.

## Procédure

1. Lire `AGENTS.md` et les personnalisations applicables. Clarifier les critères d'acceptation et les cas limites avant de coder lorsque la demande est ambiguë.
2. Examiner `index.html`, `style.css`, `app.js` et `tests.js` pour retrouver les identifiants, fonctions et conventions existants. Ne pas renommer les fonctions ou identifiants sans demande explicite.
3. Conserver le découpage de `app.js` en trois zones : `1. DONNÉES`, `2. RÈGLES`, `3. UI`. Garder les données et règles métier testables indépendamment de l'interface quand cela correspond aux motifs existants.
4. Utiliser du HTML, du CSS et du JavaScript natifs, sans bibliothèque complexe ni dépendance inutile. Nommer les variables en français, sauf noms imposés par les API du navigateur.
5. Faire des changements précis et limités. Préserver les comportements existants qui ne sont pas explicitement visés.
6. Ajouter ou adapter des auto-tests simples, sans bibliothèque. Chaque test doit appeler la logique concernée et comparer le résultat réel à une attente ; ne jamais remplacer un test par un résultat codé en dur.
7. Isoler les données des tests des données de l'utilisateur. Ne pas altérer l'état applicatif persistant, les variables d'état utilisateur ni `localStorage` pendant les auto-tests.
8. Exécuter les vérifications disponibles dans le navigateur ou avec les outils du projet. Si une vérification ne peut pas être exécutée, le signaler au lieu de déclarer les tests réussis.
9. Rapporter les fichiers modifiés, le résultat de chaque test pertinent, les échecs et leur cause, ainsi que les validations non exécutées.

## Collaboration par rôle

- **Analyste-PO** : clarifie le besoin et formule des critères d'acceptation observables.
- **Dev-JS** : implémente la modification minimale et ajoute les auto-tests requis.
- **Testeur-QA** : vérifie les cas d'acceptation, les régressions et l'isolation des tests ; rapporte les défauts sans masquer les échecs.
