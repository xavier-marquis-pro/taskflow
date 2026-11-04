    // 1. DONNÉES

    const defaultProject = { nom: "Refonte de l'espace client" };
    const COLONNES_KANBAN = [
      { id: "backlog", titre: "Backlog", wip: null },
      { id: "afaire", titre: "À faire", wip: null },
      { id: "encours", titre: "En cours", wip: 3 },
      { id: "enrevue", titre: "En revue", wip: 2 },
      { id: "termine", titre: "Terminé", wip: null }
    ];

    // ==========================================
    // STORAGE VERSIONNÉ (V5) avec Journal
    // ==========================================
    const CLE = "taskflow";
    const VERSION_ACTUELLE = 5;
    const CURRENT_USER_ID = 1;

    const USERS_DEMO = [
      { id: 1, prenom: "Alice", nom: "Martin" },
      { id: 2, prenom: "Bob", nom: "Durand" },
      { id: 3, prenom: "Charlie", nom: "Lefevre" },
      { id: 4, prenom: "Diana", nom: "Moreau" },
      { id: 5, prenom: "Ethan", nom: "Roux" },
      { id: 6, prenom: "Fiona", nom: "Fournier" },
      { id: 7, prenom: "George", nom: "Girard" },
      { id: 8, prenom: "Hannah", nom: "Andre" },
      { id: 9, prenom: "Ivan", nom: "Mercier" }
    ];

    const TICKETS_DEMO = [
      { id: 1, titre: "Connexion SSO via OAuth2", type: "story", priorite: 1, points: 5, statut: "encours", creeLe: "2026-11-01", projet: { ...defaultProject }, assigne: 1, bloquePar: [] },
      { id: 2, titre: "Correction crash au paiement Stripe", type: "bug", priorite: 1, points: 3, statut: "afaire", creeLe: "2026-11-02", projet: { ...defaultProject }, assigne: 2, bloquePar: [] },
      { id: 3, titre: "Export PDF des factures mensuelles", type: "story", priorite: 2, points: 8, statut: "backlog", creeLe: "2026-10-28", projet: { ...defaultProject }, assigne: null, bloquePar: [] },
      { id: 4, titre: "Mise à jour du design du Dashboard", type: "tache", priorite: 2, points: 5, statut: "afaire", creeLe: "2026-11-03", projet: { ...defaultProject }, assigne: 3, bloquePar: [] },
      { id: 5, titre: "Refonte de la gestion du profil utilisateur", type: "story", priorite: 2, points: null, statut: "backlog", creeLe: "2026-10-30", projet: { ...defaultProject }, assigne: null, bloquePar: [] },
      { id: 6, titre: "Bug d'affichage mode sombre sous Safari", type: "bug", priorite: 3, points: 1, statut: "backlog", creeLe: "2026-10-29", projet: { ...defaultProject }, assigne: 4, bloquePar: [] },
      { id: 7, titre: "Optimisation de la vitesse des requêtes SQL", type: "tache", priorite: 1, points: 8, statut: "encours", creeLe: "2026-10-25", projet: { ...defaultProject }, assigne: 5, bloquePar: [] },
      { id: 8, titre: "Intégration du système de notifications push", type: "story", priorite: 3, points: 13, statut: "backlog", creeLe: "2026-11-02", projet: { ...defaultProject }, assigne: null, bloquePar: [] },
      { id: 9, titre: "Erreur 404 lors du téléchargement de pièces jointes", type: "bug", priorite: 2, points: 2, statut: "termine", creeLe: "2026-10-27", projet: { ...defaultProject }, assigne: 6, bloquePar: [] },
      { id: 10, titre: "Migration des serveurs vers AWS Cloud", type: "tache", priorite: 3, points: null, statut: "backlog", creeLe: "2026-11-03", projet: { ...defaultProject }, assigne: 7, bloquePar: [] },
      { id: 11, titre: "Ajout du choix de la langue (i18n Multi-langues)", type: "story", priorite: 3, points: 3, statut: "backlog", creeLe: "2026-10-31", projet: { ...defaultProject }, assigne: 8, bloquePar: [] },
      { id: 12, titre: "Mise en place de la suite de tests E2E Cypress", type: "tache", priorite: 1, points: 5, statut: "afaire", creeLe: "2026-10-26", projet: { ...defaultProject }, assigne: 9, bloquePar: [] }
    ];

    function migrerV2versV3(data) {
      if (Array.isArray(data)) {
        return {
          tickets: data.map(t => ({ ...t, assigne: t.assigne !== undefined ? t.assigne : null })),
          users: [...USERS_DEMO],
          journal: []
        };
      }
      return {
        tickets: (data.tickets || []).map(t => ({ ...t, assigne: t.assigne !== undefined ? t.assigne : null })),
        users: data.users || [...USERS_DEMO],
        journal: data.journal || []
      };
    }

    function migrerV3versV4(data) {
      return data;
    }

    function migrerV4versV5(data) {
      return {
        ...data,
        ...("version" in data ? { version: 5 } : {}),
        tickets: data.tickets.map(ticket => (
          ticket.bloquePar === undefined ? { ...ticket, bloquePar: [] } : ticket
        ))
      };
    }

    function migrerV1versV2(tableau) {
      if (!Array.isArray(tableau)) return [];
      return tableau.map(t => ({
        ...t,
        description: t.description !== undefined ? t.description : "",
        majLe: t.majLe !== undefined ? t.majLe : (t.creeLe || new Date().toISOString().split('T')[0])
      }));
    }

    const MIGRATIONS = [
      { version: 2, fn: migrerV1versV2 },
      { version: 3, fn: migrerV2versV3 },
      { version: 4, fn: migrerV3versV4 },
      { version: 5, fn: migrerV4versV5 }
    ];

    function migrerJusquaVersion(etat, versionSource) {
      let courant = etat;
      for (const m of MIGRATIONS) {
        if (m.version > versionSource && m.version <= VERSION_ACTUELLE) {
          courant = m.fn(courant);
        }
      }
      return courant;
    }

    function sauvegarder(state) {
      try {
        localStorage.setItem(CLE, JSON.stringify({ 
          version: VERSION_ACTUELLE, 
          tickets: state.tickets, 
          users: state.users,
          journal: state.journal
        }));
      } catch (e) {
        console.warn("Échec de sauvegarde localStorage", e);
      }
    }

    function charger() {
      try {
        const brut = localStorage.getItem(CLE);
        if (brut === null) {
          return { tickets: TICKETS_DEMO.map(t => ({ ...t })), users: [...USERS_DEMO], journal: [] };
        }

        const parse = JSON.parse(brut);
        let data = { tickets: [], users: [], journal: [] };

        if (Array.isArray(parse)) {
          data = { tickets: parse, users: [...USERS_DEMO], journal: [] };
          data = migrerJusquaVersion(data, 1);
          sauvegarder(data);
        } else if (parse && typeof parse === "object" && "version" in parse) {
          data = parse;
          if (parse.version < VERSION_ACTUELLE) {
            data = migrerJusquaVersion(data, parse.version);
            sauvegarder(data);
          }
        } else {
          return { tickets: TICKETS_DEMO.map(t => ({ ...t })), users: [...USERS_DEMO], journal: [] };
        }

        return { 
          tickets: data.tickets || [], 
          users: data.users && data.users.length > 0 ? data.users : [...USERS_DEMO],
          journal: data.journal || []
        };

      } catch (e) {
        console.warn("Données corrompues, fallback DEMO", e);
        return { tickets: TICKETS_DEMO.map(t => ({ ...t })), users: [...USERS_DEMO], journal: [] };
      }
    }

    let state = charger();
    let tickets = state.tickets;
    let users = state.users;
    let journal = state.journal;

    let currentView = 'backlog';
    let ticketIdToDelete = null;
    let sortCriteria = [{ field: 'priorite', dir: 'asc' }, { field: 'points', dir: 'asc' }];
    let currentImportFileText = null;
    let currentImportFileType = null;

    // 2. RÈGLES
    // ==========================================
    // CŒUR MÉTIER & HELPERS
    // ==========================================
    function getUserById(id) {
      return users.find(u => u.id === id) || null;
    }

    function getInitials(prenom, nom) {
      return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
    }

    function validerTicketMetier(titre, typeNorm, prio, points, statut, ticketsList) {
      if (!titre || titre.trim().length < 3 || titre.trim().length > 80) return "Titre invalide (doit faire entre 3 et 80 caractères).";
      if (!['story', 'bug', 'tache'].includes(typeNorm)) return `Type inconnu ("${typeNorm}").`;
      if (isNaN(prio) || prio < 1 || prio > 3) return `Priorité invalide ("${prio}"). Doit être 1, 2 ou 3.`;
      if (points !== null && (isNaN(points) || points < 1)) return `Points invalides ("${points}").`;
      if (!['backlog', 'afaire', 'encours', 'enrevue', 'termine'].includes(statut)) return `Statut inconnu ("${statut}").`;
      return null; 
    }

    function ajouterBloquant(liste, idTicket, idBloquant) {
      const ticket = liste.find(element => element.id === idTicket);
      if (!ticket) return { ok: false, erreur: "Ticket à bloquer introuvable." };

      const bloquants = Array.isArray(ticket.bloquePar) ? ticket.bloquePar : [];
      if (bloquants.includes(idBloquant)) {
        return { ok: false, erreur: `Le ticket #${idBloquant} est déjà un bloquant.` };
      }

      const visites = new Set();
      function trouverParcours(idCourant, parcours) {
        if (idCourant === idTicket) return [...parcours, idCourant];
        if (visites.has(idCourant)) return null;
        visites.add(idCourant);

        const ticketCourant = liste.find(element => element.id === idCourant);
        if (!ticketCourant || !Array.isArray(ticketCourant.bloquePar)) return null;

        for (const idSuivant of ticketCourant.bloquePar) {
          const resultat = trouverParcours(idSuivant, [...parcours, idCourant]);
          if (resultat) return resultat;
        }
        return null;
      }

      const parcours = trouverParcours(idBloquant, []);
      if (parcours) {
        const cycle = [idTicket, ...parcours].map(id => `#${id}`).join(" → ");
        return { ok: false, erreur: `Cycle détecté : ${cycle}` };
      }

      ticket.bloquePar = [...bloquants, idBloquant];
      return { ok: true, erreur: null };
    }

    function listerBloquants(liste, ticket) {
      if (!ticket || !Array.isArray(ticket.bloquePar)) return [];
      return ticket.bloquePar
        .map(id => liste.find(element => element.id === id))
        .filter(bloquant => bloquant)
        .map(bloquant => ({ id: bloquant.id, titre: bloquant.titre }));
    }

    function supprimerTicketEtReferences(liste, idTicket) {
      return liste
        .filter(ticket => ticket.id !== idTicket)
        .map(ticket => ({
          ...ticket,
          ...(Array.isArray(ticket.bloquePar)
            ? { bloquePar: ticket.bloquePar.filter(id => id !== idTicket) }
            : {})
        }));
    }

    function deplacerTickets(list, idTicket, versStatut) {
      const idx = list.findIndex(t => t.id === idTicket);
      if (idx === -1) return { ok: false, erreur: "Ticket non trouvé dans la liste." };
      const ticket = list[idx];
      const target = COLONNES_KANBAN.find(c => c.id === versStatut);
      if (!target) return { ok: false, erreur: "Colonne destination invalide." };

      if (versStatut === 'encours' && Array.isArray(ticket.bloquePar)) {
        const bloquantsNonTermines = ticket.bloquePar
          .map(idBloquant => list.find(element => element.id === idBloquant))
          .filter(bloquant => bloquant && bloquant.statut !== 'termine')
          .map(bloquant => `#${bloquant.id}`);
        if (bloquantsNonTermines.length > 0) {
          return { ok: false, erreur: `Bloqué par ${bloquantsNonTermines.join(', ')} (non terminés).` };
        }
      }

      if (ticket.statut === 'termine' && versStatut !== 'termine') {
        return { ok: false, erreur: `Règle R5 : Le ticket "#${ticket.id}" est terminé (état puits).` };
      }
      
      if (versStatut === 'termine' && ticket.statut !== 'enrevue') {
        return { ok: false, erreur: `Règle R6 (PO) : Le ticket doit passer par "En revue" avant d'être terminé.` };
      }

      if (ticket.points === null && ticket.statut === 'backlog' && versStatut !== 'backlog') {
        return { ok: false, erreur: `Règle R2 : Le ticket non estimé "#${ticket.id}" ne peut pas quitter le Backlog.` };
      }
      
      if (target.wip !== null && list.filter(t => t.statut === versStatut && t.id !== idTicket).length >= target.wip) {
        return { ok: false, erreur: `Règle R1 : La colonne "${target.titre}" a atteint sa limite WIP (${target.wip}).` };
      }

      // Mémoriser pour le journal
      const statutOrigine = ticket.statut;
      
      // Appliquer le déplacement
      ticket.statut = versStatut;

      // Enregistrer dans le journal
      enregistrerMouvement(ticket, statutOrigine, versStatut);

      return { ok: true, ticketsDeplaces: [ticket] };
    }

    function enregistrerMouvement(ticket, statutOrigine, statutCible) {
      if (statutOrigine === statutCible) return;
      
      const mouvement = {
        ticketId: ticket.id,
        ticketTitre: ticket.titre,
        statutOrigine: statutOrigine,
        statutCible: statutCible,
        date: new Date().toISOString()
      };

      // On ajoute au début (le plus récent en premier)
      journal.unshift(mouvement);

      // On limite à 10 éléments
      if (journal.length > 10) {
        journal = journal.slice(0, 10);
      }
    }

    function statutApresControleWip(statut, listeTickets) {
      const colonne = COLONNES_KANBAN.find(c => c.id === statut);
      if (!colonne || colonne.wip === null) return { statut, motif: null, message: null };
      if (listeTickets.filter(t => t.statut === statut).length < colonne.wip) {
        return { statut, motif: null, message: null };
      }
      const message = statut === 'encours'
        ? "Colonne 'En cours' pleine. Le ticket a été basculé dans le Backlog."
        : "Colonne 'En revue' pleine (WIP 2). Le ticket a été basculé dans le Backlog.";
      return {
        statut: 'backlog',
        motif: `WIP "${colonne.titre}" plein. Basculé en Backlog.`,
        message
      };
    }

    function sortTickets(list) {
      return [...list].sort((a, b) => {
        for (const crit of sortCriteria) {
          const m = crit.dir === 'asc' ? 1 : -1;
          let res = 0;
          if (crit.field === 'points') {
            if (a.points === null && b.points === null) res = 0;
            else if (a.points === null) res = 1;
            else if (b.points === null) res = -1;
            else res = a.points - b.points;
          } else if (crit.field === 'priorite') res = a.priorite - b.priorite;
          else if (crit.field === 'titre') res = a.titre.localeCompare(b.titre);
          else if (crit.field === 'type') res = a.type.localeCompare(b.type);
          else if (crit.field === 'statut') res = a.statut.localeCompare(b.statut);
          else if (crit.field === 'creeLe') res = a.creeLe.localeCompare(b.creeLe);
          if (res !== 0) return res * m;
        }
        return 0;
      });
    }

    // ==========================================
    // PARSEURS CSV/JSON
    // ==========================================
    function parserCSV(texte) {
      const lignes = []; let ligne = [], champ = '', dansGuillemets = false;
      for (let i = 0; i < texte.length; i++) {
        const c = texte[i];
        if (c === '"') { if (dansGuillemets && texte[i+1] === '"') { champ += '"'; i++; } else dansGuillemets = !dansGuillemets; }
        else if (c === ',' && !dansGuillemets) { ligne.push(champ); champ = ''; }
        else if ((c === '\n' || c === '\r') && !dansGuillemets) {
          if (champ !== '' || ligne.length > 0) { ligne.push(champ); if (ligne.some(x => x.trim() !== '')) lignes.push(ligne); ligne = []; champ = ''; }
          if (c === '\r' && texte[i+1] === '\n') i++;
        } else champ += c;
      }
      if (champ !== '' || ligne.length > 0) { ligne.push(champ); if (ligne.some(x => x.trim() !== '')) lignes.push(ligne); }
      return lignes;
    }

    function importerTickets(lignesBrutes, ticketsExistants) {
      if (!lignesBrutes || lignesBrutes.length < 2) return { ok: false, erreur: "Fichier vide ou sans données." };
      const header = lignesBrutes[0].map(h => h.trim().toLowerCase());
      const attendus = ['id', 'titre', 'type', 'priorite', 'points', 'statut'];
      if (!attendus.every(a => header.includes(a))) return { ok: false, erreur: "En-tête CSV invalide." };

      const col = {}; attendus.forEach(a => col[a] = header.indexOf(a));
      const colAssigne = header.indexOf('assigne');

      let importes = 0, rejets = [], nouveauxTickets = [...ticketsExistants];
      let maxId = nouveauxTickets.reduce((max, t) => Math.max(max, t.id), 0);

      for (let i = 1; i < lignesBrutes.length; i++) {
        const row = lignesBrutes[i], lineNum = i + 1;
        if (row.length < header.length) { rejets.push({ ligne: lineNum, motif: "Colonnes manquantes." }); continue; }

        let idNum = parseInt(row[col['id']]?.trim(), 10);
        if (isNaN(idNum) || idNum <= 0) { rejets.push({ ligne: lineNum, motif: `ID invalide.` }); continue; }

        let typeNorm = (row[col['type']]?.trim() || '').toLowerCase();
        if (typeNorm === 'tâche') typeNorm = 'tache';
        let prio = parseInt(row[col['priorite']]?.trim(), 10);
        let pointsBrut = row[col['points']]?.trim();
        let points = (pointsBrut !== '' && pointsBrut !== '?' && pointsBrut.toLowerCase() !== 'null') ? Number(pointsBrut) : null;
        let statut = (row[col['statut']]?.trim() || '').toLowerCase();
        let titre = row[col['titre']]?.trim();
        let assigne = colAssigne !== -1 && row[colAssigne] ? parseInt(row[colAssigne].trim(), 10) : null;

        const motifRejet = validerTicketMetier(titre, typeNorm, prio, points, statut, nouveauxTickets);
        if (motifRejet) { rejets.push({ ligne: lineNum, motif: motifRejet }); continue; }

        const controleWip = statutApresControleWip(statut, nouveauxTickets);
        statut = controleWip.statut;
        if (controleWip.motif) rejets.push({ ligne: lineNum, motif: controleWip.motif });

        let finalId = nouveauxTickets.some(t => t.id === idNum) ? ++maxId : idNum;
        maxId = Math.max(maxId, finalId);

        const now = new Date().toISOString().split('T')[0];
        nouveauxTickets.push({ id: finalId, titre, type: typeNorm, priorite: prio, points, statut, creeLe: now, projet: { ...defaultProject }, description: "", majLe: now, assigne: isNaN(assigne) ? null : assigne, bloquePar: [] });
        importes++;
      }
      return { ok: true, importes, rejets, nouveauxTickets };
    }

    function importerJSON(jsonText, ticketsExistants) {
      let parsed;
      try { parsed = JSON.parse(jsonText); } catch (e) { return { ok: false, erreur: "JSON invalide." }; }
      
      let items = [];
      if (Array.isArray(parsed)) items = parsed;
      else if (parsed && Array.isArray(parsed.tickets)) items = parsed.tickets;
      else return { ok: false, erreur: "Le JSON doit être un tableau ou un objet avec 'tickets'." };

      let importes = 0, rejets = [], nouveauxTickets = [...ticketsExistants];
      let maxId = nouveauxTickets.reduce((max, t) => Math.max(max, t.id), 0);

      for (let i = 0; i < items.length; i++) {
        const item = items[i], lineNum = i + 1;
        let idNum = parseInt(item.id, 10);
        if (isNaN(idNum) || idNum <= 0) { rejets.push({ ligne: lineNum, motif: `ID invalide.` }); continue; }

        let typeNorm = (item.type || '').trim().toLowerCase();
        if (typeNorm === 'tâche') typeNorm = 'tache';
        let prio = parseInt(item.priorite, 10);
        let points = (item.points === undefined || item.points === null || item.points === '?' || item.points === '') ? null : Number(item.points);
        let statut = (item.statut || '').trim().toLowerCase();
        let titre = (item.titre || '').trim();
        let assigne = item.assigne !== undefined ? parseInt(item.assigne, 10) : null;

        const motifRejet = validerTicketMetier(titre, typeNorm, prio, points, statut, nouveauxTickets);
        if (motifRejet) { rejets.push({ ligne: lineNum, motif: motifRejet }); continue; }

        const controleWip = statutApresControleWip(statut, nouveauxTickets);
        statut = controleWip.statut;
        if (controleWip.motif) rejets.push({ ligne: lineNum, motif: controleWip.motif });

        let finalId = nouveauxTickets.some(t => t.id === idNum) ? ++maxId : idNum;
        maxId = Math.max(maxId, finalId);

        const now = new Date().toISOString().split('T')[0];
        nouveauxTickets.push({ id: finalId, titre, type: typeNorm, priorite: prio, points, statut, creeLe: now, projet: { ...defaultProject }, description: "", majLe: now, assigne: isNaN(assigne) ? null : assigne, bloquePar: [] });
        importes++;
      }
      return { ok: true, importes, rejets, nouveauxTickets };
    }

    // 3. UI
    // ==========================================
    // UI HELPERS
    // ==========================================
    function getTypeBadge(type) {
      switch(type) {
        case 'story': return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">Story</span>`;
        case 'bug': return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">Bug</span>`;
        case 'tache': return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Tâche</span>`;
        default: return type;
      }
    }
    function getPriorityBadge(p) {
      switch(Number(p)) {
        case 1: return `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">P1</span>`;
        case 2: return `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">P2</span>`;
        case 3: return `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">P3</span>`;
        default: return '';
      }
    }
    
    function getAssigneBtn(t) {
      const u = t.assigne ? getUserById(t.assigne) : null;
      if (u) {
        return `<button onclick="event.stopPropagation(); openAssignModal(${t.id})" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors" title="Assigné à ${u.prenom} ${u.nom}">
          <span class="w-4 h-4 rounded-full bg-blue-600 text-[9px] font-bold flex items-center justify-center">${getInitials(u.prenom, u.nom)}</span>
          <span class="text-[10px] max-w-[60px] truncate">${u.prenom}</span>
        </button>`;
      } else {
        return `<button onclick="event.stopPropagation(); openAssignModal(${t.id})" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors" title="Non assigné">
          <i data-lucide="user" class="w-3.5 h-3.5"></i>
          <span class="text-[10px]">Assigner</span>
        </button>`;
      }
    }

    function showToastError(msg) { document.getElementById('toast-error-message').textContent = msg; document.getElementById('toast-error').classList.remove('hidden'); }
    function hideToastError() { document.getElementById('toast-error').classList.add('hidden'); }
    function afficherErreur(msg) { showToastError(msg); }

    function echapperHTML(texte) {
      return String(texte).replace(/[&<>"']/g, caractere => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[caractere]);
    }

    function rendreBadgeBloquants(liste, ticket) {
      const bloquants = listerBloquants(liste, ticket);
      if (bloquants.length === 0) return '';
      const libelle = bloquants.map(bloquant => `#${bloquant.id} ${bloquant.titre}`).join(', ');
      return `<div class="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-1" title="${echapperHTML(libelle)}">🔒 Bloqué par ${echapperHTML(libelle)}</div>`;
    }

    function updateHeaderMetrics(found) {
      document.getElementById('metric-total-tickets').textContent = tickets.length;
      document.getElementById('metric-found-tickets').textContent = found;
      document.getElementById('metric-total-points').textContent = `${tickets.reduce((s,t)=>s+(t.points||0),0)} pts`;
      document.getElementById('metric-unestimated').textContent = tickets.filter(t => t.points === null).length;
    }

    function calculerStatistiquesKanban(listeTickets) {
      const total = listeTickets.length;
      const termines = listeTickets.filter(t => t.statut === 'termine').length;
      const encours = listeTickets.filter(t => t.statut === 'encours').length;
      const enrevue = listeTickets.filter(t => t.statut === 'enrevue').length;
      const pointsTotal = listeTickets.reduce((s, t) => s + (t.points || 0), 0);
      const pointsTermines = listeTickets
        .filter(t => t.statut === 'termine')
        .reduce((s, t) => s + (t.points || 0), 0);
      return {
        total,
        termines,
        encours,
        enrevue,
        pointsTotal,
        pointsTermines,
        nonEstimes: listeTickets.filter(t => t.points === null).length,
        pct: total > 0 ? Math.round((termines / total) * 100) : 0
      };
    }

    function renderSortControls() {
      const c = document.getElementById('sort-criteria-container');
      c.innerHTML = '';
      sortCriteria.forEach((crit, i) => {
        const chip = document.createElement('div');
        chip.className = "flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-lg p-1 text-xs";
        chip.innerHTML = `
          <span class="text-[10px] text-slate-500 font-bold px-0.5">${i+1}.</span>
          <select onchange="updateSortField(${i}, this.value)" class="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded px-1.5 py-0.5 focus:outline-none">
            <option value="priorite" ${crit.field==='priorite'?'selected':''}>Priorité</option>
            <option value="points" ${crit.field==='points'?'selected':''}>Points</option>
            <option value="type" ${crit.field==='type'?'selected':''}>Type</option>
            <option value="statut" ${crit.field==='statut'?'selected':''}>Statut</option>
            <option value="titre" ${crit.field==='titre'?'selected':''}>Titre</option>
            <option value="creeLe" ${crit.field==='creeLe'?'selected':''}>Date</option>
          </select>
          <button onclick="toggleSortDirection(${i})" class="p-0.5 hover:bg-slate-800 rounded text-blue-400 font-bold text-[10px]">${crit.dir==='asc'?'▲ ASC':'▼ DESC'}</button>
          ${sortCriteria.length>1?`<button onclick="removeSortCriterion(${i})" class="p-0.5 text-slate-500 hover:text-rose-400 rounded"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>`:''}
        `;
        c.appendChild(chip);
      });
      lucide.createIcons();
    }

    // ==========================================
    // RENDER
    // ==========================================
    function renderApp() {
      renderSortControls();
      
      const q = document.getElementById('search-input').value.trim().toLowerCase();
      const types = Array.from(document.querySelectorAll('.filter-type:checked')).map(cb => cb.value);
      const prios = Array.from(document.querySelectorAll('.filter-priority:checked')).map(cb => Number(cb.value));
      const stats = Array.from(document.querySelectorAll('.filter-status:checked')).map(cb => cb.value);
      
      const filterUser = document.getElementById('filter-user-select').value;
      const isMyTicketsActive = document.getElementById('btn-my-tickets').classList.contains('btn-filter-active');

      document.getElementById('filter-type-all').checked = types.length === 3;
      document.getElementById('filter-priority-all').checked = prios.length === 3;
      document.getElementById('filter-status-all').checked = stats.length === 5;

      const isFiltered = q !== '' || types.length < 3 || prios.length < 3 || stats.length < 5 || filterUser !== 'all' || isMyTicketsActive;
      document.getElementById('btn-reset-filters').classList.toggle('hidden', !isFiltered);

      const filtered = tickets.filter(t => {
        if (!t.titre.toLowerCase().includes(q)) return false;
        if (!types.includes(t.type)) return false;
        if (!prios.includes(t.priorite)) return false;
        if (!stats.includes(t.statut)) return false;

        if (isMyTicketsActive) {
          if (t.assigne !== CURRENT_USER_ID) return false;
        } 
        else if (filterUser !== 'all') {
          if (t.assigne !== Number(filterUser)) return false;
        }

        return true;
      });
      
      const sorted = sortTickets(filtered);

      updateHeaderMetrics(sorted.length);
      document.getElementById('showing-count').textContent = `${sorted.length} / ${tickets.length} affiché(s)`;

      if (currentView === 'backlog') renderBacklogView(sorted);
      else if (currentView === 'kanban') renderKanbanView(sorted);
    }

    function renderBacklogView(list) {
      const container = document.getElementById('tickets-container');
      container.innerHTML = '';
      if (list.length === 0) {
        container.innerHTML = `<div class="h-48 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl"><p class="text-xs font-semibold text-slate-400">Aucun ticket correspondant aux filtres</p></div>`;
        return;
      }
      list.forEach(t => {
        const card = document.createElement('div');
        card.className = "bg-slate-900 border border-slate-800/90 hover:border-slate-700 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all";
        const pts = t.points === null ? `<span class="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 font-medium">Non estimé</span>` : `<span class="text-[10px] font-semibold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20">${t.points} pts</span>`;
        
        card.innerHTML = `
          <div class="flex items-start gap-2.5 flex-1 min-w-0">
            <div class="mt-0.5 shrink-0">${getTypeBadge(t.type)}</div>
            <div class="space-y-0.5 flex-1 min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[11px] font-mono text-slate-500 font-semibold">#${t.id}</span>
                <h3 class="text-xs font-semibold text-slate-100 truncate" title="${t.titre}">${t.titre}</h3>
              </div>
              ${rendreBadgeBloquants(tickets, t)}
              <div class="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                <span class="text-slate-300 font-medium bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-700/60">${t.projet ? t.projet.nom : 'Projet inconnu'}</span>
                <span>• ${t.creeLe}</span>
                <span>• Statut: <span class="text-slate-200 font-semibold uppercase">${t.statut}</span></span>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-0 border-slate-800/60 pt-2 sm:pt-0">
            <div class="flex items-center gap-1.5">
              ${getAssigneBtn(t)}
              ${getPriorityBadge(t.priorite)}${pts}
            </div>
            <button type="button" onclick="openDependancesModal(${t.id})" class="p-1 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition-all" aria-label="Modifier les tickets bloquants de #${t.id}" title="Modifier les bloquants">🔒</button>
            <button onclick="promptDeleteTicket(${t.id}, '${t.titre.replace(/'/g, "\\'")}')" class="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all">X</button>
          </div>`;
        container.appendChild(card);
      });
    }

    function renderKanbanView(list) {
      const statistiques = calculerStatistiquesKanban(tickets);
      const { total, encours, enrevue, pointsTotal, pointsTermines, pct, nonEstimes } = statistiques;

      const db = document.getElementById('dashboard-kpi');
      db.innerHTML = `
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 flex-1 flex flex-col justify-between">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avancement</span>
          <div class="flex items-center justify-between mt-1"><span class="text-lg font-extrabold text-emerald-400">${pct}%</span></div>
          <div class="w-full bg-slate-800 rounded-full h-1.5 mt-2"><div class="bg-emerald-500 h-1.5 rounded-full" style="width: ${pct}%"></div></div>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 flex-1 flex flex-col justify-between">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Points terminés / Total</span>
          <div class="flex items-center justify-between mt-1"><span class="text-lg font-extrabold text-blue-400">${pointsTermines} / ${pointsTotal}</span></div>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 flex-1 flex flex-col justify-between">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tickets en cours</span>
          <div class="flex items-center justify-between mt-1"><span class="text-lg font-extrabold text-amber-400">${encours}</span></div>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 flex-1 flex flex-col justify-between">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tickets en revue</span>
          <div class="flex items-center justify-between mt-1"><span class="text-lg font-extrabold text-purple-400">${enrevue}</span></div>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-3 flex-1 flex flex-col justify-between">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Non estimés</span>
          <div class="flex items-center justify-between mt-1"><span class="text-lg font-extrabold text-slate-300">${nonEstimes}</span></div>
        </div>
      `;

      const board = document.getElementById('kanban-board');
      board.innerHTML = '';

      COLONNES_KANBAN.forEach((col, idx) => {
        const colTickets = list.filter(t => t.statut === col.id);
        const totalAll = tickets.filter(t => t.statut === col.id).length;
        const el = document.createElement('div');
        el.className = "flex flex-col bg-slate-900/60 border border-slate-800/90 rounded-xl p-2.5 h-full overflow-hidden min-h-[400px]";

        el.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; });

        el.addEventListener("drop", (e) => {
            e.preventDefault();
            const idTicket = Number(e.dataTransfer.getData("text/plain"));
            if (isNaN(idTicket)) return;

            const ticketOrigine = tickets.find(t => t.id === idTicket);
            const statutOrigine = ticketOrigine ? ticketOrigine.statut : null;

            const r = deplacerTickets(tickets, idTicket, col.id);

            if (!r.ok) {
                afficherErreur(r.erreur);
                if (statutOrigine && ticketOrigine) ticketOrigine.statut = statutOrigine;
                renderApp();
            } else {
                sauvegarder({ tickets, users, journal });
                renderApp();
            }
        });

        let wipBadge = col.wip !== null ? `<span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${totalAll >= col.wip ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-400'}">WIP: ${totalAll}/${col.wip}</span>` : `<span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-400">${totalAll}</span>`;

        el.innerHTML = `
          <div class="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <h3 class="text-xs font-bold text-slate-200 uppercase tracking-wider">${col.titre}</h3>
            ${wipBadge}
          </div>
          <div class="flex-1 overflow-y-auto space-y-2 pr-1" id="kanban-col-${col.id}"></div>`;
        board.appendChild(el);

        const cc = el.querySelector(`#kanban-col-${col.id}`);
        if (colTickets.length === 0) {
          cc.innerHTML = `<p class="text-[11px] text-slate-600 text-center py-4 border border-dashed border-slate-800/60 rounded-lg">Aucun ticket</p>`;
        } else {
          colTickets.forEach(t => {
            const card = document.createElement('div');
            card.className = "bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-2 hover:border-slate-700 transition-all shadow-sm cursor-grab";

            card.draggable = true;
            card.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; card.classList.add('dragging'); });
            card.addEventListener("dragend", () => { card.classList.remove('dragging'); });

            const prev = idx > 0 ? COLONNES_KANBAN[idx-1] : null;
            const next = idx < COLONNES_KANBAN.length-1 ? COLONNES_KANBAN[idx+1] : null;
            const isTermine = t.statut === 'termine';
            const isDirectToTermineForbidden = (t.statut === 'encours' && next && next.id === 'termine');
            
            card.innerHTML = `
              <div class="flex items-center justify-between gap-1">
                <span class="text-[10px] font-mono text-slate-500 font-semibold">#${t.id}</span>
                <div class="flex items-center gap-1">${getTypeBadge(t.type)}${getPriorityBadge(t.priorite)}</div>
              </div>
              <h4 class="text-xs font-semibold text-slate-100 leading-snug line-clamp-2">${t.titre}</h4>
              ${rendreBadgeBloquants(tickets, t)}
              <div class="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
                <div class="flex items-center gap-1">
                  ${getAssigneBtn(t)}
                  ${t.points===null?`<span class="text-amber-400 font-medium ml-1">Non estimé</span>`:`<span class="text-blue-400 font-bold ml-1">${t.points} pts</span>`}
                </div>
                <div class="flex items-center gap-1">
                  <button type="button" onclick="openDependancesModal(${t.id})" class="p-1 rounded bg-slate-800 hover:bg-amber-900/50 text-amber-300 transition-colors" aria-label="Modifier les tickets bloquants de #${t.id}" title="Modifier les bloquants">🔒</button>
                  <button onclick="handleMoveTicket(${t.id}, '${prev?prev.id:''}')" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors" ${(!prev||isTermine)?'disabled':''}>&lt;</button>
                  <button onclick="handleMoveTicket(${t.id}, '${next?next.id:''}')" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors" ${(!next||isTermine||isDirectToTermineForbidden)?'disabled':''}>&gt;</button>
                </div>
              </div>`;
            cc.appendChild(card);
          });
        }
      });
    }

    window.handleMoveTicket = function(id, statut) {
      hideToastError();
      const r = deplacerTickets(tickets, id, statut);
      if (!r.ok) showToastError(r.erreur);
      else { sauvegarder({ tickets, users, journal }); renderApp(); }
    };
    window.updateSortField = (i, v) => { sortCriteria[i].field = v; renderApp(); };
    window.toggleSortDirection = (i) => { sortCriteria[i].dir = sortCriteria[i].dir === 'asc' ? 'desc' : 'asc'; renderApp(); };
    window.removeSortCriterion = (i) => { sortCriteria.splice(i,1); renderApp(); };

    document.getElementById('btn-add-sort-criterion').addEventListener('click', () => {
      const avail = ['priorite','points','type','statut','titre','creeLe'];
      const unused = avail.find(f => !sortCriteria.some(c => c.field === f)) || 'titre';
      sortCriteria.push({ field: unused, dir: 'asc' });
      renderApp();
    });
    document.getElementById('btn-reset-sort').addEventListener('click', () => {
      sortCriteria = [{ field: 'priorite', dir: 'asc' }, { field: 'points', dir: 'asc' }];
      renderApp();
    });

    // ==========================================
    // MODAL JOURNAL & ANNULATION
    // ==========================================
    const journalBackdrop = document.getElementById('journal-modal-backdrop');
    const journalBox = document.getElementById('journal-modal-box');
    const btnUndoLast = document.getElementById('btn-undo-last');

    function renderJournalPopup() {
      const list = document.getElementById('journal-list');
      list.innerHTML = '';

      if (journal.length === 0) {
        list.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">Aucun déplacement enregistré pour le moment.</div>`;
        btnUndoLast.disabled = true;
      } else {
        btnUndoLast.disabled = false;
        journal.forEach(m => {
          const item = document.createElement('div');
          item.className = "bg-slate-950/50 p-2.5 rounded-lg border border-slate-800 text-xs flex flex-col gap-1";
          
          const heure = new Date(m.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          
          item.innerHTML = `
            <div class="flex items-center justify-between">
              <span class="font-semibold text-slate-200">#${m.ticketId} - ${m.ticketTitre}</span>
              <span class="text-[10px] text-slate-500">${heure}</span>
            </div>
            <div class="text-[11px] flex items-center gap-1.5 mt-0.5">
              <span class="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase font-bold text-[9px]">${m.statutOrigine}</span>
              <i data-lucide="arrow-right" class="w-3 h-3 text-slate-600"></i>
              <span class="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 uppercase font-bold text-[9px]">${m.statutCible}</span>
            </div>
          `;
          list.appendChild(item);
        });
      }
      lucide.createIcons();
    }

    document.getElementById('btn-open-journal').addEventListener('click', () => {
      renderJournalPopup();
      journalBackdrop.classList.remove('opacity-0', 'pointer-events-none');
      journalBox.classList.remove('scale-95'); journalBox.classList.add('scale-100');
    });

    function closeJournalModal() {
      journalBackdrop.classList.add('opacity-0', 'pointer-events-none');
      journalBox.classList.remove('scale-100'); journalBox.classList.add('scale-95');
    }
    document.getElementById('btn-close-journal-x').addEventListener('click', closeJournalModal);
    document.getElementById('btn-close-journal').addEventListener('click', closeJournalModal);

    // Action d'annulation
    btnUndoLast.addEventListener('click', () => {
      if (journal.length === 0) return;
      
      // Récupérer le dernier mouvement (le premier du tableau)
      const dernierMouvement = journal[0];
      
      // Trouver le ticket concerné
      const ticket = tickets.find(t => t.id === dernierMouvement.ticketId);
      
      if (ticket) {
        // Annuler le déplacement en restaurant le statut d'origine
        ticket.statut = dernierMouvement.statutOrigine;
      }
      
      // Retirer le mouvement du journal
      journal.shift();
      
      // Sauvegarder et rafraîchir
      sauvegarder({ tickets, users, journal });
      renderApp();
      renderJournalPopup(); // Mettre à jour la popup
      closeJournalModal(); // Fermer la popup
      hideToastError();
    });

    // ==========================================
    // MODAL AFFECTATION
    // ==========================================
    const assignBackdrop = document.getElementById('assign-modal-backdrop');
    const assignBox = document.getElementById('assign-modal-box');
    let currentAssignTicketId = null;

    window.openAssignModal = function(id) {
      currentAssignTicketId = id;
      const t = tickets.find(x => x.id === id);
      if (!t) return;
      
      document.getElementById('assign-ticket-title').textContent = `#${t.id} - ${t.titre}`;
      document.getElementById('assign-search').value = '';
      
      renderAssignUserList('');
      
      assignBackdrop.classList.remove('opacity-0', 'pointer-events-none');
      assignBox.classList.remove('scale-95'); assignBox.classList.add('scale-100');
      document.getElementById('assign-search').focus();
    };

    function closeAssignModal() {
      assignBackdrop.classList.add('opacity-0', 'pointer-events-none');
      assignBox.classList.remove('scale-100'); assignBox.classList.add('scale-95');
      currentAssignTicketId = null;
    }

    function renderAssignUserList(query) {
      const list = document.getElementById('assign-user-list');
      list.innerHTML = '';
      const q = query.toLowerCase();
      
      const filteredUsers = users.filter(u => 
        u.prenom.toLowerCase().includes(q) || u.nom.toLowerCase().includes(q)
      );

      if (filteredUsers.length === 0) {
        list.innerHTML = `<p class="text-[11px] text-slate-500 text-center py-4">Aucun utilisateur trouvé.</p>`;
        return;
      }

      filteredUsers.forEach(u => {
        const btn = document.createElement('button');
        btn.className = "w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 text-left transition-colors border border-transparent hover:border-slate-700";
        btn.innerHTML = `
          <div class="w-6 h-6 rounded-full bg-blue-600 text-[10px] font-bold text-white flex items-center justify-center shrink-0">
            ${getInitials(u.prenom, u.nom)}
          </div>
          <div class="min-w-0">
            <p class="text-xs font-semibold text-slate-200 truncate">${u.prenom} ${u.nom}</p>
          </div>
        `;
        btn.onclick = () => {
          const t = tickets.find(x => x.id === currentAssignTicketId);
          if (t) {
            t.assigne = u.id;
            sauvegarder({ tickets, users, journal });
            closeAssignModal();
            renderApp();
          }
        };
        list.appendChild(btn);
      });
    }

    document.getElementById('assign-search').addEventListener('input', (e) => renderAssignUserList(e.target.value));
    document.getElementById('btn-close-assign-x').addEventListener('click', closeAssignModal);
    document.getElementById('btn-cancel-assign').addEventListener('click', closeAssignModal);
    document.getElementById('btn-unassign').addEventListener('click', () => {
      const t = tickets.find(x => x.id === currentAssignTicketId);
      if (t) {
        t.assigne = null;
        sauvegarder({ tickets, users, journal });
        closeAssignModal();
        renderApp();
      }
    });

    // ==========================================
    // TABS & AUTOTESTS
    // ==========================================
    const tabBacklog = document.getElementById('tab-backlog');
    const tabKanban = document.getElementById('tab-kanban');
    const tabAutoTest = document.getElementById('tab-autotest');
    const viewBacklog = document.getElementById('view-backlog');
    const viewKanban = document.getElementById('view-kanban');
    const viewAutoTest = document.getElementById('view-autotest');
    const sortBar = document.getElementById('sort-bar-container');

    function setActiveTab(active) {
      const base = "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ";
      tabBacklog.className = base + "text-slate-400 hover:text-slate-200";
      tabKanban.className = base + "text-slate-400 hover:text-slate-200";
      tabAutoTest.className = base + "text-slate-400 hover:text-slate-300";
      viewBacklog.classList.add('hidden');
      viewKanban.classList.add('hidden');
      viewAutoTest.classList.add('hidden');

      if (active === 'backlog') {
        currentView = 'backlog';
        tabBacklog.className = base + "bg-blue-600 text-white shadow-sm";
        viewBacklog.classList.remove('hidden');
        sortBar.classList.remove('hidden');
      } else if (active === 'kanban') {
        currentView = 'kanban';
        tabKanban.className = base + "bg-blue-600 text-white shadow-sm";
        viewKanban.classList.remove('hidden');
        viewKanban.classList.add('flex');
        sortBar.classList.add('hidden');
      } else if (active === 'autotest') {
        currentView = 'autotest';
        tabAutoTest.className = base + "bg-amber-600 text-slate-950 font-bold shadow-sm";
        viewAutoTest.classList.remove('hidden');
        sortBar.classList.add('hidden');
        runAutoTestsSuite();
      }
      hideToastError();
      renderApp();
    }

    tabBacklog.addEventListener('click', () => setActiveTab('backlog'));
    tabKanban.addEventListener('click', () => setActiveTab('kanban'));
    tabAutoTest.addEventListener('click', () => setActiveTab('autotest'));

    // ==========================================
    // IMPORT / EXPORT / RESET / RECHARGE
    // ==========================================
    document.getElementById('btn-reload-storage').addEventListener('click', () => {
      state = charger();
      tickets = state.tickets;
      users = state.users;
      journal = state.journal;
      renderApp();
      alert("Données rechargées depuis le localStorage !");
    });

    const importBackdrop = document.getElementById('import-modal-backdrop');
    const importBox = document.getElementById('import-modal-box');
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');
    const fileNameDisplay = document.getElementById('file-name');
    const btnRunImport = document.getElementById('btn-run-import');
    const importResult = document.getElementById('import-result');
    const importSummary = document.getElementById('import-summary');
    const importRejects = document.getElementById('import-rejects');
    const importActionsInitial = document.getElementById('import-actions-initial');
    const btnCloseImportFinal = document.getElementById('btn-close-import-final');

    function openImportModal() {
      importBackdrop.classList.remove('opacity-0', 'pointer-events-none');
      importBox.classList.remove('scale-95'); importBox.classList.add('scale-100');
      currentImportFileText = null; currentImportFileType = null;
      fileNameDisplay.classList.add('hidden'); importResult.classList.add('hidden');
      fileInput.value = ''; btnRunImport.disabled = true;
      importActionsInitial.classList.remove('hidden'); btnCloseImportFinal.classList.add('hidden');
    }

    function closeImportModal() {
      importBackdrop.classList.add('opacity-0', 'pointer-events-none');
      importBox.classList.remove('scale-100'); importBox.classList.add('scale-95');
    }

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-emerald-500', 'bg-slate-900/80'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('border-emerald-500', 'bg-slate-900/80'); });
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('border-emerald-500', 'bg-slate-900/80'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });

    function handleFile(file) {
      const isCSV = file.name.endsWith('.csv'), isJSON = file.name.endsWith('.json');
      if (!isCSV && !isJSON) { alert("Veuillez sélectionner un fichier CSV ou JSON."); return; }
      currentImportFileType = isCSV ? 'csv' : 'json';
      fileNameDisplay.textContent = file.name; fileNameDisplay.classList.remove('hidden');
      const reader = new FileReader();
      reader.onload = (e) => { currentImportFileText = e.target.result; btnRunImport.disabled = false; };
      reader.readAsText(file);
    }

    document.getElementById('btn-import-modal').addEventListener('click', openImportModal);
    document.getElementById('btn-close-import-x').addEventListener('click', closeImportModal);
    document.getElementById('btn-cancel-import').addEventListener('click', closeImportModal);
    btnCloseImportFinal.addEventListener('click', closeImportModal);

    btnRunImport.addEventListener('click', () => {
      if (!currentImportFileText) return;
      let res;
      if (currentImportFileType === 'csv') {
        const lignes = parserCSV(currentImportFileText);
        res = importerTickets(lignes, tickets);
      } else {
        res = importerJSON(currentImportFileText, tickets);
      }
      if (!res.ok) {
        importSummary.className = "text-xs font-semibold text-rose-400";
        importSummary.textContent = "Erreur d'import : " + res.erreur;
        importRejects.classList.add('hidden');
      } else {
        importSummary.className = "text-xs font-semibold text-emerald-400";
        importSummary.textContent = `Import réussi : ${res.importes} ticket(s) ajouté(s).`;
        if (res.rejets.length > 0) {
          importRejects.classList.remove('hidden');
          importRejects.innerHTML = res.rejets.map(r => `<div class="flex items-start gap-1"><span class="font-bold shrink-0">Ligne ${r.ligne}:</span> <span>${r.motif}</span></div>`).join('');
        } else { importRejects.classList.add('hidden'); }
        tickets = res.nouveauxTickets;
        sauvegarder({ tickets, users, journal });
        renderApp();
      }
      importResult.classList.remove('hidden');
      importActionsInitial.classList.add('hidden'); btnCloseImportFinal.classList.remove('hidden');
    });

    window.downloadJSON = function() {
      try {
        const dataStr = JSON.stringify({ version: VERSION_ACTUELLE, tickets, users, journal }, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const link = document.createElement('a');
        link.setAttribute('href', dataUri);
        link.setAttribute('download', `taskflow_export_${new Date().toISOString().split('T')[0]}.json`);
        link.click();
      } catch (err) { alert("Erreur JSON."); }
    };

    const resetBackdrop = document.getElementById('reset-modal-backdrop');
    const resetBox = document.getElementById('reset-modal-box');
    document.getElementById('btn-reset-modal').addEventListener('click', () => {
      resetBackdrop.classList.remove('opacity-0', 'pointer-events-none');
      resetBox.classList.remove('scale-95'); resetBox.classList.add('scale-100');
    });
    function closeResetModal() {
      resetBackdrop.classList.add('opacity-0', 'pointer-events-none');
      resetBox.classList.remove('scale-100'); resetBox.classList.add('scale-95');
    }
    document.getElementById('btn-cancel-reset').addEventListener('click', closeResetModal);
    document.getElementById('btn-confirm-reset').addEventListener('click', () => {
      try { localStorage.removeItem(CLE); } catch(e) {}
      tickets = TICKETS_DEMO.map(t => ({ ...t }));
      users = [...USERS_DEMO];
      journal = [];
      sauvegarder({ tickets, users, journal });
      closeResetModal();
      renderApp();
    });

    // ==========================================
    // FORMULAIRE AJOUT
    // ==========================================
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalBox = document.getElementById('modal-box');
    const form = document.getElementById('add-ticket-form');
    const errorMetier = document.getElementById('error-metier');
    const errorMetierText = document.getElementById('error-metier-text');

    function openModal() {
      modalBackdrop.classList.remove('opacity-0','pointer-events-none');
      modalBox.classList.remove('scale-95'); modalBox.classList.add('scale-100');
      document.getElementById('form-titre').focus();
    }
    function closeModal() {
      modalBackdrop.classList.add('opacity-0','pointer-events-none');
      modalBox.classList.remove('scale-100'); modalBox.classList.add('scale-95');
      resetFormErrors(); form.reset();
      document.getElementById('form-projet').value = "Refonte de l'espace client";
    }
    function resetFormErrors() {
      errorMetier.classList.add('hidden');
      ['titre','projet'].forEach(f => {
        document.getElementById(`error-${f}`)?.classList.add('hidden');
        document.getElementById(`form-${f}`)?.classList.remove('border-rose-500');
      });
    }
    document.getElementById('btn-autofill').addEventListener('click', () => {
      document.getElementById('form-titre').value = "Connexion SSO OpenID Connect";
      document.getElementById('form-type').value = "story";
      document.getElementById('form-priorite').value = "1";
      document.getElementById('form-points').value = "5";
      document.getElementById('form-statut').value = "backlog";
      resetFormErrors();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault(); resetFormErrors(); let ok = true;
      const titre = document.getElementById('form-titre').value.trim();
      if (titre.length < 3 || titre.length > 80) {
        document.getElementById('error-titre').classList.remove('hidden');
        document.getElementById('form-titre').classList.add('border-rose-500'); ok = false;
      }
      const projet = document.getElementById('form-projet').value.trim();
      if (projet.length < 2) {
        document.getElementById('error-projet').classList.remove('hidden');
        document.getElementById('form-projet').classList.add('border-rose-500'); ok = false;
      }
      if (!ok) return;

      const type = document.getElementById('form-type').value;
      const priorite = Number(document.getElementById('form-priorite').value);
      const raw = document.getElementById('form-points').value;
      const points = raw === 'null' ? null : Number(raw);
      let statut = document.getElementById('form-statut').value;

      const motifMetier = validerTicketMetier(titre, type, priorite, points, statut, tickets);
      if (motifMetier) {
        errorMetierText.textContent = motifMetier;
        errorMetier.classList.remove('hidden');
        return;
      }

      const controleWip = statutApresControleWip(statut, tickets);
      statut = controleWip.statut;
      if (controleWip.message) alert(controleWip.message);

      const now = new Date().toISOString().split('T')[0];
      tickets.push({
        id: tickets.length ? Math.max(...tickets.map(t=>t.id))+1 : 1,
        titre, type, priorite, points, statut,
        creeLe: now,
        projet: { nom: projet },
        description: "",
        majLe: now,
        assigne: null,
        bloquePar: []
      });
      sauvegarder({ tickets, users, journal });
      closeModal(); renderApp();
    });
    document.getElementById('btn-open-modal').addEventListener('click', openModal);
    document.getElementById('btn-close-modal-x').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);

    // ==========================================
    // MODIFICATION DES BLOQUANTS
    // ==========================================
    const dependancesBackdrop = document.getElementById('dependances-modal-backdrop');
    const dependancesBox = document.getElementById('dependances-modal-box');
    let ticketDependancesId = null;

    function afficherTicketsBloquants(ticket) {
      const liste = document.getElementById('dependances-ticket-list');
      liste.innerHTML = '';
      tickets.filter(element => element.id !== ticket.id).forEach(bloquant => {
        const etiquette = document.createElement('label');
        etiquette.className = 'flex items-start gap-2 p-2 rounded-lg hover:bg-slate-800/60 cursor-pointer text-xs';
        const caseACocher = document.createElement('input');
        caseACocher.type = 'checkbox';
        caseACocher.value = bloquant.id;
        caseACocher.checked = Array.isArray(ticket.bloquePar) && ticket.bloquePar.includes(bloquant.id);
        caseACocher.className = 'mt-0.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0';
        const texte = document.createElement('span');
        texte.className = 'text-slate-200';
        texte.textContent = `#${bloquant.id} ${bloquant.titre}${bloquant.statut === 'termine' ? ' (terminé)' : ''}`;
        etiquette.append(caseACocher, texte);
        liste.appendChild(etiquette);
      });
      if (liste.childElementCount === 0) {
        liste.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Aucun autre ticket disponible.</p>';
      }
    }

    window.openDependancesModal = function(id) {
      const ticket = tickets.find(element => element.id === id);
      if (!ticket) return;
      ticketDependancesId = id;
      document.getElementById('dependances-ticket-title').textContent = `#${ticket.id} - ${ticket.titre}`;
      document.getElementById('dependances-error').classList.add('hidden');
      document.getElementById('dependances-error').textContent = '';
      afficherTicketsBloquants(ticket);
      dependancesBackdrop.classList.remove('opacity-0', 'pointer-events-none');
      dependancesBox.classList.remove('scale-95');
      dependancesBox.classList.add('scale-100');
    };

    function fermerDependancesModal() {
      dependancesBackdrop.classList.add('opacity-0', 'pointer-events-none');
      dependancesBox.classList.remove('scale-100');
      dependancesBox.classList.add('scale-95');
      ticketDependancesId = null;
    }

    document.getElementById('btn-cancel-dependances').addEventListener('click', fermerDependancesModal);
    document.getElementById('btn-close-dependances-x').addEventListener('click', fermerDependancesModal);
    document.getElementById('btn-save-dependances').addEventListener('click', () => {
      const ticket = tickets.find(element => element.id === ticketDependancesId);
      if (!ticket) {
        fermerDependancesModal();
        return;
      }

      const idsSelectionnes = Array.from(
        document.querySelectorAll('#dependances-ticket-list input:checked'),
        element => Number(element.value)
      );
      const copieTickets = tickets.map(element => ({
        ...element,
        bloquePar: Array.isArray(element.bloquePar) ? [...element.bloquePar] : []
      }));
      const copieTicket = copieTickets.find(element => element.id === ticket.id);
      copieTicket.bloquePar = (Array.isArray(ticket.bloquePar) ? ticket.bloquePar : [])
        .filter(id => idsSelectionnes.includes(id));

      for (const idBloquant of idsSelectionnes) {
        if (copieTicket.bloquePar.includes(idBloquant)) continue;
        const resultat = ajouterBloquant(copieTickets, ticket.id, idBloquant);
        if (!resultat.ok) {
          const erreur = document.getElementById('dependances-error');
          erreur.textContent = resultat.erreur;
          erreur.classList.remove('hidden');
          return;
        }
      }

      ticket.bloquePar = copieTicket.bloquePar;
      sauvegarder({ tickets, users, journal });
      fermerDependancesModal();
      renderApp();
    });

    // ==========================================
    // SUPPRESSION
    // ==========================================
    const delBackdrop = document.getElementById('delete-modal-backdrop');
    const delBox = document.getElementById('delete-modal-box');
    window.promptDeleteTicket = function(id, title) {
      ticketIdToDelete = id;
      document.getElementById('delete-ticket-name').textContent = `"#${id} ${title}"`;
      delBackdrop.classList.remove('opacity-0','pointer-events-none');
      delBox.classList.remove('scale-95'); delBox.classList.add('scale-100');
    };
    function closeDeleteModal() {
      delBackdrop.classList.add('opacity-0','pointer-events-none');
      delBox.classList.remove('scale-100'); delBox.classList.add('scale-95');
      ticketIdToDelete = null;
    }
    document.getElementById('btn-cancel-delete').addEventListener('click', closeDeleteModal);
    document.getElementById('btn-confirm-delete').addEventListener('click', () => {
      if (ticketIdToDelete !== null) {
        tickets = supprimerTicketEtReferences(tickets, ticketIdToDelete);
        sauvegarder({ tickets, users, journal });
        closeDeleteModal(); renderApp();
      }
    });

    // ==========================================
    // INITIALISATION DES FILTRES UTILISATEURS
    // ==========================================
    function initUserFilters() {
      const select = document.getElementById('filter-user-select');
      select.innerHTML = '<option value="all">Toutes les personnes</option>';
      
      users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `${u.prenom} ${u.nom}${u.id === CURRENT_USER_ID ? ' (Moi)' : ''}`;
        select.appendChild(opt);
      });

      const me = getUserById(CURRENT_USER_ID);
      if (me) {
        document.getElementById('header-user-avatar').textContent = getInitials(me.prenom, me.nom);
        document.getElementById('header-user-name').textContent = `${me.prenom} ${me.nom} (Moi)`;
      }

      select.addEventListener('change', () => {
        document.getElementById('btn-my-tickets').classList.remove('btn-filter-active');
        renderApp();
      });

      document.getElementById('btn-my-tickets').addEventListener('click', (e) => {
        const isActive = e.currentTarget.classList.toggle('btn-filter-active');
        if (isActive) {
          select.value = 'all';
        }
        renderApp();
      });
    }

    // ==========================================
    // SIDEBAR & FILTRES
    // ==========================================
    const sidebar = document.getElementById('sidebar-filters');
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    const toggleIcon = document.getElementById('toggle-icon');
    const toggleLabel = document.getElementById('toggle-label');
    toggleBtn.addEventListener('click', () => {
      const collapsed = sidebar.classList.toggle('collapsed');
      toggleIcon.setAttribute('data-lucide', collapsed ? 'chevron-right' : 'chevron-left');
      toggleLabel.textContent = collapsed ? 'Afficher filtres' : 'Réduire filtres';
      lucide.createIcons();
    });

    document.getElementById('search-input').addEventListener('input', renderApp);
    document.querySelectorAll('.filter-type, .filter-priority, .filter-status').forEach(cb => cb.addEventListener('change', renderApp));
    document.getElementById('filter-type-all').addEventListener('change', e => { document.querySelectorAll('.filter-type').forEach(cb => cb.checked = e.target.checked); renderApp(); });
    document.getElementById('filter-priority-all').addEventListener('change', e => { document.querySelectorAll('.filter-priority').forEach(cb => cb.checked = e.target.checked); renderApp(); });
    document.getElementById('filter-status-all').addEventListener('change', e => { document.querySelectorAll('.filter-status').forEach(cb => cb.checked = e.target.checked); renderApp(); });
    document.getElementById('btn-reset-filters').addEventListener('click', () => {
      document.getElementById('search-input').value = '';
      document.querySelectorAll('.filter-type, .filter-priority, .filter-status, #filter-type-all, #filter-priority-all, #filter-status-all').forEach(cb => cb.checked = true);
      document.getElementById('filter-user-select').value = 'all';
      document.getElementById('btn-my-tickets').classList.remove('btn-filter-active');
      renderApp();
    });

    window.onload = () => { 
      lucide.createIcons(); 
      initUserFilters();
      renderApp(); 
    };
