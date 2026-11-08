    function runAutoTestsSuite() {
      const results = [];
      const journalSauvegarde = journal;

      function verifier(id, titre, condition, detail) {
        results.push({ id, titre, passed: Boolean(condition), desc: detail });
      }

      function executerTest(id, titre, test) {
        try {
          const resultat = test();
          verifier(id, titre, resultat.condition, resultat.detail);
        } catch (erreur) {
          verifier(id, titre, false, `Erreur : ${erreur.message}`);
        }
      }

      try {
        journal = [];

        executerTest('T1', "Déplacement valide", () => {
          const liste = structuredClone(TICKETS_DEMO);
          const resultat = deplacerTickets(liste, 6, 'afaire');
          const ticket = liste.find(t => t.id === 6);
          return {
            condition: resultat.ok && ticket.statut === 'afaire',
            detail: resultat.ok ? `Ticket #6 déplacé vers "${ticket.statut}".` : resultat.erreur
          };
        });

        executerTest('T2', "Non estimé bloqué", () => {
          const liste = structuredClone(TICKETS_DEMO);
          const resultat = deplacerTickets(liste, 5, 'afaire');
          return {
            condition: !resultat.ok && resultat.erreur.includes('Règle R2'),
            detail: resultat.ok ? 'Le déplacement aurait dû être refusé par R2.' : resultat.erreur
          };
        });

        executerTest('T3', "WIP 3 → 4e refusé (mouvement)", () => {
          const liste = structuredClone(TICKETS_DEMO);
          liste.find(t => t.id === 2).statut = 'encours';
          const resultat = deplacerTickets(liste, 6, 'encours');
          return {
            condition: !resultat.ok && resultat.erreur.includes('Règle R1'),
            detail: resultat.ok ? 'Le déplacement aurait dû être refusé par R1.' : resultat.erreur
          };
        });

        executerTest('T4', "ID inconnu", () => {
          const resultat = deplacerTickets(structuredClone(TICKETS_DEMO), 999, 'afaire');
          return {
            condition: resultat.ok === false,
            detail: resultat.ok ? 'Un ticket inconnu a été déplacé.' : resultat.erreur
          };
        });

        executerTest('T5', "Tableau intact après refus de déplacement (R4)", () => {
          const liste = structuredClone(TICKETS_DEMO);
          liste.find(t => t.id === 1).bloquePar = [9];
          const statutsInitiaux = liste.map(t => t.statut);
          const refusNonEstime = deplacerTickets(liste, 5, 'afaire');
          const refusDependanceActive = deplacerTickets(liste, 9, 'backlog');
          const resultatImport = importerJSON(JSON.stringify([{
            id: 100, titre: 'Ticket importé', type: 'story', priorite: 2, points: 3, statut: 'backlog'
          }]), liste);
          const statutsFinaux = liste.map(t => t.statut);
          const sourceIntacte = resultatImport.ok && resultatImport.importes === 1 && liste.length === 12 &&
            JSON.stringify(statutsFinaux) === JSON.stringify(statutsInitiaux);
          return {
            condition: !refusNonEstime.ok && !refusDependanceActive.ok &&
              refusDependanceActive.erreur.includes('#1') && sourceIntacte,
            detail: `Refus non estimé : ${refusNonEstime.ok ? 'accepté à tort' : 'confirmé'}; refus dépendance active : ${refusDependanceActive.ok ? 'accepté à tort' : refusDependanceActive.erreur}; après import, statuts de la source ${sourceIntacte ? 'inchangés' : 'modifiés'}.`
          };
        });

        executerTest('T6', "Stats vides / 0%", () => {
          const statistiques = calculerStatistiquesKanban([]);
          const tousAZero = Object.values(statistiques).every(valeur =>
            typeof valeur === 'number' && Number.isFinite(valeur) && valeur === 0
          );
          return {
            condition: tousAZero,
            detail: `Statistiques calculées sur une liste vide : ${JSON.stringify(statistiques)}.`
          };
        });

        executerTest('T7', "Saut En cours → Terminé refusé (PO)", () => {
          const liste = structuredClone(TICKETS_DEMO);
          const resultat = deplacerTickets(liste, 1, 'termine');
          return {
            condition: !resultat.ok && resultat.erreur.includes('Règle R6') &&
              liste.find(t => t.id === 1).statut === 'encours',
            detail: resultat.ok ? 'Le passage direct aurait dû être refusé par R6.' : resultat.erreur
          };
        });

        executerTest('T8', "Parseur CSV piégé", () => {
          const csv = [
            'id,titre,type,priorite,points,statut',
            '1,"Facture, annuelle ""pro""",story,2,3,backlog',
            '2,"Guide utilisateur",tache,2,2,afaire',
            '3,"Type inconnu",autre,1,1,backlog',
            '4,OK,bug,2,2,backlog',
            '5,"Rapport mensuel",story,3,5,backlog',
            '6,"Migration cloud",tache,1,8,afaire'
          ].join('\r\n');
          const lignes = parserCSV(csv);
          const resultat = importerTickets(lignes, []);
          const titreParse = resultat.nouveauxTickets[0]?.titre;
          return {
            condition: lignes.length === 7 && resultat.ok && resultat.importes === 4 &&
              resultat.rejets.length === 2 && titreParse === 'Facture, annuelle "pro"',
            detail: `${resultat.importes} importés, ${resultat.rejets.length} rejetés; première ligne interprétée : "${titreParse}".`
          };
        });

        executerTest('T9', "Collision d'ID (I4)", () => {
          const liste = [{ id: 21, titre: 'Ticket existant', type: 'story', priorite: 1, points: 2, statut: 'backlog' }];
          const resultat = importerTickets(parserCSV([
            'id,titre,type,priorite,points,statut',
            '21,Nouveau ticket,story,2,3,backlog'
          ].join('\r\n')), liste);
          const ticketImporte = resultat.nouveauxTickets.find(t => t.titre === 'Nouveau ticket');
          return {
            condition: resultat.ok && resultat.importes === 1 && ticketImporte.id === 22,
            detail: `ID attribué au ticket importé : ${ticketImporte?.id ?? 'aucun'}.`
          };
        });

        executerTest('T10', "Import JSON", () => {
          const resultat = importerJSON(JSON.stringify([
            { id: 1, titre: 'Ticket valide', type: 'story', priorite: 2, points: 3, statut: 'backlog' },
            { titre: 'Sans identifiant', type: 'bug', priorite: 1, points: 1, statut: 'backlog' },
            { id: 3, titre: 'Type incorrect', type: 'inconnu', priorite: 1, points: 1, statut: 'backlog' }
          ]), []);
          return {
            condition: resultat.ok && resultat.importes === 1 && resultat.rejets.length === 2,
            detail: `${resultat.importes} importé(s), ${resultat.rejets.length} rejet(s).`
          };
        });

        executerTest('T11', "Blocage WIP (Redirection Backlog)", () => {
          const liste = structuredClone(TICKETS_DEMO);
          liste.find(t => t.id === 3).statut = 'encours';
          const resultat = importerJSON(JSON.stringify([{
            id: 99, titre: 'Quatrième en cours', type: 'story', priorite: 2, points: 3, statut: 'encours'
          }]), liste);
          const ticketImporte = resultat.nouveauxTickets.find(t => t.id === 99);
          const motifWip = resultat.rejets.some(r => r.motif.includes('WIP') && r.motif.includes('Backlog'));
          return {
            condition: resultat.ok && resultat.importes === 1 && ticketImporte.statut === 'backlog' && motifWip,
            detail: `Ticket importé en "${ticketImporte?.statut ?? 'introuvable'}"; motif WIP ${motifWip ? 'présent' : 'absent'}.`
          };
        });

        executerTest('T12', "Cohérence WIP (Ajout manuel)", () => {
          const liste = [
            { statut: 'encours' },
            { statut: 'encours' },
            { statut: 'encours' }
          ];
          const resultat = statutApresControleWip('encours', liste);
          return {
            condition: resultat.statut === 'backlog' && resultat.motif.includes('WIP') &&
              resultat.message === "Colonne 'En cours' pleine. Le ticket a été basculé dans le Backlog.",
            detail: `Statut retenu : "${resultat.statut}", motif : ${resultat.motif || 'aucun'}.`
          };
        });

        executerTest('T13', "Passage valide En cours → En revue → Terminé", () => {
          const liste = structuredClone(TICKETS_DEMO);
          const premier = deplacerTickets(liste, 1, 'enrevue');
          const second = deplacerTickets(liste, 1, 'termine');
          return {
            condition: premier.ok && second.ok && liste.find(t => t.id === 1).statut === 'termine',
            detail: `En revue : ${premier.ok ? 'OK' : premier.erreur}; terminé : ${second.ok ? 'OK' : second.erreur}.`
          };
        });

        executerTest('T15', "Migration V2 vers V3", () => {
          const ancienneVersion = [structuredClone(TICKETS_DEMO[0])];
          delete ancienneVersion[0].assigne;
          const resultat = migrerV2versV3(ancienneVersion);
          return {
            condition: resultat.tickets.length === 1 && resultat.tickets[0].assigne === null &&
              resultat.users.length === USERS_DEMO.length && resultat.journal.length === 0,
            detail: `Tickets : ${resultat.tickets.length}, utilisateur(s) : ${resultat.users.length}, journal : ${resultat.journal.length}, assigne : ${resultat.tickets[0]?.assigne}.`
          };
        });

        executerTest('T16', "Historique (10 derniers)", () => {
          const liste = Array.from({ length: 12 }, (_, index) => ({
            id: index + 1,
            titre: `Ticket ${index + 1}`,
            points: 1,
            statut: 'backlog'
          }));
          const mouvements = liste.map(ticket => deplacerTickets(liste, ticket.id, 'afaire'));
          return {
            condition: mouvements.every(resultat => resultat.ok) && journal.length === 10 &&
              journal[0].ticketId === 12 && journal[9].ticketId === 3,
            detail: `${mouvements.filter(resultat => resultat.ok).length} mouvements; ${journal.length} entrées conservées, de #${journal[0]?.ticketId} à #${journal[9]?.ticketId}.`
          };
        });

        executerTest('T17', "Destination invalide sans mutation", () => {
          const liste = structuredClone(TICKETS_DEMO);
          const statutInitial = liste.find(t => t.id === 6).statut;
          const mouvementsInitiaux = journal.length;
          const resultat = deplacerTickets(liste, 6, 'colonne-inconnue');
          const statutFinal = liste.find(t => t.id === 6).statut;
          return {
            condition: !resultat.ok && resultat.erreur === 'Colonne destination invalide.' &&
              statutFinal === statutInitial && journal.length === mouvementsInitiaux,
            detail: `${resultat.erreur} Statut conservé : "${statutFinal}"; mouvements ajoutés : ${journal.length - mouvementsInitiaux}.`
          };
        });

        executerTest('T18', "Même statut sans entrée d'historique", () => {
          const liste = structuredClone(TICKETS_DEMO);
          const statutInitial = liste.find(t => t.id === 6).statut;
          const mouvementsInitiaux = journal.length;
          const resultat = deplacerTickets(liste, 6, statutInitial);
          return {
            condition: resultat.ok && resultat.ticketsDeplaces[0].statut === statutInitial &&
              journal.length === mouvementsInitiaux,
            detail: `Résultat : ${resultat.ok ? 'accepté' : resultat.erreur}; statut : "${liste.find(t => t.id === 6).statut}"; mouvements ajoutés : ${journal.length - mouvementsInitiaux}.`
          };
        });

        executerTest('T19', "Ligne CSV incomplète puis valide", () => {
          const liste = structuredClone(TICKETS_DEMO);
          const longueurInitiale = liste.length;
          const statutsInitiaux = liste.map(t => t.statut);
          const lignes = parserCSV([
            'id,titre,type,priorite,points,statut',
            '20,Ligne incomplète,story',
            '21,Ligne valide,story,2,3,backlog'
          ].join('\r\n'));
          const resultat = importerTickets(lignes, liste);
          const ticketImporte = resultat.nouveauxTickets.find(t => t.id === 21);
          return {
            condition: resultat.ok && resultat.importes === 1 && resultat.rejets.length === 1 &&
              resultat.rejets[0].ligne === 2 && resultat.rejets[0].motif === 'Colonnes manquantes.' &&
              ticketImporte?.titre === 'Ligne valide' && liste.length === longueurInitiale &&
              JSON.stringify(liste.map(t => t.statut)) === JSON.stringify(statutsInitiaux),
            detail: `${resultat.importes} importé(s), ${resultat.rejets.length} rejet(s); source inchangée : ${liste.length === longueurInitiale && JSON.stringify(liste.map(t => t.statut)) === JSON.stringify(statutsInitiaux)}.`
          };
        });

        executerTest('T20', "Migration V3 vers V4", () => {
          const sauvegardeV3 = {
            tickets: structuredClone(TICKETS_DEMO),
            users: structuredClone(USERS_DEMO),
            journal: [
              {
                ticketId: 6,
                ticketTitre: TICKETS_DEMO.find(t => t.id === 6).titre,
                statutOrigine: 'backlog',
                statutCible: 'afaire',
                date: '2026-11-04T12:00:00.000Z'
              }
            ]
          };
          const sauvegardeAttendue = structuredClone(sauvegardeV3);
          const resultat = migrerJusquaVersion(sauvegardeV3, 3);
          return {
            condition: JSON.stringify(resultat) === JSON.stringify(sauvegardeAttendue),
            detail: `Tickets : ${resultat.tickets.length}/${sauvegardeAttendue.tickets.length}, utilisateurs : ${resultat.users.length}/${sauvegardeAttendue.users.length}, journal identique : ${JSON.stringify(resultat.journal) === JSON.stringify(sauvegardeAttendue.journal)}.`
          };
        });

        executerTest('T21', "Champ bloquePar initialisé", () => {
          const sauvegardeV4 = {
            tickets: [{ id: 12, titre: 'Nouveau ticket', statut: 'backlog' }],
            users: [],
            journal: []
          };
          const resultat = migrerV4versV5(sauvegardeV4);
          return {
            condition: Array.isArray(resultat.tickets[0].bloquePar) &&
              resultat.tickets[0].bloquePar.length === 0,
            detail: `bloquePar obtenu : ${JSON.stringify(resultat.tickets[0].bloquePar)}.`
          };
        });

        executerTest('T22', "Déclarer plusieurs bloquants sans doublon", () => {
          const liste = [
            { id: 3, titre: 'Préparer les données', statut: 'termine', bloquePar: [] },
            { id: 5, titre: 'Valider le paiement', statut: 'afaire', bloquePar: [] },
            { id: 12, titre: 'Publier la facture', statut: 'backlog', bloquePar: [] }
          ];
          const premier = ajouterBloquant(liste, 12, 3);
          const second = ajouterBloquant(liste, 12, 5);
          const doublon = ajouterBloquant(liste, 12, 3);
          return {
            condition: premier.ok && second.ok && !doublon.ok &&
              JSON.stringify(liste.find(t => t.id === 12).bloquePar) === JSON.stringify([3, 5]),
            detail: `Résultats : ${JSON.stringify([premier, second, doublon])}; bloquePar : ${JSON.stringify(liste.find(t => t.id === 12).bloquePar)}.`
          };
        });

        executerTest('T23', "Bloquant non terminé empêche le passage en cours", () => {
          const liste = [
            { id: 3, titre: 'Données prêtes', statut: 'termine', points: 2, bloquePar: [] },
            { id: 5, titre: 'Paiement validé', statut: 'enrevue', points: 2, bloquePar: [] },
            { id: 12, titre: 'Publier la facture', statut: 'afaire', points: 3, bloquePar: [3, 5] }
          ];
          const refus = deplacerTickets(liste, 12, 'encours');
          const messageAttendu = 'Bloqué par #5 (non terminés).';
          liste.find(t => t.id === 5).statut = 'termine';
          const autorisation = deplacerTickets(liste, 12, 'encours');
          return {
            condition: !refus.ok && refus.erreur === messageAttendu && autorisation.ok,
            detail: `Avec #5 non terminé : ${refus.ok ? 'accepté' : refus.erreur}; une fois terminé : ${autorisation.ok ? 'accepté' : autorisation.erreur}.`
          };
        });

        executerTest('T24', "Lister les bloquants pour le badge", () => {
          const liste = [
            { id: 3, titre: 'Données prêtes', statut: 'termine', bloquePar: [] },
            { id: 5, titre: 'Paiement validé', statut: 'afaire', bloquePar: [] },
            { id: 12, titre: 'Publier la facture', statut: 'backlog', bloquePar: [3, 5, 999] }
          ];
          const resultat = listerBloquants(liste, liste.find(t => t.id === 12));
          const attendu = [
            { id: 3, titre: 'Données prêtes' },
            { id: 5, titre: 'Paiement validé' }
          ];
          return {
            condition: JSON.stringify(resultat) === JSON.stringify(attendu),
            detail: `Bloquants listés : ${JSON.stringify(resultat)}.`
          };
        });

        executerTest('T25', "Suppression nettoie les références", () => {
          const liste = [
            { id: 3, titre: 'Ticket supprimé', statut: 'backlog', bloquePar: [] },
            { id: 5, titre: 'Autre bloquant', statut: 'backlog', bloquePar: [] },
            { id: 12, titre: 'Ticket dépendant', statut: 'backlog', bloquePar: [3, 5] }
          ];
          const resultat = supprimerTicketEtReferences(liste, 3);
          return {
            condition: resultat !== liste && !resultat.some(t => t.id === 3) &&
              JSON.stringify(resultat.find(t => t.id === 12).bloquePar) === JSON.stringify([5]) &&
              JSON.stringify(liste.find(t => t.id === 12).bloquePar) === JSON.stringify([3, 5]),
            detail: `Résultat : ${JSON.stringify(resultat)}; liste source : ${JSON.stringify(liste)}.`
          };
        });

        executerTest('T26', "Cycle refusé avec parcours complet", () => {
          const liste = [
            { id: 1, titre: 'A', statut: 'backlog', bloquePar: [2] },
            { id: 2, titre: 'B', statut: 'backlog', bloquePar: [3] },
            { id: 3, titre: 'C', statut: 'backlog', bloquePar: [] }
          ];
          const resultat = ajouterBloquant(liste, 3, 1);
          const autoDependance = ajouterBloquant(liste, 1, 1);
          const cycleAttendu = 'Cycle détecté : #3 → #1 → #2 → #3';
          const autoDependanceAttendue = 'Cycle détecté : #1 → #1';
          return {
            condition: !resultat.ok && resultat.erreur === cycleAttendu &&
              !autoDependance.ok && autoDependance.erreur === autoDependanceAttendue,
            detail: `Cycle : ${resultat.erreur}; auto-dépendance : ${autoDependance.erreur}.`
          };
        });

        executerTest('T27', "Migration V4 vers V5 conserve les données", () => {
          const sauvegardeV4 = {
            version: 4,
            tickets: [
              { id: 12, titre: 'Ticket historique', statut: 'backlog', description: 'Conserver', bloquePar: [3] },
              { id: 3, titre: 'Ticket bloquant', statut: 'termine' }
            ],
            users: [{ id: 7, prenom: 'Sam', nom: 'Test' }],
            journal: [{ ticketId: 12, statutOrigine: 'backlog', statutCible: 'afaire' }],
            autreDonnee: 'intacte'
          };
          const attendue = structuredClone(sauvegardeV4);
          attendue.version = 5;
          attendue.tickets[1].bloquePar = [];
          const resultat = migrerV4versV5(sauvegardeV4);
          return {
            condition: VERSION_ACTUELLE === 5 &&
              JSON.stringify(resultat) === JSON.stringify(attendue),
            detail: `Version actuelle : ${VERSION_ACTUELLE}; données migrées : ${JSON.stringify(resultat)}.`
          };
        });

        executerTest('T28', "Réouverture d'un ticket terminé", () => {
          const liste = [
            { id: 55, titre: 'Ticket terminé', statut: 'termine', points: 2, bloquePar: [] }
          ];
          const resultat = deplacerTickets(liste, 55, 'backlog');
          return {
            condition: resultat.ok && liste[0].statut === 'backlog' &&
              journal[0]?.statutOrigine === 'termine' && journal[0]?.statutCible === 'backlog',
            detail: `Réouverture ${resultat.ok ? 'acceptée' : `refusée : ${resultat.erreur}`}; statut : "${liste[0].statut}".`
          };
        });

        executerTest('T29', "Ticket en cours dépendant protège son bloquant terminé", () => {
          const liste = [
            { id: 55, titre: 'Ticket bloquant', statut: 'termine', points: 2, bloquePar: [] },
            { id: 22, titre: 'Ticket dépendant', statut: 'encours', points: 2, bloquePar: [55] }
          ];
          const resultat = deplacerTickets(liste, 55, 'backlog');
          return {
            condition: !resultat.ok && resultat.erreur.includes('#22') &&
              liste.find(ticket => ticket.id === 55).statut === 'termine',
            detail: `Déplacement ${resultat.ok ? 'accepté à tort' : `refusé : ${resultat.erreur}`}; #55 reste "${liste[0].statut}".`
          };
        });

        executerTest('T30', "Réouverture possible après sortie du dépendant d'En cours", () => {
          const liste = [
            { id: 55, titre: 'Ticket bloquant', statut: 'termine', points: 2, bloquePar: [] },
            { id: 22, titre: 'Ticket dépendant', statut: 'encours', points: 2, bloquePar: [55] }
          ];
          const deplacementDependante = deplacerTickets(liste, 22, 'afaire');
          const reouverture = deplacerTickets(liste, 55, 'afaire');
          return {
            condition: deplacementDependante.ok && reouverture.ok &&
              liste.find(ticket => ticket.id === 22).statut === 'afaire' &&
              liste.find(ticket => ticket.id === 55).statut === 'afaire',
            detail: `Dépendant déplacé : ${deplacementDependante.ok ? 'oui' : deplacementDependante.erreur}; réouverture : ${reouverture.ok ? 'acceptée' : reouverture.erreur}.`
          };
        });

        executerTest('T31', "Réouverture respecte la limite WIP", () => {
          const liste = [
            { id: 55, titre: 'Ticket terminé', statut: 'termine', points: 2, bloquePar: [] },
            { id: 1, titre: 'En cours 1', statut: 'encours', points: 2, bloquePar: [] },
            { id: 2, titre: 'En cours 2', statut: 'encours', points: 2, bloquePar: [] },
            { id: 3, titre: 'En cours 3', statut: 'encours', points: 2, bloquePar: [] }
          ];
          const resultat = deplacerTickets(liste, 55, 'encours');
          return {
            condition: !resultat.ok && resultat.erreur.includes('Règle R1') &&
              liste.find(ticket => ticket.id === 55).statut === 'termine',
            detail: `Déplacement vers En cours ${resultat.ok ? 'accepté à tort' : `refusé : ${resultat.erreur}`}; #55 reste "${liste[0].statut}".`
          };
        });

        executerTest('T32', "Réouverture vers En cours respecte les dépendances", () => {
          const liste = [
            { id: 55, titre: 'Ticket terminé', statut: 'termine', points: 2, bloquePar: [6] },
            { id: 6, titre: 'Bloquant non terminé', statut: 'afaire', points: 2, bloquePar: [] }
          ];
          const resultat = deplacerTickets(liste, 55, 'encours');
          return {
            condition: !resultat.ok && resultat.erreur === 'Bloqué par #6 (non terminés).' &&
              liste.find(ticket => ticket.id === 55).statut === 'termine',
            detail: `Déplacement vers En cours ${resultat.ok ? 'accepté à tort' : `refusé : ${resultat.erreur}`}; statut conservé : "${liste[0].statut}".`
          };
        });

        executerTest('T33', "En revue ne libère pas le ticket bloquant terminé", () => {
          const liste = [
            { id: 55, titre: 'Ticket bloquant', statut: 'termine', points: 2, bloquePar: [] },
            { id: 22, titre: 'Ticket dépendant', statut: 'enrevue', points: 2, bloquePar: [55] }
          ];
          const resultat = deplacerTickets(liste, 55, 'backlog');
          return {
            condition: !resultat.ok && resultat.erreur.includes('#22') &&
              resultat.erreur.includes('À faire') && resultat.erreur.includes('Backlog') &&
              liste.find(ticket => ticket.id === 55).statut === 'termine',
            detail: `Réouverture ${resultat.ok ? 'acceptée à tort' : `refusée : ${resultat.erreur}`}; #55 reste "${liste[0].statut}".`
          };
        });
      } finally {
        journal = journalSauvegarde;
      }

      renderAutoTestUI(results);
    }

    function renderAutoTestUI(results) {
      const pass = results.filter(r => r.passed).length;
      const total = results.length;
      document.getElementById('autotest-synthesis').innerHTML = `
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tests Réussis</span>
          <div class="flex items-baseline gap-2 mt-1"><span class="text-xl font-extrabold text-emerald-400">${pass} / ${total}</span></div>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">État Global</span>
          <div class="flex items-center gap-2 mt-1"><span class="w-2.5 h-2.5 rounded-full ${pass===total?'bg-emerald-500':'bg-rose-500'}"></span><span class="text-xs font-bold ${pass===total?'text-emerald-400':'text-rose-400'}">${pass===total?'Tous les tests sont verts':'Anomalies détectées'}</span></div>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fonctions testées</span>
          <span class="text-xs font-mono text-blue-400 mt-1">deplacerTickets(), enregistrerMouvement(), statutApresControleWip(), parserCSV(), importerTickets(), importerJSON(), calculerStatistiquesKanban(), migrerV2versV3(), validerTicketMetier()</span>
        </div>`;
      document.getElementById('tests-passed-count').textContent = `${pass} / ${total} validés`;
      
      const lc = document.getElementById('autotest-details-list');
      lc.innerHTML = '';
      results.forEach(r => {
        const item = document.createElement('div');
        item.className = "px-4 py-3 flex items-start gap-3 hover:bg-slate-900/60 transition-colors";
        item.innerHTML = `
          <div class="mt-0.5 shrink-0">${r.passed ? '<span class="text-emerald-400">✓</span>' : '<span class="text-rose-400">✕</span>'}</div>
          <div class="space-y-0.5 flex-1">
            <div class="flex items-center gap-2"><span class="font-mono text-xs font-bold text-slate-400">${r.id}</span><h4 class="text-xs font-bold ${r.passed?'text-emerald-400':'text-rose-400'}">${r.titre}</h4></div>
            <p class="text-[11px] text-slate-400 leading-relaxed">${r.desc}</p>
          </div>`;
        lc.appendChild(item);
      });
    }
    document.getElementById('btn-re-run-tests').addEventListener('click', runAutoTestsSuite);
