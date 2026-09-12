-- ════════════════════════════════════════════════════════════════════
--  Mercato di stagione: scambi, svincoli, annullamento
--
--  Un movimento tocca tre cose insieme — il registro, chi possiede il
--  giocatore e la correzione dei crediti — e o si scrivono tutte o
--  nessuna: per questo sta in una funzione e non in tre chiamate del
--  client. Le regole sono quelle di registraScambio/registraSvincolo/
--  annullaMovimento nell'app a file singolo (src/part4.html, sezione 18).
--
--  I crediti residui si ricavano da budget meno la somma dei prezzi in
--  rosa, corretta dai movimenti: uno scambio alla pari fra un giocatore
--  da 65 e uno da 156 non deve muovere il residuo di nessuno.
-- ════════════════════════════════════════════════════════════════════

/* i crediti che restano a una squadra, come stats() nel motore */
create function public.crediti_residui(p_lega uuid, p_squadra bigint) returns int
language sql stable security invoker set search_path = ''
as $$
  select l.budget
       - coalesce((select sum(a.prezzo) from public.assegnazioni a where a.lega_id = p_lega and a.squadra_id = p_squadra), 0)
       + coalesce((select sum((m.agg ->> p_squadra::text)::int) from public.movimenti m where m.lega_id = p_lega), 0)
  from public.leghe l where l.id = p_lega
$$;

create function public.registra_scambio(p_lega uuid, p_a int, p_b int, p_giornata int) returns bigint
language plpgsql security invoker set search_path = ''
as $$
declare
  va public.assegnazioni;
  vb public.assegnazioni;
  ra text; rb text; v_id bigint;
begin
  if not public.puo_scrivere(p_lega) then
    raise exception 'sola lettura: non puoi registrare movimenti' using errcode = '42501';
  end if;
  if p_giornata is null or p_giornata < 1 or p_giornata > 38 then
    raise exception 'la giornata deve stare fra 1 e 38' using errcode = '22023';
  end if;

  select * into va from public.assegnazioni where lega_id = p_lega and giocatore_id = p_a for update;
  if not found then raise exception 'uno dei due giocatori non è in nessuna rosa' using errcode = 'P0002'; end if;
  select * into vb from public.assegnazioni where lega_id = p_lega and giocatore_id = p_b for update;
  if not found then raise exception 'uno dei due giocatori non è in nessuna rosa' using errcode = 'P0002'; end if;
  if va.squadra_id = vb.squadra_id then
    raise exception 'sono già nella stessa squadra' using errcode = '22023';
  end if;
  ra := va.snap ->> 'r'; rb := vb.snap ->> 'r';
  if ra is null or rb is null or ra <> rb then
    raise exception 'ruoli diversi (% e %): la lega scambia ruolo per ruolo', coalesce(ra, '?'), coalesce(rb, '?') using errcode = '22023';
  end if;

  insert into public.movimenti (lega_id, giornata, tipo, voci, agg)
    values (p_lega, p_giornata, 'scambio',
      jsonb_build_array(
        jsonb_build_object('pid', p_a, 'da', va.squadra_id, 'a', vb.squadra_id, 'prezzo', va.prezzo, 'snap', va.snap),
        jsonb_build_object('pid', p_b, 'da', vb.squadra_id, 'a', va.squadra_id, 'prezzo', vb.prezzo, 'snap', vb.snap)),
      -- il residuo di nessuno dei due si muove: qui la correzione
      jsonb_build_object(va.squadra_id::text, vb.prezzo - va.prezzo, vb.squadra_id::text, va.prezzo - vb.prezzo))
    returning id into v_id;

  update public.assegnazioni set squadra_id = vb.squadra_id where lega_id = p_lega and giocatore_id = p_a;
  update public.assegnazioni set squadra_id = va.squadra_id where lega_id = p_lega and giocatore_id = p_b;
  return v_id;
end $$;

create function public.registra_svincolo(p_lega uuid, p_squadra bigint, p_fuori int, p_dentro int,
                                         p_rimborso int, p_costo int, p_giornata int, p_snap jsonb) returns bigint
language plpgsql security invoker set search_path = ''
as $$
declare
  af public.assegnazioni;
  rf text; rd text; v_id bigint; v_residuo int;
begin
  if not public.puo_scrivere(p_lega) then
    raise exception 'sola lettura: non puoi registrare movimenti' using errcode = '42501';
  end if;
  if p_giornata is null or p_giornata < 1 or p_giornata > 38 then
    raise exception 'la giornata deve stare fra 1 e 38' using errcode = '22023';
  end if;
  if coalesce(p_rimborso, 0) < 0 or coalesce(p_costo, 0) < 0 then
    raise exception 'rimborso e costo non possono essere negativi' using errcode = '22023';
  end if;

  select * into af from public.assegnazioni where lega_id = p_lega and giocatore_id = p_fuori for update;
  if not found or af.squadra_id <> p_squadra then
    raise exception 'il giocatore da svincolare non è in questa rosa' using errcode = 'P0002';
  end if;
  perform 1 from public.assegnazioni where lega_id = p_lega and giocatore_id = p_dentro;
  if found then raise exception 'il giocatore da prendere è già in una rosa' using errcode = '23505'; end if;

  rf := af.snap ->> 'r';
  rd := coalesce(
    (select e ->> 1 from public.dataset d, jsonb_array_elements(d.dati) e
      where d.lega_id = p_lega and d.tipo = 'listone' and (e ->> 0)::int = p_dentro limit 1),
    p_snap ->> 'r');
  if rd is null then raise exception 'il giocatore da prendere non è nel listone' using errcode = 'P0002'; end if;
  if rf is not null and rd <> rf then
    raise exception 'ruoli diversi (% esce, % entra): gli slot non tornerebbero', rf, rd using errcode = '22023';
  end if;

  v_residuo := public.crediti_residui(p_lega, p_squadra) + coalesce(p_rimborso, 0) - coalesce(p_costo, 0);
  if v_residuo < 0 then
    raise exception 'non bastano i crediti: resterebbero %', v_residuo using errcode = 'P0001';
  end if;

  insert into public.movimenti (lega_id, giornata, tipo, voci, agg, rimborso, costo)
    values (p_lega, p_giornata, 'svincolo',
      jsonb_build_array(
        jsonb_build_object('pid', p_fuori, 'da', p_squadra, 'a', null, 'prezzo', af.prezzo, 'snap', af.snap),
        jsonb_build_object('pid', p_dentro, 'da', null, 'a', p_squadra, 'prezzo', p_costo, 'snap', p_snap)),
      -- il derivato restituisce già i crediti di chi esce: qui si corregge col rimborso pattuito
      jsonb_build_object(p_squadra::text, coalesce(p_rimborso, 0) - af.prezzo),
      p_rimborso, p_costo)
    returning id into v_id;

  delete from public.assegnazioni where lega_id = p_lega and giocatore_id = p_fuori;
  insert into public.assegnazioni (lega_id, giocatore_id, squadra_id, prezzo, snap)
    values (p_lega, p_dentro, p_squadra, p_costo, p_snap);
  return v_id;
end $$;

/* annullare: si rimettono le cose come stavano, voce per voce */
create function public.annulla_movimento(p_lega uuid, p_id bigint) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  m public.movimenti;
  v jsonb; v_pid int; v_da bigint; v_a bigint;
begin
  if not public.puo_scrivere(p_lega) then
    raise exception 'sola lettura: non puoi annullare movimenti' using errcode = '42501';
  end if;
  select * into m from public.movimenti where id = p_id and lega_id = p_lega for update;
  if not found then raise exception 'movimento non trovato' using errcode = 'P0002'; end if;

  for v in select * from jsonb_array_elements(m.voci) loop
    v_pid := (v ->> 'pid')::int;
    v_da := (v ->> 'da')::bigint;
    v_a := (v ->> 'a')::bigint;
    if v_a is null then
      -- era uscito: torna dentro al SUO prezzo, quello registrato nella voce
      insert into public.assegnazioni (lega_id, giocatore_id, squadra_id, prezzo, snap)
        values (p_lega, v_pid, v_da, coalesce((v ->> 'prezzo')::int, 0), v -> 'snap')
        on conflict (lega_id, giocatore_id)
        do update set squadra_id = excluded.squadra_id, prezzo = excluded.prezzo, snap = excluded.snap;
    elsif v_da is null then
      delete from public.assegnazioni where lega_id = p_lega and giocatore_id = v_pid;
    else
      update public.assegnazioni set squadra_id = v_da where lega_id = p_lega and giocatore_id = v_pid;
    end if;
  end loop;

  delete from public.movimenti where id = p_id;
end $$;

revoke all on function public.crediti_residui(uuid, bigint) from public, anon;
revoke all on function public.registra_scambio(uuid, int, int, int) from public, anon;
revoke all on function public.registra_svincolo(uuid, bigint, int, int, int, int, int, jsonb) from public, anon;
revoke all on function public.annulla_movimento(uuid, bigint) from public, anon;
grant execute on function
  public.crediti_residui(uuid, bigint), public.registra_scambio(uuid, int, int, int),
  public.registra_svincolo(uuid, bigint, int, int, int, int, int, jsonb), public.annulla_movimento(uuid, bigint)
  to authenticated;
