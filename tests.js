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
            condition: VERSION_ACTUELLE === 6 && resultat.version === 5 &&
              JSON.stringify(resultat) === JSON.stringify(attendue),
            detail: `Version actuelle : ${VERSION_ACTUELLE}; version après migration V4→V5 : ${resultat.version}.`
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

        executerTest('T34', "Migration V5 vers V6 ajoute les échéances manquantes", () => {
          const sauvegardeV5 = {
            version: 5,
            tickets: [
              { id: 1, titre: 'Sans échéance', statut: 'backlog' },
              { id: 2, titre: 'Échéance et sprint conservés', statut: 'afaire', dateEcheance: '2026-11-30', sprintId: 7 }
            ],
            users: [{ id: 1, prenom: 'Alice', nom: 'Martin' }],
            journal: [{ ticketId: 1, statutOrigine: 'backlog', statutCible: 'afaire' }],
            sprints: [{ id: 7, nom: 'Sprint historique', statut: 'brouillon' }]
          };
          const resultat = migrerV5versV6(sauvegardeV5);
          return {
            condition: resultat.version === 6 && resultat.tickets[0].dateEcheance === null &&
              resultat.tickets[0].sprintId === null &&
              resultat.tickets[1].dateEcheance === '2026-11-30' && resultat.tickets[1].sprintId === 7 &&
              JSON.stringify(resultat.users) === JSON.stringify(sauvegardeV5.users) &&
              JSON.stringify(resultat.journal) === JSON.stringify(sauvegardeV5.journal) &&
              JSON.stringify(resultat.sprints) === JSON.stringify(sauvegardeV5.sprints),
            detail: `Version ${resultat.version}; champs migrés : dateEcheance=${resultat.tickets[0].dateEcheance}, sprintId=${resultat.tickets[0].sprintId}; valeurs existantes conservées : dateEcheance=${resultat.tickets[1].dateEcheance}, sprintId=${resultat.tickets[1].sprintId}.`
          };
        });

        executerTest('T35', "Badges J-2 et retard aux limites de date", () => {
          const ticket = { statut: 'encours', dateEcheance: '2004-11-29' };
          const resultat = [
            obtenirBadgeEcheance(ticket, '2004-11-27'),
            obtenirBadgeEcheance(ticket, '2004-11-28'),
            obtenirBadgeEcheance(ticket, '2004-11-29'),
            obtenirBadgeEcheance(ticket, '2004-11-30')
          ];
          const ticketTermine = { ...ticket, statut: 'termine' };
          return {
            condition: JSON.stringify(resultat) === JSON.stringify([null, 'j2', 'j2', 'retard']) &&
              obtenirBadgeEcheance(ticketTermine, '2004-11-30') === null,
            detail: `27→${resultat[0]}; 28→${resultat[1]}; 29→${resultat[2]}; 30→${resultat[3]}; terminé→${obtenirBadgeEcheance(ticketTermine, '2004-11-30')}.`
          };
        });

        executerTest('T36', "Filtres d'urgence combinés en union", () => {
          const liste = [
            { id: 1, statut: 'afaire', dateEcheance: '2004-11-28' },
            { id: 2, statut: 'afaire', dateEcheance: '2004-11-30' },
            { id: 3, statut: 'afaire', dateEcheance: '2004-12-10' },
            { id: 4, statut: 'termine', dateEcheance: '2004-11-20' }
          ];
          const seulementRetards = filtrerTicketsParUrgence(liste, true, false, '2004-11-29');
          const seulementJ2 = filtrerTicketsParUrgence(liste, false, true, '2004-11-29');
          const toutesUrgences = filtrerTicketsParUrgence(liste, true, true, '2004-11-29');
          const aucuneCase = filtrerTicketsParUrgence(liste, false, false, '2004-11-29');
          return {
            condition: JSON.stringify(seulementRetards.map(ticket => ticket.id)) === JSON.stringify([1]) &&
              JSON.stringify(seulementJ2.map(ticket => ticket.id)) === JSON.stringify([2]) &&
              JSON.stringify(toutesUrgences.map(ticket => ticket.id)) === JSON.stringify([1, 2]) &&
              aucuneCase.length === liste.length,
            detail: `Retards : ${seulementRetards.map(ticket => ticket.id)}; J-2 : ${seulementJ2.map(ticket => ticket.id)}; union : ${toutesUrgences.map(ticket => ticket.id)}.`
          };
        });

        executerTest('T37', "Compteur de retards par statut", () => {
          const liste = [
            { statut: 'backlog', dateEcheance: '2004-11-28' },
            { statut: 'backlog', dateEcheance: '2004-11-29' },
            { statut: 'encours', dateEcheance: '2004-11-27' },
            { statut: 'termine', dateEcheance: '2004-11-20' }
          ];
          const resultat = compterRetardsParStatut(liste, '2004-11-29');
          return {
            condition: resultat.backlog === 1 && resultat.encours === 1 &&
              resultat.afaire === 0 && resultat.termine === 0,
            detail: `Backlog : ${resultat.backlog}; En cours : ${resultat.encours}; Terminé : ${resultat.termine}.`
          };
        });

        executerTest('T38', "Tri Kanban remonte les échéances les plus dépassées", () => {
          const liste = [
            { id: 1, statut: 'afaire', dateEcheance: '2004-11-28' },
            { id: 2, statut: 'afaire', dateEcheance: '2004-11-20' },
            { id: 3, statut: 'afaire', dateEcheance: '2004-11-29' },
            { id: 4, statut: 'afaire', dateEcheance: null }
          ];
          const resultat = trierTicketsParUrgence(liste, '2004-11-29');
          return {
            condition: JSON.stringify(resultat.map(ticket => ticket.id)) === JSON.stringify([2, 1, 3, 4]),
            detail: `Ordre obtenu : ${resultat.map(ticket => `#${ticket.id}`).join(', ')}.`
          };
        });

        executerTest('T39', "Grille calendrier commence le lundi et couvre le mois", () => {
          const cellules = calculerCellulesCalendrier(2024, 1);
          const joursDuMois = cellules.filter(cellule => cellule.dansMois);
          return {
            condition: cellules.length % 7 === 0 && cellules[0].date === '2024-01-29' &&
              joursDuMois.length === 29 && joursDuMois[0].date === '2024-02-01' &&
              joursDuMois[28].date === '2024-02-29',
            detail: `${cellules.length} cases; premier jour affiché ${cellules[0].date}; jours du mois : ${joursDuMois.length}.`
          };
        });

        executerTest('T40', "Import JSON conserve une échéance valide", () => {
          const resultat = importerJSON(JSON.stringify([
            { id: 101, titre: 'Avec échéance', type: 'story', priorite: 2, points: 3, statut: 'backlog', dateEcheance: '2026-12-01' },
            { id: 102, titre: 'Date invalide', type: 'story', priorite: 2, points: 3, statut: 'backlog', dateEcheance: '2026-02-30' }
          ]), []);
          const ticketImporte = resultat.nouveauxTickets.find(ticket => ticket.id === 101);
          return {
            condition: resultat.ok && resultat.importes === 1 &&
              ticketImporte.dateEcheance === '2026-12-01' &&
              resultat.rejets.length === 1 && resultat.rejets[0].motif.includes("Date d'échéance"),
            detail: `${resultat.importes} importé(s), ${resultat.rejets.length} rejet(s); date conservée : ${ticketImporte?.dateEcheance}.`
          };
        });

        executerTest('T41', "Import CSV conserve une échéance valide", () => {
          const resultat = importerTickets(parserCSV([
            'id,titre,type,priorite,points,statut,dateEcheance',
            '101,Ticket daté,story,2,3,backlog,2026-12-01'
          ].join('\r\n')), []);
          const ticketImporte = resultat.nouveauxTickets?.find(ticket => ticket.id === 101);
          return {
            condition: resultat.ok && resultat.importes === 1 &&
              ticketImporte?.dateEcheance === '2026-12-01',
            detail: `Importés : ${resultat.importes}; date : ${ticketImporte?.dateEcheance}.`
          };
        });

        executerTest('T42', "Bloc échéance compact affiche date, badge et calendrier", () => {
          const dateEcheance = decalerDateISO(obtenirDateLocaleISO(), 1);
          const ticket = { id: 77, statut: 'encours', dateEcheance };
          const section = rendreSectionEcheance(ticket);
          const sectionSansDate = rendreSectionEcheance({ ...ticket, dateEcheance: null });
          return {
            condition: section.includes(`Échéance : ${formaterDateEcheance(dateEcheance)}`) &&
              section.includes('J-2') && section.includes('type="date"') &&
              section.includes('calendar-days') &&
              section.includes(`aria-label="Ouvrir le formulaire d'échéance du ticket #77"`) &&
              sectionSansDate.includes('Aucune échéance') &&
              !sectionSansDate.includes('>J-2</span>') &&
              section.includes('border-t border-slate-800/70'),
            detail: `Date lisible, badge, saisie date native et séparation des contrôles ${section.includes('type="date"') && section.includes('calendar-days') ? 'présents' : 'absents'}.`
          };
        });

        executerTest('T43', "Onglet Sprint placé entre Backlog et Kanban", () => {
          const onglets = [...document.querySelectorAll('nav button')];
          const indexBacklog = onglets.findIndex(onglet => onglet.id === 'tab-backlog');
          const indexSprint = onglets.findIndex(onglet => onglet.id === 'tab-sprint');
          const indexKanban = onglets.findIndex(onglet => onglet.id === 'tab-kanban');
          return {
            condition: indexBacklog >= 0 && indexSprint === indexBacklog + 1 &&
              indexKanban === indexSprint + 1 && document.getElementById('view-sprint') !== null,
            detail: `Positions Backlog/Sprint/Kanban : ${indexBacklog}/${indexSprint}/${indexKanban}; vue Sprint ${document.getElementById('view-sprint') ? 'présente' : 'absente'}.`
          };
        });

        executerTest('T44', "Formulaire Sprint expose les propriétés demandées", () => {
          const formulaire = document.getElementById('sprint-form');
          const champs = {
            nom: formulaire?.querySelector('#sprint-nom'),
            capacite: formulaire?.querySelector('#sprint-capacite'),
            dateDebut: formulaire?.querySelector('#sprint-date-debut'),
            dateFin: formulaire?.querySelector('#sprint-date-fin')
          };
          return {
            condition: Object.values(champs).every(champ => champ !== null && champ !== undefined) &&
              champs.nom.type === 'text' && champs.capacite.type === 'number' &&
              champs.dateDebut.type === 'date' && champs.dateFin.type === 'date',
            detail: `Champs présents : ${Object.entries(champs).filter(([, champ]) => champ).map(([nom]) => nom).join(', ') || 'aucun'}.`
          };
        });

        executerTest('T45', "Vue Sprint propose liste et actions de cycle de vie", () => {
          const vue = document.getElementById('view-sprint');
          const liste = vue?.querySelector('#sprint-liste');
          const actions = ['creer', 'modifier', 'demarrer', 'cloturer', 'supprimer'];
          const actionsAbsentes = actions.filter(action =>
            !vue?.querySelector(`[data-sprint-action="${action}"]`)
          );
          return {
            condition: Boolean(liste) && actionsAbsentes.length === 0,
            detail: `Liste ${liste ? 'présente' : 'absente'}; actions absentes : ${actionsAbsentes.join(', ') || 'aucune'}.`
          };
        });

        executerTest('T46', "Burndown actif rendu en SVG avec restant et idéal", () => {
          const svg = document.querySelector('#sprint-burndown');
          const serieRestant = svg?.querySelector('[data-serie="restant"]');
          const serieIdeale = svg?.querySelector('[data-serie="ideale"]');
          return {
            condition: svg?.namespaceURI === 'http://www.w3.org/2000/svg' &&
              Boolean(serieRestant) && Boolean(serieIdeale),
            detail: `SVG ${svg ? 'présent' : 'absent'}; série restant ${serieRestant ? 'présente' : 'absente'}, série idéale ${serieIdeale ? 'présente' : 'absente'}.`
          };
        });

        executerTest('T47', "Kanban expose les propriétés du sprint actif", () => {
          const panneau = document.querySelector('#kanban-sprint-actif');
          return {
            condition: Boolean(panneau) &&
              ['nom', 'capacite', 'date-debut', 'date-fin'].every(propriete =>
                panneau.querySelector(`[data-sprint-propriete="${propriete}"]`)
              ),
            detail: panneau ? 'Panneau présent; vérification des quatre propriétés du sprint actif.' : 'Panneau du sprint actif absent.'
          };
        });

        executerTest('T48', "Filtrage Kanban isole les tickets du sprint actif", () => {
          const liste = [
            { id: 101, sprintId: 'sprint-a', statut: 'backlog' },
            { id: 102, sprintId: 'sprint-b', statut: 'encours' },
            { id: 103, sprintId: 'sprint-a', statut: 'termine' }
          ];
          const resultat = filtrerTicketsParSprint(liste, 'sprint-a');
          return {
            condition: resultat.map(ticket => ticket.id).join(',') === '101,103' &&
              liste.length === 3,
            detail: `Tickets du sprint actif retournés : ${resultat.map(ticket => `#${ticket.id}`).join(', ') || 'aucun'}; source intacte : ${liste.length === 3 ? 'oui' : 'non'}.`
          };
        });

        executerTest('T49', "Création Sprint valide et refus des propriétés invalides", () => {
          const liste = [{ id: 4, nom: 'Sprint existant', capacite: 10, dateDebut: '2026-11-01', dateFin: '2026-11-14', statut: 'brouillon' }];
          const invalide = creerSprint(liste, '   ', -1, '2026-11-15', '2026-11-14');
          const valide = creerSprint(liste, '  Sprint test  ', 12, '2026-11-15', '2026-11-28');
          return {
            condition: !invalide.ok && invalide.erreur && valide.ok &&
              valide.sprint.id === 5 && valide.sprint.nom === 'Sprint test' &&
              valide.sprint.capacite === 12 && valide.sprint.statut === 'brouillon' &&
              liste.length === 2,
            detail: `Entrée invalide refusée : ${!invalide.ok}; création valable : ${valide.ok ? `#${valide.sprint.id} ${valide.sprint.nom}` : valide.erreur}.`
          };
        });

        executerTest('T50', "Modification des propriétés conserve le sprint si les dates sont invalides", () => {
          const sprint = { id: 8, nom: 'Sprint initial', capacite: 10, dateDebut: '2026-11-01', dateFin: '2026-11-14', statut: 'brouillon' };
          const avant = structuredClone(sprint);
          const invalide = modifierSprint(sprint, 'Sprint changé', 15, '2026-11-20', '2026-11-19');
          const intact = JSON.stringify(sprint) === JSON.stringify(avant);
          const valide = modifierSprint(sprint, 'Sprint ajusté', 15, '2026-11-02', '2026-11-15');
          return {
            condition: !invalide.ok && intact && valide.ok &&
              sprint.nom === 'Sprint ajusté' && sprint.capacite === 15 &&
              sprint.dateDebut === '2026-11-02' && sprint.dateFin === '2026-11-15',
            detail: `Modification invalide refusée sans mutation : ${!invalide.ok && intact}; modification valide appliquée : ${valide.ok}.`
          };
        });

        executerTest('T51', "Démarrage d'un sprint inconnu est refusé sans mutation", () => {
          const sprintsTest = [
            { id: 1, nom: 'Sprint brouillon', statut: 'brouillon' }
          ];
          const avant = structuredClone(sprintsTest);
          const resultat = demarrerSprint(sprintsTest, [], 999);
          return {
            condition: !resultat.ok && JSON.stringify(sprintsTest) === JSON.stringify(avant),
            detail: `Démarrage refusé : ${!resultat.ok}; liste inchangée : ${JSON.stringify(sprintsTest) === JSON.stringify(avant)}.`
          };
        });

        executerTest('T52', "Démarrage initialise un sprint actif et son restant", () => {
          const sprintsTest = [
            { id: 1, nom: 'Sprint test', capacite: 20, dateDebut: '2026-11-01', dateFin: '2026-11-14', statut: 'brouillon' }
          ];
          const ticketsTest = [
            { id: 1, sprintId: 1, statut: 'afaire', points: 5 },
            { id: 2, sprintId: 1, statut: 'termine', points: 3 },
            { id: 3, sprintId: 2, statut: 'backlog', points: 8 }
          ];
          const resultat = demarrerSprint(sprintsTest, ticketsTest, 1);
          const pointInitial = sprintsTest[0].historiqueBurndown?.[0];
          return {
            condition: resultat.ok && sprintsTest[0].statut === 'actif' &&
              pointInitial?.date === sprintsTest[0].demarreLe &&
              Number.isFinite(pointInitial?.restant),
            detail: `Démarrage accepté : ${resultat.ok}; sprint actif : ${sprintsTest[0].statut}; relevé initial : ${JSON.stringify(pointInitial)}.`
          };
        });

        executerTest('T53', "Clôture et suppression traitent le sprint sélectionné", () => {
          const sprintsTest = [{ id: 9, nom: 'Sprint à clôturer', statut: 'actif' }];
          const ticketsTest = [
            { id: 1, sprintId: 9, statut: 'encours', points: 3 },
            { id: 2, sprintId: 9, statut: 'termine', points: 5 },
            { id: 3, sprintId: 8, statut: 'afaire', points: 2 }
          ];
          const cloture = cloturerSprint(sprintsTest, ticketsTest, 9);
          const sprintsASupprimer = [{ id: 10, nom: 'Sprint à supprimer', statut: 'brouillon' }];
          const suppression = supprimerSprint(sprintsASupprimer, [], 10);
          return {
            condition: cloture.ok && sprintsTest[0].statut === 'cloture' &&
              ticketsTest[0].statut === 'backlog' && ticketsTest[1].statut === 'termine' &&
              ticketsTest[2].statut === 'afaire' && suppression.ok && sprintsASupprimer.length === 0,
            detail: `Clôture : ${cloture.ok}; ticket ouvert → ${ticketsTest[0].statut}; ticket terminé inchangé : ${ticketsTest[1].statut}; suppression : ${suppression.ok && sprintsASupprimer.length === 0}.`
          };
        });

        executerTest('T54', "Burndown SVG trace les séries restante et idéale", () => {
          const graphique = document.getElementById('sprint-burndown');
          const serieRestant = graphique?.querySelector('[data-serie="restant"]');
          const serieIdeale = graphique?.querySelector('[data-serie="ideale"]');
          const ancienEtat = {
            restant: serieRestant?.getAttribute('points'),
            ideal: serieIdeale?.getAttribute('points'),
            note: document.getElementById('sprint-burndown-note')?.textContent,
            aria: graphique?.getAttribute('aria-label')
          };
          try {
            rendreBurndownSprint({
              id: Number.MAX_SAFE_INTEGER,
              nom: 'Sprint isolé',
              statut: 'actif',
              dateDebut: '2026-11-01',
              dateFin: '2026-11-03',
              historiqueBurndown: [
                { date: '2026-11-01', restant: 10 },
                { date: '2026-11-02', restant: 5 }
              ]
            });
            const pointsRestants = serieRestant?.getAttribute('points') || '';
            const pointsIdeaux = serieIdeale?.getAttribute('points') || '';
            return {
              condition: pointsRestants.split(' ').length === 3 &&
                pointsIdeaux.split(' ').length === 2 &&
                pointsRestants !== pointsIdeaux &&
                graphique.getAttribute('aria-label').includes('Sprint isolé'),
              detail: `Série restante : ${pointsRestants || 'vide'}; série idéale : ${pointsIdeaux || 'vide'}.`
            };
          } finally {
            if (serieRestant) serieRestant.setAttribute('points', ancienEtat.restant || '');
            if (serieIdeale) serieIdeale.setAttribute('points', ancienEtat.ideal || '');
            document.getElementById('sprint-burndown-note').textContent = ancienEtat.note || '';
            graphique?.setAttribute('aria-label', ancienEtat.aria || '');
          }
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
          <span class="text-xs font-mono text-blue-400 mt-1">deplacerTickets(), obtenirBadgeEcheance(), filtrerTicketsParUrgence(), trierTicketsParUrgence(), compterRetardsParStatut(), calculerCellulesCalendrier(), migrerV5versV6(), parserCSV(), importerTickets(), importerJSON()</span>
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
