// @vitest-environment jsdom
/* Cambiando pagina si riparte dall'alto: prima si restava all'altezza della
   pagina lasciata. */
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import InCima from '../src/viste/InCima.tsx'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('cambiando pagina', () => {
  it('si torna in cima quando cambia il percorso, non quando cambia solo la ricerca', () => {
    const su = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    let vai: ReturnType<typeof useNavigate> = () => {}
    function Comandi() { const n = useNavigate(); vai = n; return null }
    const box = document.createElement('div')
    const radice = createRoot(box)
    act(() => radice.render(createElement(MemoryRouter, { initialEntries: ['/lega/l1/listone'] }, createElement(InCima), createElement(Comandi))))
    su.mockClear()
    act(() => { void vai('/lega/l1/formazioni') })
    expect(su).toHaveBeenCalledWith(0, 0)
    su.mockClear()
    act(() => { void vai('/lega/l1/formazioni?g=5') })
    expect(su).not.toHaveBeenCalled()
    act(() => radice.unmount())
    su.mockRestore()
  })
})
