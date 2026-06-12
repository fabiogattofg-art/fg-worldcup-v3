FG World Cup AI V5.9 - Manual Event ID Fallback

Correzione per "Event ID non trovato":
- La ricerca automatica SofaScore ora prova anche scheduled-events per data.
- Aggiunto fallback manuale per ogni partita:
  - incolla link SofaScore della partita
  - oppure incolla direttamente l'Event ID numerico
  - premi Salva + aggiorna
- L'ID viene salvato nella dashboard e riusato nei successivi aggiornamenti.
- Le lineups continuano a essere accettate solo se i nomi sono nella rosa locale.
- Dopo aggiornamento ricalcola Money, Fanta e Monte Carlo.

Come usare:
1. Vai su Ufficiali.
2. Se Event ID non trovato, apri SofaScore e copia il link della partita.
3. Incollalo nel campo "Fallback Event ID".
4. Premi "Salva + aggiorna".

Deploy:
- Sostituisci tutti i file.
- Render -> Clear build cache & deploy.
