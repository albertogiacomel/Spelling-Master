# Spelling & Magic Box

Gioco educativo per allenare lo spelling inglese nella scuola primaria.
Ascolta la voce inglese, scrivi le lettere nella scatola magica e scegli tra
spelling diretto, indiretto e sfida con tre vite.

**Live:** https://spelling.giacomel.info/

## Cosa contiene

- Tre modalità: parola intera, spelling lettera per lettera e sfida mista.
- Quattro livelli: 3-4 lettere, 5 lettere, 6-7 lettere, tutte le parole.
- 49 parole con traduzione italiana, categoria e frase di esempio.
- Voce inglese del dispositivo (US o UK), velocità lenta e pausa regolabile.
- Tastiera fisica e tastiera magica sullo schermo; pronuncia della singola lettera.
- Alfabeto A-Z con lettere "birichine" ed esempi fonetici.
- Stelle, serie di risposte corrette, tre vite nella sfida, record salvato.
- Preferenze condivise del kit: lingua IT/EN, tema, contrasto, animazioni,
  audio, difficoltà e schermo intero.
- Privacy condivisa: shell comune, informativa, preferenze e `ads.txt`.

## Stack e integrazione

- **TypeScript strict** + DOM, bundling con **esbuild**, output statico in `dist/`.
- **videogames-kit 0.3.0** vendorizzato in `shared/videogames-kit` al commit
  `a2ea2f89926ea9029aae7e15002f4154e7c54a86`.
- Shell, design token e privacy da `site-privacy/` (stesso pin del kit).
- Nessun CDN: niente Tailwind, Google Fonts, icone remote o JSZip a runtime.
- Voce tramite `SpeechSynthesis`; nessun testo inviato a servizi TTS esterni.
- Salvataggi con `VersionedStore`: slot `settings`, `progress` e `options`.
  Le vecchie preferenze del prototipo (`spellingMagicBoxPrefs`) vengono migrate
  senza cancellare la chiave originale.

## Comandi

```sh
npm ci
npm run build            # typecheck + bundle + dist
npm test                 # test di logica e salvataggi
npm run check:privacy    # hash, policy, ads.txt e integrazione shell
npm run test:browser     # test CDP su Edge/Chrome (1280, 390, 320 px)
npm run verify:live      # confronto del deploy con dist locale
```

`npm run test:browser` usa Edge o Chrome installati; impostare
`BROWSER_BINARY` per indicare un eseguibile diverso.

## Deploy

Cloudflare Pages, progetto `spelling`, output `dist/`:

```sh
npx wrangler pages deploy dist --project-name spelling --branch main
```

Il dominio personalizzato è `spelling.giacomel.info`; il CNAME deve puntare a
`spelling.pages.dev`. La policy e i preferiti privacy sono in
`https://spelling.giacomel.info/privacy.html`.

## Struttura

```text
src/            HTML, CSS, TypeScript del gioco
shared/         kit vendorizzato (pin a2ea2f8)
site-privacy/   shell, token, runtime Klaro e informativa (pin a2ea2f8)
public/         ads.txt, robots.txt, header, icona, manifest
scripts/        build, test, verifica privacy e browser
dist/           output generato (non versionato)
```

## Verifica

La build controlla il budget (180 KB per HTML+CSS+JS), la sintassi del bundle e
la copia degli asset privacy. I test coprono parole, frasi, punteggio,
migrazioni, versioni future, preferenze e flusso di gioco nel browser.
