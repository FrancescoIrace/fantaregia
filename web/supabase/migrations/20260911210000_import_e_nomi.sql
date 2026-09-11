-- ════════════════════════════════════════════════════════════════════
--  Import dall'app a file singolo, e un nome per ogni membro
--
--  importa_lega() porta nel database una lega intera così come l'app a file
--  singolo la teneva: la pagina Fantaregia.html (con listone, calendario,
--  rigoristi e statistiche dentro) oppure il backup .json. Il client legge
--  il file e lo normalizza (web/src/data/importa-app.ts); qui si scrive
--  tutto in una transazione sola — o entra la lega intera, o niente.
--
--  Le squadre ricevono id nuovi: ogni riferimento alle vecchie (rose,
--  registro, movimenti, correzioni dei crediti) viene tradotto qui.
-- ════════════════════════════════════════════════════════════════════

-- come appare un membro agli altri: la parte prima della @. auth.users non
-- è leggibile dal client, quindi il nome si copia in membri all'ingresso.
create function public.nome_utente() returns text
language sql stable security definer set search_path = ''
as $$ select coalesce(nullif(split_part(u.email, '@', 1), ''), 'utente') from auth.users u where u.id = auth.uid() $$;

create or replace function public.crea_lega(p_nome text, p_squadre text[], p_budget int default 500) returns uuid
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
  insert into public.membri (lega_id, utente_id, ruolo, nome) values (v_lega, auth.uid(), 'admin', public.nome_utente());
  insert into public.squadre (lega_id, nome, posizione)
    select v_lega, s.nome, s.i::int from unnest(p_squadre) with ordinality as s (nome, i);
  return v_lega;
end $$;

create or replace function public.unisciti(p_codice text) returns uuid
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
  insert into public.membri (lega_id, utente_id, ruolo, nome) values (v_inv.lega_id, auth.uid(), v_inv.ruolo, public.nome_utente())
    on conflict (lega_id, utente_id) do nothing;
  if found then
    update public.inviti set usi = usi + 1 where codice = p_codice;
  end if;
  return v_inv.lega_id;
end $$;

create function public.importa_lega(p_nome text, p_dati jsonb) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_lega uuid;
  v_l    jsonb := coalesce(p_dati -> 'lega', '{}');
  v_map  jsonb;      -- {vecchio id squadra: id nuovo}
begin
  if auth.uid() is null then
    raise exception 'serve un utente autenticato' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_dati -> 'squadre', '[]')) < 2 then
    raise exception 'servono almeno due squadre' using errcode = '22023';
  end if;

  insert into public.leghe (nome, budget, slots, plan, squal_on, voti_meta, rose_meta, creata_da)
    values (p_nome,
            coalesce((v_l ->> 'budget')::int, 500),
            coalesce(v_l -> 'slots', '{"P":3,"D":8,"C":8,"A":6}'),
            coalesce(v_l -> 'plan', '{"P":7,"D":19,"C":32,"A":42}'),
            coalesce((v_l ->> 'squal_on')::boolean, true),
            coalesce(v_l -> 'voti_meta', '{}'),
            nullif(v_l -> 'rose_meta', 'null'::jsonb),
            auth.uid())
    returning id into v_lega;
  insert into public.membri (lega_id, utente_id, ruolo, nome) values (v_lega, auth.uid(), 'admin', public.nome_utente());

  with nuove as (
    insert into public.squadre (lega_id, nome, posizione, lega_idx)
      select v_lega, s.nome, s.posizione, s.lega_idx
      from jsonb_to_recordset(p_dati -> 'squadre') as s (nome text, posizione int, lega_idx int)
      returning id, posizione)
  select jsonb_object_agg(s.vecchio_id::text, nuove.id) into v_map
    from nuove join jsonb_to_recordset(p_dati -> 'squadre') as s (vecchio_id bigint, posizione int) using (posizione);

  insert into public.assegnazioni (lega_id, giocatore_id, squadra_id, prezzo, snap)
    select v_lega, a.giocatore_id, (v_map ->> a.squadra::text)::bigint, a.prezzo, a.snap
    from jsonb_to_recordset(coalesce(p_dati -> 'assegnazioni', '[]')) as a (giocatore_id int, squadra bigint, prezzo int, snap jsonb);

  insert into public.log_asta (lega_id, giocatore_id, squadra_id, prezzo, registrata_il)
    select v_lega, l.giocatore_id, (v_map ->> l.squadra::text)::bigint, l.prezzo, coalesce(l.quando, now())
    from jsonb_to_recordset(coalesce(p_dati -> 'log', '[]')) as l (giocatore_id int, squadra bigint, prezzo int, quando timestamptz);

  -- nelle voci dei movimenti e nelle correzioni dei crediti le squadre
  -- compaiono per id: si traducono anche lì (null resta null: svincolato)
  insert into public.movimenti (lega_id, giornata, tipo, voci, agg, rimborso, costo, registrato_il)
    select v_lega, m.giornata, m.tipo,
           (select coalesce(jsonb_agg(v || jsonb_build_object('da', v_map -> (v ->> 'da'), 'a', v_map -> (v ->> 'a')) order by o), '[]')
              from jsonb_array_elements(m.voci) with ordinality as x (v, o)),
           (select coalesce(jsonb_object_agg(v_map ->> e.k, e.val), '{}')
              from jsonb_each(coalesce(m.agg, '{}')) as e (k, val) where v_map ? e.k),
           m.rimborso, m.costo, coalesce(m.quando, now())
    from jsonb_to_recordset(coalesce(p_dati -> 'movimenti', '[]'))
      as m (giornata int, tipo text, voci jsonb, agg jsonb, rimborso int, costo int, quando timestamptz);

  insert into public.indisponibili (lega_id, giocatore_id, motivo, da_giornata, segnato_il)
    select v_lega, i.giocatore_id, i.motivo, i.da_giornata, coalesce(i.quando, now())
    from jsonb_to_recordset(coalesce(p_dati -> 'indisponibili', '[]'))
      as i (giocatore_id int, motivo text, da_giornata int, quando timestamptz)
    on conflict do nothing;

  insert into public.squalifiche_annullate (lega_id, giocatore_id, giornata)
    select v_lega, s.giocatore_id, s.giornata
    from jsonb_to_recordset(coalesce(p_dati -> 'squalifiche_annullate', '[]')) as s (giocatore_id int, giornata int)
    on conflict do nothing;

  insert into public.voti_giornata (lega_id, giornata, voti, foglio)
    select v_lega, v.giornata, v.voti, v_l -> 'voti_meta' ->> 'sheet'
    from jsonb_to_recordset(coalesce(p_dati -> 'voti', '[]')) as v (giornata int, voti jsonb);

  insert into public.dataset (lega_id, tipo, dati, meta)
    select v_lega, d.tipo::public.tipo_dataset, d.dati, coalesce(d.meta, '{}')
    from jsonb_to_recordset(coalesce(p_dati -> 'dataset', '[]')) as d (tipo text, dati jsonb, meta jsonb);

  return v_lega;
end $$;

revoke all on function public.nome_utente() from public, anon, authenticated;
revoke all on function public.importa_lega(text, jsonb) from public, anon;
grant execute on function public.importa_lega(text, jsonb) to authenticated;
