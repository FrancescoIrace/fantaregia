-- ════════════════════════════════════════════════════════════════════
--  Il colore lo cambia anche chi è allenatore della squadra
--
--  imposta_colore() era nata prima del legame pubblico: autorizzava chi
--  non può scrivere solo in base a preferenze.mia_squadra, la scelta
--  privata. Da quando l'admin può assegnare una squadra a un membro
--  (migrazione allenatore), quel membro è l'allenatore della squadra ma
--  non ha nessuna preferenza salvata — e si ritrovava a non poter
--  colorare la propria squadra.
--
--  Ora vale l'una o l'altro: la scelta privata, oppure il legame
--  pubblico. Il resto della funzione, messaggi compresi, non cambia.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.imposta_colore(p_lega uuid, p_squadra bigint, p_colore text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.e_membro(p_lega) then
    raise exception 'non fai parte di questa lega' using errcode = '42501';
  end if;
  if not exists (select 1 from public.squadre s where s.lega_id = p_lega and s.id = p_squadra) then
    raise exception 'la squadra non è di questa lega' using errcode = '22023';
  end if;
  if not public.puo_scrivere(p_lega)
     and not exists (
       select 1 from public.preferenze p
        where p.lega_id = p_lega and p.utente_id = auth.uid() and p.mia_squadra = p_squadra
     )
     and not exists (
       select 1 from public.squadre s
        where s.lega_id = p_lega and s.id = p_squadra and s.allenatore = auth.uid()
     ) then
    raise exception 'sola lettura: puoi cambiare solo il colore della tua squadra' using errcode = '42501';
  end if;
  update public.squadre set colore = upper(p_colore) where lega_id = p_lega and id = p_squadra;
end $$;
