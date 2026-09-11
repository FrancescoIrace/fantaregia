export type RuoloMembro = 'admin' | 'banditore' | 'lettore'

/** come si chiamano i ruoli nell'interfaccia */
export const NOME_RUOLO: Record<RuoloMembro, string> = { admin: 'admin', banditore: 'banditore', lettore: 'sola lettura' }
