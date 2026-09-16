export type RuoloMembro = 'admin' | 'banditore' | 'lettore'

/** come si chiamano i ruoli nell'interfaccia.
    `lettore` si chiama «allenatore»: non è una visita guidata — la sua
    squadra la gestisce lui (colore, obiettivi, formazioni, che le policy di
    preferenze tengono per utente), e legge tutto il resto. */
export const NOME_RUOLO: Record<RuoloMembro, string> = { admin: 'admin', banditore: 'banditore', lettore: 'allenatore' }
