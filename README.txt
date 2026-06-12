FG World Cup AI V5.8 - SofaScore Event-ID Lineups

Nuovo metodo formazioni:
- Cerca event ID SofaScore.
- Chiama endpoint strutturato:
  /api/v1/event/{event_id}/lineups
- Legge titolari/panchina/assenti quando presenti.
- Confronta solo con rose locali.
- Se riconosce meno di 8 titolari per squadra, non aggiorna.
- Dopo update ricalcola Money, Fanta, Monte Carlo.
- Aggiunto box Impatto Formazioni.

Deploy:
1. Sostituisci tutti i file su GitHub.
2. Render -> Clear build cache & deploy.
3. Dashboard -> Database -> Importa rose ufficiali/locali.
4. Dashboard -> Ufficiali -> Aggiorna Ufficiali.

Nota:
SofaScore è endpoint non ufficiale. Può richiedere che la partita sia già presente nel database SofaScore.
