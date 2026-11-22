# Verifica

## Locale (2026-11-22)

| Controllo | Comando | Esito |
|---|---|---|
| TypeScript | `npx tsc -p tsconfig.json` | PASS |
| Build | `npm run build` | PASS, 137.968 byte |
| Test logica, salvataggi e voce | `npm test` | PASS, 12 test |
| Privacy e shell | `npm run check:privacy` | PASS, 13 asset, 340.732 byte |
| Browser | `npm run test:browser` | PASS, 8 flussi, 0 eccezioni |

Flussi browser verificati:

1. Shell condivisa, impostazioni, cambio IT/EN e tema.
2. Dialogo alfabeto con 26 tessere, A = “ey” e pulsante per tutto l’alfabeto.
3. Spelling diretto: risposta corretta e stelle.
4. Risposta errata: differenza lettere e serie azzerata.
5. Spelling indiretto: frase nascosta e un LED per lettera.
6. Sfida mista: tre salti e schermata risultati.
7. Layout a 1280, 390 e 320 px senza overflow.
8. Stelle salvate dopo il reload.

Artefatti locali: `artifacts/build.json`, `artifacts/browser/browser-report.json`,
`artifacts/browser/home-desktop.png`.

## Pubblico (2026-11-22)

| Controllo | Comando | Esito |
|---|---|---|
| Hash HTML e asset | `npm run verify:live` | PASS, 137.968 byte |
| Gioco nel browser | `npm run test:live` | PASS, alfabeto mobile e parola, 0 eccezioni |
| Card sul portfolio | `https://www.giacomel.info/` | link e copertina presenti |

URL: `https://spelling.giacomel.info/`. Il CNAME `spelling-avm.pages.dev` è in
modalità DNS only per evitare il blocco del wildcard di zona; il certificato
Pages risulta `active`. Artefatti: `artifacts/live.json`,
`artifacts/live-browser/live-browser.json`, `artifacts/live-browser/live-mobile.png`,
`artifacts/live-browser/live-alphabet-mobile.png`.
