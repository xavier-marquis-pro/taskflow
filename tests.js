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

        executerTest('T5', "Tableau intact (R4)", () => {
          const liste = structuredClone(TICKETS_DEMO);
          const statutsInitiaux = liste.map(t => t.statut);
          deplacerTickets(liste, 5, 'afaire');
          deplacerTickets(liste, 9, 'backlog');
          const resultatImport = importerJSON(JSON.stringify([{
            id: 100, titre: 'Ticket importé', type: 'story', priorite: 2, points: 3, statut: 'backlog'
          }]), liste);
          const statutsFinaux = liste.map(t => t.statut);
          return {
            condition: resultatImport.ok && resultatImport.importes === 1 && liste.length === 12 &&
              JSON.stringify(statutsFinaux) === JSON.stringify(statutsInitiaux),
            detail: `Après deux refus et un import, la source contient ${liste.length} tickets et ses statuts ${JSON.stringify(statutsFinaux) === JSON.stringify(statutsInitiaux) ? 'sont inchangés' : 'ont changé'}.`
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
