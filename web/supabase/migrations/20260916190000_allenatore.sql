-- ════════════════════════════════════════════════════════════════════
--  Chi gioca quale squadra
--
--  Finora «la mia squadra» era solo una preferenza privata
--  (preferenze.mia_squadra): due membri potevano scegliere la stessa
--  squadra e la lega non sapeva chi fosse chi. Con due fantallenatori
--  veri serve un legame pubblico — come il colore, sta sulla squadra e lo
--  vedono tutti i membri — e una squadra ha al massimo un allenatore.
--
--  Chi lo mette: admin e banditori per chiunque; ogni membro, anche in
--  sola lettura, può prendersi una squadra libera e lasciare la sua.
--  Chi non può scrivere non scalza l'allenatore di un altro.
--
--  preferenze.mia_squadra resta, e non è un doppione: serve a chi tiene
--  la lega da solo e cambia «chi sono io» per guardare le altre squadre.
--  Prendendosi una squadra, però, la preferenza segue da sé.
-- ════════════════════════════════════════════════════════════════════

alter table public.squadre add column allenatore uuid references auth.users (id) on delete set null;

-- una squadra per allenatore, dentro la lega. Parziale: le squadre libere
-- sono tante e null non va confrontato con null.
create unique index squadre_un_allenatore on public.squadre (lega_id, allenatore) where allenatore is not null;

create function public.imposta_allenatore(p_lega uuid, p_squadra bigint, p_utente uuid default auth.uid()) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_ora uuid;
begin
  if not public.e_membro(p_lega) then
    raise exception 'non fai parte di questa lega' using errcode = '42501';
  end if;
  select s.allenatore into v_ora from public.squadre s where s.lega_id = p_lega and s.id = p_squadra;
  if not found then
    raise exception 'la squadra non è di questa lega' using errcode = '22023';
  end if;
  if p_utente is not null and not exists (
    select 1 from public.membri m where m.lega_id = p_lega and m.utente_id = p_utente
  ) then
    raise exception 'quell''utente non è di questa lega' using errcode = '22023';
  end if;
  if not public.puo_scrivere(p_lega) then
    if p_utente is distinct from (select auth.uid()) then
      raise exception 'sola lettura: puoi prendere solo una squadra per te' using errcode = '42501';
    end if;
    if v_ora is not null and v_ora <> (select auth.uid()) then
      raise exception 'la squadra ha già un allenatore' using errcode = '42501';
    end if;
  end if;
  -- un allenatore ha una squadra sola: prendendone un'altra lascia la prima,
  -- invece di sbattere contro l'indice unico con un errore da database
  if p_utente is not null then
    update public.squadre set allenatore = null
     where lega_id = p_lega and allenatore = p_utente and id <> p_squadra;
  end if;
  update public.squadre set allenatore = p_utente where lega_id = p_lega and id = p_squadra;
  -- chi si prende una squadra se la ritrova anche come «chi sono io»
  if p_utente is not null and p_utente = (select auth.uid()) then
    insert into public.preferenze (lega_id, utente_id, mia_squadra) values (p_lega, p_utente, p_squadra)
      on conflict (lega_id, utente_id) do update set mia_squadra = excluded.mia_squadra, aggiornate_il = now();
  end if;
end $$;

revoke execute on function public.imposta_allenatore(uuid, bigint, uuid) from public;
grant execute on function public.imposta_allenatore(uuid, bigint, uuid) to authenticated;
