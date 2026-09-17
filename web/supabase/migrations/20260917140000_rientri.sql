-- ════════════════════════════════════════════════════════════════════
--  Lo storico dei rientri
--
--  Rientrare voleva dire cancellare la riga di indisponibili, e con lei
--  motivo, giornata e nota: di un infortunio finito non restava niente.
--  Ora un rientro SPOSTA la riga in rientri, con la nota di chi l'ha
--  segnato uscire e quella del rientro («torna disponibile dopo la lesione
--  al bicipite femorale»), così in Infermeria resta uno storico leggibile.
--
--  Le tre strade per rientrare passano tutte da qui: il file degli
--  indisponibili (stato «rientrato»), il pulsante «È tornato», e i voti di
--  una giornata in cui il giocatore ha giocato.
--
--  rientra() è security invoker: valgono le policy delle due tabelle, quindi
--  chi non scrive non toglie niente e non aggiunge niente. Chi non era fuori
--  non genera una riga: non c'è niente da cui rientrare.
-- ════════════════════════════════════════════════════════════════════

create table public.rientri (
  id           bigint generated always as identity primary key,
  lega_id      uuid not null references public.leghe (id) on delete cascade,
  giocatore_id int  not null,
  motivo       text,                                          -- perché era fuori
  da_giornata  int check (da_giornata between 1 and 38),       -- da quando
  nota_uscita  text,                                          -- la nota di quando è uscito
  nota         text,                                          -- la nota del rientro
  rientrato_il timestamptz not null default now()
);
create index rientri_lega_data on public.rientri (lega_id, rientrato_il desc);

alter table public.rientri enable row level security;
create policy "leggono i membri" on public.rientri for select to authenticated using (public.e_membro(lega_id));
create policy "scrivono admin e banditori" on public.rientri for all to authenticated
  using (public.puo_scrivere(lega_id)) with check (public.puo_scrivere(lega_id));
grant select, insert, update, delete on public.rientri to authenticated;

alter publication supabase_realtime add table public.rientri;

/* p_voci: [{"giocatore_id": 10, "nota": "…"}, …]. Restituisce quanti sono
   rientrati davvero. */
create function public.rientra(p_lega uuid, p_voci jsonb) returns int
language plpgsql security invoker set search_path = ''
as $$
declare v_n int;
begin
  with voci as (
    select (v ->> 'giocatore_id')::int as giocatore_id, nullif(btrim(v ->> 'nota'), '') as nota
      from jsonb_array_elements(coalesce(p_voci, '[]')) v
  ), tolti as (
    delete from public.indisponibili i using voci
     where i.lega_id = p_lega and i.giocatore_id = voci.giocatore_id
    returning i.giocatore_id, i.motivo, i.da_giornata, i.nota
  )
  insert into public.rientri (lega_id, giocatore_id, motivo, da_giornata, nota_uscita, nota)
  select p_lega, t.giocatore_id, t.motivo, t.da_giornata, t.nota, v.nota
    from tolti t join voci v using (giocatore_id);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

grant execute on function public.rientra(uuid, jsonb) to authenticated;
