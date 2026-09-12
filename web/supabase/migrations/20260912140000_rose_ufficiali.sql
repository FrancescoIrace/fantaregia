-- ════════════════════════════════════════════════════════════════════
--  Rose ufficiali: allineare l'asta al file della lega
--
--  Il file che la lega pubblica è la versione firmata: se non combacia
--  con quello che è stato segnato all'asta, sbaglia quasi sempre
--  l'appunto. allinea_rose() riscrive in un colpo solo le voci che il
--  confronto ha trovato diverse (allineaRose in src/part4.html).
--
--  Attenzione a cosa NON fa: i movimenti veri di mercato — uno esce e un
--  altro entra, o due si scambiano di posto — vanno registrati con
--  registra_scambio/registra_svincolo, non riscritti qui: riscriverli
--  sposterebbe anche i punti fatti prima a chi il giocatore non l'aveva.
-- ════════════════════════════════════════════════════════════════════

create function public.allinea_rose(p_lega uuid, p_righe jsonb) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  r record;
  v_messi int := 0; v_tolti int := 0; v_corretti int := 0;
begin
  if not public.puo_scrivere(p_lega) then
    raise exception 'sola lettura: non puoi allineare le rose' using errcode = '42501';
  end if;
  for r in
    select * from jsonb_to_recordset(coalesce(p_righe, '[]'))
      as x (stato text, pid int, squadra bigint, prezzo int, snap jsonb)
  loop
    if r.pid is null then continue; end if;
    if r.stato = 'solofile' then
      insert into public.assegnazioni (lega_id, giocatore_id, squadra_id, prezzo, snap)
        values (p_lega, r.pid, r.squadra, coalesce(r.prezzo, 0), r.snap)
        on conflict (lega_id, giocatore_id)
        do update set squadra_id = excluded.squadra_id, prezzo = excluded.prezzo, snap = excluded.snap;
      v_messi := v_messi + 1;
    elsif r.stato = 'squadra' then
      update public.assegnazioni set squadra_id = r.squadra, prezzo = coalesce(r.prezzo, prezzo)
        where lega_id = p_lega and giocatore_id = r.pid;
      v_corretti := v_corretti + 1;
    elsif r.stato = 'prezzo' then
      update public.assegnazioni set prezzo = coalesce(r.prezzo, prezzo)
        where lega_id = p_lega and giocatore_id = r.pid;
      v_corretti := v_corretti + 1;
    elsif r.stato = 'soloapp' then
      delete from public.assegnazioni where lega_id = p_lega and giocatore_id = r.pid;
      v_tolti := v_tolti + 1;
    end if;
  end loop;
  return jsonb_build_object('messi', v_messi, 'tolti', v_tolti, 'corretti', v_corretti);
end $$;

revoke all on function public.allinea_rose(uuid, jsonb) from public, anon;
grant execute on function public.allinea_rose(uuid, jsonb) to authenticated;
