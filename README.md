# 🪙 Splitty - Backend API (Express + TypeScript + Supabase)

Benvenuto nel backend di **Splitty**! Questo servizio gestisce la logica di business, le spese condivise di gruppo, la ripartizione dei costi, il calcolo automatico dei debiti/saldi (con algoritmo di ottimizzazione dei trasferimenti) e l'archiviazione di informazioni condivise/personali (note, IBAN, credenziali Wi-Fi, link, schede personalizzate).

---

## 🚀 Quick Start per lo Sviluppo

### 1. Requisiti e Installazione
```bash
npm install
```

### 2. Configura le variabili d'ambiente (`.env`)
Copia il file di esempio `.env.example` in `.env` e inserisci le chiavi del tuo progetto Supabase:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

SUPABASE_URL=https://tuo-progetto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=la-tua-service-role-key
SUPABASE_ANON_KEY=la-tua-anon-key
```
> 💡 Trovi le chiavi nel pannello Supabase sotto **Project Settings -> API**.

### 3. Setup del Database su Supabase
Nel pannello del tuo progetto Supabase:
1. Vai su **SQL Editor**.
2. Apri e incolla il contenuto del file `database/schema.sql`.
3. Clicca **Run**: creerà tabelle, foreign keys, indici e il trigger automatico che crea il profilo utente al signup!

### 4. Avvia il server
```bash
# Modalità sviluppo con hot-reload (tsx)
npm run dev

# Build e avvio produzione
npm run build
npm start
```

---

## 🔐 Autenticazione Frontend ⟷ Backend

Il flusso di autenticazione è integrato con **Supabase Auth**:

1. Sul frontend effettui login/signup con l'SDK Supabase (`supabase.auth.signUp()`, `supabase.auth.signInWithPassword()`, o OAuth Google/GitHub).
2. Recuperi l'access token di sessione:
   ```ts
   const { data: { session } } = await supabase.auth.getSession();
   const token = session?.access_token;
   ```
3. Alleghi il token nell'header di ogni chiamata verso l'Express backend:
   ```http
   Authorization: Bearer <access_token>
   ```
4. Il backend valida il token, sincronizza il profilo utente su PostgreSQL e protegge tutte le rotte.

---

## 📡 API Reference per il Frontend

Tutte le rotte (tranne `/api/health`) richiedono l'header `Authorization: Bearer <token>`.

### 1. Health Check
- **`GET /api/health`**
  - Risposta: `{ "status": "ok", "service": "splitty-backend" }`

---

### 2. Profilo Utente (`/api/auth`)
- **`GET /api/auth/me`**: Recupera il profilo dell'utente loggato.
- **`PUT /api/auth/me`**: Aggiorna profilo.
  - Body: `{ "full_name": "Mario Rossi", "avatar_url": "https://..." }`

---

### 3. Gruppi (`/api/groups`)
- **`GET /api/groups`**: Elenco di tutti i gruppi di cui fa parte l'utente corrente (con membri inclusi).
- **`POST /api/groups`**: Crea un nuovo gruppo (l'utente corrente diventa automaticamente `admin`).
  - Body:
    ```json
    {
      "name": "Viaggio a Barcellona 🇪🇸",
      "description": "Spese vacanza estiva",
      "currency": "EUR"
    }
    ```
- **`GET /api/groups/:id`**: Dettagli completi del gruppo e lista partecipanti.
- **`POST /api/groups/:id/members`**: Aggiunge un membro al gruppo tramite la sua email registrata.
  - Body:
    ```json
    {
      "email": "collega@example.com",
      "role": "member" // opzionale ('admin' | 'member')
    }
    ```

---

### 4. Spese & Divisioni (`/api/expenses`)

- **`GET /api/expenses/group/:groupId`**: Elenco di tutte le spese registrate nel gruppo.
- **`POST /api/expenses`**: Crea una nuova spesa e calcola la ripartizione.
  - Supporta 3 modalità di divisione:
    1. **`EQUAL`** (Alla pari):
       Se non passi `splits`, la divide in parti uguali tra **tutti i membri del gruppo**. Se passi `splits`, la divide in parti uguali tra gli utenti selezionati.
    2. **`EXACT`** (Quote fisse): Ciascun utente paga un importo prestabilito (la somma deve fare l'importo totale).
    3. **`PERCENTAGE`** (Percentuale): Ciascun utente ha una % assegnata (la somma deve fare 100%).
  - Esempio Body (`EQUAL`):
    ```json
    {
      "group_id": "uuid-del-gruppo",
      "paid_by": "uuid-utente-che-ha-pagato", // se omesso usa l'utente loggato
      "title": "Cena tapas",
      "amount": 75.00,
      "currency": "EUR",
      "category": "cibo",
      "split_type": "EQUAL",
      "expense_date": "2026-10-13",
      "notes": "Include sangria e dolce"
    }
    ```
- **`DELETE /api/expenses/:id`**: Elimina una spesa (consentito solo a chi l'ha pagata o a un admin del gruppo).

---

### 5. Calcolo Saldi & Rimborsi (`/api/expenses`)

- **`GET /api/expenses/group/:groupId/balances`**: 
  🎯 **La funzione principale per la dashboard frontend!**
  Restituisce:
  - `balances`: Il saldo netto di ciascun membro (`total_paid`, `total_owed`, `net_balance`). Se `net_balance > 0` deve ricevere soldi, se `< 0` è in debito.
  - `suggestedTransfers`: Lista ottimizzata di rimborsi minimi ("Chi deve dare quanto a chi") calcolata dal nostro algoritmo backend.
  - Esempio di risposta:
    ```json
    {
      "success": true,
      "data": {
        "balances": [
          { "user_id": "111", "user_name": "Mario", "net_balance": 35.50 },
          { "user_id": "222", "user_name": "Luigi", "net_balance": -35.50 }
        ],
        "suggestedTransfers": [
          {
            "from_user_id": "222",
            "from_user_name": "Luigi",
            "to_user_id": "111",
            "to_user_name": "Mario",
            "amount": 35.50,
            "currency": "EUR"
          }
        ]
      }
    }
    ```
- **`POST /api/expenses/settlements`**: Registra un rimborso effettuato (es. Bonifico/Satispay/Contanti inviati).
  - Body:
    ```json
    {
      "group_id": "uuid-del-gruppo",
      "payer_id": "uuid-di-chi-ha-rimborsato",
      "receiver_id": "uuid-di-chi-ha-ricevuto",
      "amount": 35.50,
      "currency": "EUR",
      "notes": "Inviato con Satispay"
    }
    ```
- **`GET /api/expenses/group/:groupId/settlements`**: Storico dei rimborsi effettuati nel gruppo.

---

### 6. Storage Informazioni Extra (`/api/info`)
Permette a ciascun utente di salvare e condividere info pratiche: note libere, dati bancari/IBAN per i rimborsi, password Wi-Fi, link o to-do list!

- **`GET /api/info?groupId=uuid`**: Lista delle info salvate per un gruppo (o personali se `groupId` omesso).
- **`POST /api/info`**: Crea una nuova info.
  - Body (Esempio IBAN per ricevere rimborsi):
    ```json
    {
      "group_id": "uuid-del-gruppo",
      "title": "Mio IBAN per i rimborsi",
      "category": "iban",
      "content": "IT60X0542811101000000123456",
      "metadata": {
        "bank": "Intesa Sanpaolo",
        "holder": "Mario Rossi",
        "bic": "BCITITMM"
      },
      "is_pinned": true
    }
    ```
  - Categorie supportate: `'note'`, `'iban'`, `'wifi'`, `'link'`, `'todo'`, `'custom'`.
- **`PUT /api/info/:id`**: Modifica una scheda informativa (solo l'autore).
- **`DELETE /api/info/:id`**: Elimina una scheda informativa (solo l'autore).
