-- ════════════════════════════════════════════════════════════════════
--  La nota di un indisponibile
--
--  Il file degli indisponibili che la routine prepara ogni giorno porta,
--  oltre a nome e stato, una nota: «risentimento muscolare all'adduttore,
--  rientro dopo la sosta». È quello che serve per decidere se schierarlo
--  la settimana dopo, e finora non c'era dove salvarla.
--
--  Una colonna, facoltativa. Le policy restano quelle della tabella
--  (leggono i membri, scrivono admin e banditori), e il realtime già la
--  segue. Il codice regge un database senza questa migrazione: legge senza
--  la nota e lo dice, invece di non aprire la lega.
-- ════════════════════════════════════════════════════════════════════

alter table public.indisponibili add column nota text;
