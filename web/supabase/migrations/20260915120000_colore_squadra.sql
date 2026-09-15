-- ════════════════════════════════════════════════════════════════════
--  Il colore di ciascuna squadra
--
--  È l'unica preferenza pubblica: la lega deve sapere che Regia FC è
--  ambra per riconoscerla. Sta sulla squadra, quindi è un dato di lega.
--
--  Chi lo cambia: admin e banditori quello di qualsiasi squadra, come il
--  resto delle squadre; e ogni membro — anche in sola lettura — quello
--  della squadra che ha scelto come sua. La squadra scelta è una
--  preferenza privata: imposta_colore() la legge per chi chiama e basta,
--  senza mostrarla a nessuno.
--
--  Si salva la tinta SCELTA, non quella corretta: la correzione dipende
--  dal tema di chi guarda, e la fa web/src/viste/colore-squadra.ts.
-- ════════════════════════════════════════════════════════════════════

alter table public.squadre add column colore text
  check (colore is null or colore ~ '^#[0-9A-Fa-f]{6}$');

create function public.imposta_colore(p_lega uuid, p_squadra bigint, p_colore text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.e_membro(p_lega) then
    raise exception 'non fai parte di questa lega' using errcode = '42501';
  end if;
  if not exists (select 1 from public.squadre s where s.lega_id = p_lega and s.id = p_squadra) then
    raise exception 'la squadra non è di questa lega' using errcode = '22023';
  end if;
  if not public.puo_scrivere(p_lega) and not exists (
    select 1 from public.preferenze p
     where p.lega_id = p_lega and p.utente_id = auth.uid() and p.mia_squadra = p_squadra
  ) then
    raise exception 'sola lettura: puoi cambiare solo il colore della tua squadra' using errcode = '42501';
  end if;
  update public.squadre set colore = upper(p_colore) where lega_id = p_lega and id = p_squadra;
end $$;

revoke execute on function public.imposta_colore(uuid, bigint, text) from public;
grant execute on function public.imposta_colore(uuid, bigint, text) to authenticated;
