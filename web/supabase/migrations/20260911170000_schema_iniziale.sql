-- ════════════════════════════════════════════════════════════════════
--  Fantaregia online · schema iniziale
--
--  Tre principi, dal briefing del progetto (CLAUDE.md):
--
--  1. I dati di una lega li vedono SOLO i suoi membri. Non è una scelta di
--     stile: il file dei voti non può essere ripubblicato, e listone e
--     backup dell'asta portano dati che non sono nostri o nomi di persone.
--     RLS su ogni tabella, anon senza nessun permesso.
--  2. Scritture granulari. Un'assegnazione è una riga con chiave
--     (lega, giocatore): se due banditori chiamano lo stesso giocatore nello
--     stesso istante, il secondo riceve un errore esplicito invece di
--     sovrascrivere. Mai «l'ultimo vince» sull'intera lega, che era il
--     limite della pagina che ripubblicava sé stessa.
--  3. Condiviso contro privato. Lega, squadre, asta, voti, infermeria sono
--     della lega; squadra scelta, obiettivi e formazioni sono di chi guarda.
--
--  Le forme dei campi jsonb (snap, voci, voti, dataset) sono quelle dello
--  stato dell'app a file singolo: web/src/data/componi.ts le ricompone nello
--  stato che il motore degli indici si aspetta.
-- ════════════════════════════════════════════════════════════════════

create type public.ruolo_membro as enum ('admin', 'banditore', 'lettore');
create type public.tipo_dataset as enum ('listone', 'calendario', 'rigoristi', 'storico', 'calendario_lega');

-- ── la lega e le sue impostazioni (S.budget, S.slots, S.plan, …) ──────
create table public.leghe (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(btrim(nome)) between 1 and 80),
  stagione      text not null default '2026/27',
  budget        int  not null default 500 check (budget > 0),
  slots         jsonb not null default '{"P":3,"D":8,"C":8,"A":6}',
  plan          jsonb not null default '{"P":7,"D":19,"C":32,"A":42}',
  squal_on      boolean not null default true,
  voti_meta     jsonb not null default '{}',
  rose_meta     jsonb,
  -- sale di uno a ogni modifica: chi aggiorna le impostazioni dice da quale
  -- versione parte (… where versione = N), e se nel frattempo qualcuno le ha
  -- cambiate l'aggiornamento non tocca niente e l'app lo dice. È la rete di
  -- sicurezza dello specchio locale, fatta dal database.
  versione      int not null default 1,
  creata_da     uuid not null default auth.uid() references auth.users (id),
  creata_il     timestamptz not null default now(),
  aggiornata_il timestamptz not null default now()
);

create table public.membri (
  lega_id    uuid not null references public.leghe (id) on delete cascade,
  utente_id  uuid not null references auth.users (id) on delete cascade,
  ruolo      public.ruolo_membro not null default 'lettore',
  nome       text,
  entrato_il timestamptz not null default now(),
  primary key (lega_id, utente_id)
);
create index membri_utente on public.membri (utente_id);

-- ── le squadre della lega (S.teams) e il loro posto nel calendario di lega (S.legaMap)
create table public.squadre (
  id        bigint generated always as identity primary key,
  lega_id   uuid not null references public.leghe (id) on delete cascade,
  nome      text not null check (length(btrim(nome)) between 1 and 60),
  posizione int  not null,
  lega_idx  int,
  unique (lega_id, posizione),
  unique (lega_id, id)
);

-- ── l'asta: una riga per giocatore assegnato (S.assign) ───────────────
create table public.assegnazioni (
  lega_id       uuid   not null references public.leghe (id) on delete cascade,
  giocatore_id  int    not null,
  squadra_id    bigint not null,
  prezzo        int    not null check (prezzo >= 0),
  snap          jsonb,          -- {id, r, n, s, q}: il giocatore com'era quando è stato preso
  registrata_da uuid default auth.uid() references auth.users (id) on delete set null,
  registrata_il timestamptz not null default now(),
  primary key (lega_id, giocatore_id),
  foreign key (lega_id, squadra_id) references public.squadre (lega_id, id) on delete cascade
);
create index assegnazioni_squadra on public.assegnazioni (lega_id, squadra_id);

-- il registro delle chiamate (S.log), dal più recente
create table public.log_asta (
  id            bigint generated always as identity primary key,
  lega_id       uuid   not null references public.leghe (id) on delete cascade,
  giocatore_id  int    not null,
  squadra_id    bigint not null,
  prezzo        int    not null,
  registrata_da uuid default auth.uid() references auth.users (id) on delete set null,
  registrata_il timestamptz not null default now()
);
create index log_asta_recenti on public.log_asta (lega_id, registrata_il desc);

-- ── mercato di stagione: scambi e svincoli (S.moves) ──────────────────
create table public.movimenti (
  id            bigint generated always as identity primary key,
  lega_id       uuid not null references public.leghe (id) on delete cascade,
  giornata      int  not null check (giornata between 1 and 38),
  tipo          text not null check (tipo in ('scambio', 'svincolo')),
  voci          jsonb not null,                  -- [{pid, da, a, prezzo, snap}]
  agg           jsonb not null default '{}',     -- {idSquadra: correzione dei crediti}
  rimborso      int,
  costo         int,
  registrato_da uuid default auth.uid() references auth.users (id) on delete set null,
  registrato_il timestamptz not null default now()
);
create index movimenti_giornata on public.movimenti (lega_id, giornata);

-- ── infermeria (S.out) e squalifiche annullate a mano (S.squalSalta) ──
create table public.indisponibili (
  lega_id      uuid not null references public.leghe (id) on delete cascade,
  giocatore_id int  not null,
  motivo       text,
  da_giornata  int check (da_giornata between 1 and 38),
  segnato_il   timestamptz not null default now(),
  primary key (lega_id, giocatore_id)
);
create table public.squalifiche_annullate (
  lega_id      uuid not null references public.leghe (id) on delete cascade,
  giocatore_id int  not null,
  giornata     int  not null check (giornata between 1 and 38),
  primary key (lega_id, giocatore_id, giornata)
);

-- ── voti di giornata (S.stats): una riga per giornata ─────────────────
-- Il file dei voti vieta la ripubblicazione: questa tabella la leggono
-- soltanto i membri della lega che l'ha caricata, come tutte le altre.
create table public.voti_giornata (
  lega_id     uuid not null references public.leghe (id) on delete cascade,
  giornata    int  not null check (giornata between 1 and 38),
  voti        jsonb not null,    -- {idGiocatore: [voto, sv, gf, gs, rp, rs, au, amm, esp, ass]}
  foglio      text,
  caricata_da uuid default auth.uid() references auth.users (id) on delete set null,
  caricata_il timestamptz not null default now(),
  primary key (lega_id, giornata)
);

-- ── i file che la lega si porta: listone, calendario, rigoristi, storico,
--    calendario di lega. Si sostituiscono interi, come nell'app a file
--    singolo; ogni lega ha i suoi e nessuno li vede da fuori.
create table public.dataset (
  lega_id       uuid not null references public.leghe (id) on delete cascade,
  tipo          public.tipo_dataset not null,
  dati          jsonb not null,
  meta          jsonb not null default '{}',
  aggiornato_da uuid default auth.uid() references auth.users (id) on delete set null,
  aggiornato_il timestamptz not null default now(),
  primary key (lega_id, tipo)
);

-- ── privato di chi guarda (ME): squadra scelta, obiettivi, formazioni ─
create table public.preferenze (
  lega_id       uuid not null,
  utente_id     uuid not null default auth.uid(),
  mia_squadra   bigint,
  obiettivi     jsonb not null default '{}',   -- {idGiocatore: {max}}
  formazioni    jsonb not null default '{}',   -- {giornata: {mod, start, bench}}
  aggiornate_il timestamptz not null default now(),
  primary key (lega_id, utente_id),
  foreign key (lega_id, utente_id) references public.membri (lega_id, utente_id) on delete cascade,
  foreign key (lega_id, mia_squadra) references public.squadre (lega_id, id) on delete set null (mia_squadra)
);

-- ── inviti: un codice da mandare agli altri partecipanti ──────────────
create table public.inviti (
  codice    text primary key default substr(md5(gen_random_uuid()::text), 1, 12),
  lega_id   uuid not null references public.leghe (id) on delete cascade,
  ruolo     public.ruolo_membro not null default 'lettore',
  creato_da uuid default auth.uid() references auth.users (id) on delete set null,
  scade_il  timestamptz not null default now() + interval '14 days',
  usi_max   int not null default 20 check (usi_max > 0),
  usi       int not null default 0
);

-- ════════════════════════════════════════════════════════════════════
--  Chi può fare cosa
-- ════════════════════════════════════════════════════════════════════
-- security definer: le policy di membri non possono interrogare membri
-- senza ricorsione, queste funzioni leggono il ruolo per loro.
create function public.ruolo_in(p_lega uuid) returns public.ruolo_membro
language sql stable security definer set search_path = ''
as $$ select m.ruolo from public.membri m where m.lega_id = p_lega and m.utente_id = auth.uid() $$;

create function public.e_membro(p_lega uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select public.ruolo_in(p_lega) is not null $$;

create function public.puo_scrivere(p_lega uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.ruolo_in(p_lega) in ('admin', 'banditore'), false) $$;

create function public.e_admin(p_lega uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.ruolo_in(p_lega) = 'admin', false) $$;

alter table public.leghe enable row level security;
create policy "leggono i membri" on public.leghe for select to authenticated using (public.e_membro(id));
create policy "impostazioni ad admin e banditori" on public.leghe for update to authenticated
  using (public.puo_scrivere(id)) with check (public.puo_scrivere(id));
create policy "cancella solo l'admin" on public.leghe for delete to authenticated using (public.e_admin(id));
-- niente insert diretto: una lega nasce solo da crea_lega(), insieme al suo admin

alter table public.membri enable row level security;
create policy "leggono i membri" on public.membri for select to authenticated using (public.e_membro(lega_id));
create policy "ruoli li cambia l'admin" on public.membri for update to authenticated
  using (public.e_admin(lega_id)) with check (public.e_admin(lega_id));
create policy "l'admin toglie, ognuno può uscire" on public.membri for delete to authenticated
  using (public.e_admin(lega_id) or utente_id = (select auth.uid()));
-- niente insert diretto: si entra con unisciti(codice)

do $$
declare t text;
begin
  foreach t in array array['squadre', 'assegnazioni', 'log_asta', 'movimenti', 'indisponibili',
                           'squalifiche_annullate', 'voti_giornata', 'dataset'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "leggono i membri" on public.%I for select to authenticated using (public.e_membro(lega_id))', t);
    execute format('create policy "scrivono admin e banditori" on public.%I for all to authenticated '
                   'using (public.puo_scrivere(lega_id)) with check (public.puo_scrivere(lega_id))', t);
  end loop;
end $$;

alter table public.preferenze enable row level security;
create policy "ognuno le sue" on public.preferenze for all to authenticated
  using (utente_id = (select auth.uid()) and public.e_membro(lega_id))
  with check (utente_id = (select auth.uid()) and public.e_membro(lega_id));

alter table public.inviti enable row level security;
create policy "inviti all'admin" on public.inviti for all to authenticated
  using (public.e_admin(lega_id)) with check (public.e_admin(lega_id));

-- ════════════════════════════════════════════════════════════════════
--  Trigger
-- ════════════════════════════════════════════════════════════════════
create function public.leghe_versione() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.versione := old.versione + 1;
  new.aggiornata_il := now();
  return new;
end $$;
create trigger leghe_versione before update on public.leghe
  for each row execute function public.leghe_versione();

-- una lega senza admin non si governa più: l'ultimo non si toglie né si declassa
-- (tranne quando sparisce la lega intera, e allora la cascata deve passare)
create function public.membri_ultimo_admin() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.ruolo = 'admin' and (tg_op = 'DELETE' or new.ruolo <> 'admin')
     and exists (select 1 from public.leghe where id = old.lega_id)
     and not exists (select 1 from public.membri
                     where lega_id = old.lega_id and ruolo = 'admin' and utente_id <> old.utente_id) then
    raise exception 'è l''ultimo admin della lega: prima nomina un altro admin' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger membri_ultimo_admin before update or delete on public.membri
  for each row execute function public.membri_ultimo_admin();

-- ════════════════════════════════════════════════════════════════════
--  Operazioni
-- ════════════════════════════════════════════════════════════════════
create function public.crea_lega(p_nome text, p_squadre text[], p_budget int default 500) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_lega uuid;
begin
  if auth.uid() is null then
    raise exception 'serve un utente autenticato' using errcode = '42501';
  end if;
  if coalesce(array_length(p_squadre, 1), 0) < 2 then
    raise exception 'servono almeno due squadre' using errcode = '22023';
  end if;
  insert into public.leghe (nome, budget, creata_da) values (p_nome, p_budget, auth.uid()) returning id into v_lega;
  insert into public.membri (lega_id, utente_id, ruolo) values (v_lega, auth.uid(), 'admin');
  insert into public.squadre (lega_id, nome, posizione)
    select v_lega, s.nome, s.i::int from unnest(p_squadre) with ordinality as s (nome, i);
  return v_lega;
end $$;

create function public.unisciti(p_codice text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_inv public.inviti;
begin
  if auth.uid() is null then
    raise exception 'serve un utente autenticato' using errcode = '42501';
  end if;
  select * into v_inv from public.inviti where codice = p_codice for update;
  if not found or v_inv.scade_il < now() or v_inv.usi >= v_inv.usi_max then
    raise exception 'invito non valido o scaduto' using errcode = 'P0002';
  end if;
  insert into public.membri (lega_id, utente_id, ruolo) values (v_inv.lega_id, auth.uid(), v_inv.ruolo)
    on conflict (lega_id, utente_id) do nothing;
  if found then
    update public.inviti set usi = usi + 1 where codice = p_codice;
  end if;
  return v_inv.lega_id;
end $$;

-- La chiamata d'asta. Stesse regole di «Assegna» nell'app a file singolo
-- (src/part6.html): rosa completa, reparto pieno, oltre il tetto — con gli
-- stessi messaggi. In più, qui le regole valgono anche con più banditori:
-- la riga della squadra resta bloccata per la durata della chiamata, e il
-- giocatore già preso da un altro dà un errore invece di cambiare padrone.
create function public.assegna(p_lega uuid, p_giocatore int, p_squadra bigint, p_prezzo int, p_snap jsonb)
returns public.assegnazioni
language plpgsql security invoker set search_path = ''
as $$
declare
  v_lega   public.leghe;
  v_nome   text;
  v_ruolo  text;
  v_presi  int;
  v_spesa  int;
  v_presiR int;
  v_agg    int;
  v_posti  int;
  v_tetto  int;
  v_riga   public.assegnazioni;
begin
  if not public.puo_scrivere(p_lega) then
    raise exception 'sola lettura: non puoi registrare assegnazioni' using errcode = '42501';
  end if;
  if p_prezzo is null or p_prezzo < 0 then
    raise exception 'prezzo non valido' using errcode = '22023';
  end if;
  -- una chiamata alla volta per squadra: due banditori non sforano il tetto insieme
  select nome into v_nome from public.squadre where id = p_squadra and lega_id = p_lega for update;
  if not found then
    raise exception 'squadra non trovata in questa lega' using errcode = 'P0002';
  end if;
  select * into v_lega from public.leghe where id = p_lega;
  -- il ruolo lo dice il listone della lega; la fotografia serve solo se il giocatore non c'è
  v_ruolo := coalesce(
    (select e ->> 1 from public.dataset d, jsonb_array_elements(d.dati) e
      where d.lega_id = p_lega and d.tipo = 'listone' and (e ->> 0)::int = p_giocatore limit 1),
    p_snap ->> 'r');
  if v_ruolo is null or v_ruolo not in ('P', 'D', 'C', 'A') then
    raise exception 'ruolo del giocatore sconosciuto' using errcode = '22023';
  end if;

  select count(*), coalesce(sum(prezzo), 0), count(*) filter (where snap ->> 'r' = v_ruolo)
    into v_presi, v_spesa, v_presiR
    from public.assegnazioni where lega_id = p_lega and squadra_id = p_squadra;
  -- come stats() nel motore: la correzione dei movimenti si toglie dalla spesa
  select coalesce(sum((m.agg ->> p_squadra::text)::int), 0) into v_agg
    from public.movimenti m where m.lega_id = p_lega;
  v_posti := (select sum(value::int) from jsonb_each_text(v_lega.slots)) - v_presi;
  v_tetto := case when v_posti > 0 then greatest(0, v_lega.budget - (v_spesa - v_agg) - (v_posti - 1)) else 0 end;

  if v_posti <= 0 then
    raise exception '% ha la rosa completa', v_nome using errcode = 'P0001';
  end if;
  if v_presiR >= (v_lega.slots ->> v_ruolo)::int then
    raise exception '%: reparto % già pieno', v_nome, v_ruolo using errcode = 'P0001';
  end if;
  if p_prezzo > v_tetto then
    raise exception '% può offrire al massimo %', v_nome, v_tetto using errcode = 'P0001';
  end if;

  begin
    insert into public.assegnazioni (lega_id, giocatore_id, squadra_id, prezzo, snap)
      values (p_lega, p_giocatore, p_squadra, p_prezzo, p_snap)
      returning * into v_riga;
  exception when unique_violation then
    raise exception 'giocatore già assegnato: qualcun altro l''ha registrato un attimo prima' using errcode = '23505';
  end;
  insert into public.log_asta (lega_id, giocatore_id, squadra_id, prezzo)
    values (p_lega, p_giocatore, p_squadra, p_prezzo);
  return v_riga;
end $$;

-- «Libera»: toglie l'assegnazione e le sue voci dal registro, come free()
create function public.libera(p_lega uuid, p_giocatore int) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.puo_scrivere(p_lega) then
    raise exception 'sola lettura: non puoi liberare giocatori' using errcode = '42501';
  end if;
  delete from public.assegnazioni where lega_id = p_lega and giocatore_id = p_giocatore;
  if not found then
    raise exception 'il giocatore non è assegnato' using errcode = 'P0002';
  end if;
  delete from public.log_asta where lega_id = p_lega and giocatore_id = p_giocatore;
end $$;

-- ════════════════════════════════════════════════════════════════════
--  Permessi e realtime
-- ════════════════════════════════════════════════════════════════════
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from public, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function
  public.ruolo_in(uuid), public.e_membro(uuid), public.puo_scrivere(uuid), public.e_admin(uuid),
  public.crea_lega(text, text[], int), public.unisciti(text),
  public.assegna(uuid, int, bigint, int, jsonb), public.libera(uuid, int)
  to authenticated;

-- ogni vista si aggiorna sulla singola riga cambiata, senza ricaricare la
-- pagina: il realtime rispetta le stesse policy RLS delle letture
alter publication supabase_realtime add table
  public.leghe, public.membri, public.squadre, public.assegnazioni, public.log_asta,
  public.movimenti, public.indisponibili, public.squalifiche_annullate, public.voti_giornata,
  public.dataset, public.preferenze;
