-- ════════════════════════════════════════════════════════════════════
--  La lega nasce con la sua stagione, e senza squadre doppie
--
--  Due cose che crea_lega() non faceva:
--
--  1. La stagione. leghe.stagione ha un valore predefinito scritto nello
--     schema ('2026/27') e la funzione non lo accettava: finché il
--     calendario di serie A si scaricava a mano uno se ne accorgeva, ma
--     ora parte da solo dalla schermata di avvio, e senza questo
--     parametro fra un anno scaricherebbe l'anno sbagliato in silenzio.
--     Si scrive solo se arriva, così il valore predefinito della colonna
--     resta l'unica fonte del ripiego invece di essere copiato qui.
--
--  2. I doppioni. Due squadre con lo stesso nome si creavano senza un
--     fiato, e poi «Chi sono io» e gli abbinamenti del calendario di lega
--     diventavano ambigui: un nome non bastava più a dire quale squadra.
--     È un invariante della lega, quindi sta qui; il controllo nel modulo
--     serve solo a dirlo prima di premere «Crea».
--
--  Il parametro nuovo va in coda ed è facoltativo: le chiamate con tre
--  argomenti posizionali (i test su PGlite, e il client fino a ieri)
--  continuano a funzionare. Serve però DROP e non CREATE OR REPLACE,
--  perché aggiungere un parametro cambia la firma e lascerebbe due
--  funzioni sovrapposte.
-- ════════════════════════════════════════════════════════════════════

drop function public.crea_lega(text, text[], int);

create function public.crea_lega(p_nome text, p_squadre text[], p_budget int default 500,
                                 p_stagione text default null) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_lega uuid;
  v_doppio text;
begin
  if auth.uid() is null then
    raise exception 'serve un utente autenticato' using errcode = '42501';
  end if;
  if coalesce(array_length(p_squadre, 1), 0) < 2 then
    raise exception 'servono almeno due squadre' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_squadre) as s (nome) where btrim(s.nome) = '') then
    raise exception 'una squadra è senza nome' using errcode = '22023';
  end if;
  -- spazi e maiuscole non fanno due squadre diverse; nel messaggio va il nome come è stato scritto
  select min(s.nome) into v_doppio
    from unnest(p_squadre) as s (nome)
   group by lower(btrim(s.nome))
  having count(*) > 1
   limit 1;
  if v_doppio is not null then
    raise exception 'due squadre si chiamano «%»' , v_doppio using errcode = '22023';
  end if;
  if p_stagione is not null and p_stagione !~ '^\d{4}/\d{2}$' then
    raise exception 'stagione «%»: serve la forma 2026/27', p_stagione using errcode = '22023';
  end if;

  insert into public.leghe (nome, budget, creata_da) values (p_nome, p_budget, auth.uid()) returning id into v_lega;
  if p_stagione is not null then
    update public.leghe set stagione = p_stagione where id = v_lega;
  end if;
  insert into public.membri (lega_id, utente_id, ruolo) values (v_lega, auth.uid(), 'admin');
  insert into public.squadre (lega_id, nome, posizione)
    select v_lega, btrim(s.nome), s.i::int from unnest(p_squadre) with ordinality as s (nome, i);
  return v_lega;
end $$;

-- Una funzione nuova nasce con EXECUTE concesso a PUBLIC, e il revoke dello
-- schema iniziale valeva solo per le funzioni di allora: senza questa riga
-- anon entrerebbe nella funzione e a fermarlo resterebbe il solo controllo
-- su auth.uid(), invece del cancello del database. Lo dice il test in
-- db/schema.test.ts, che pretende «permission denied».
revoke all on function public.crea_lega(text, text[], int, text) from public, anon;
grant execute on function public.crea_lega(text, text[], int, text) to authenticated;
