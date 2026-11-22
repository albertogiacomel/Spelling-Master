# Videogames Kit

Classi JavaScript e CSS riutilizzabili per i sette videogiochi di albertogiacomel. Moduli ES nativi (Pure ESM per standard R-ESM-STANDARD), dichiarazioni TypeScript e adattatore React opzionale; nessuna dipendenza di esecuzione.

~~~mermaid
flowchart LR
  Profiles[Profili dei sette giochi] --> Settings[SettingsStore]
  Settings --> Store[VersionedStore]
  Settings --> UI[SettingsDialog e AppearanceController]
  Settings --> Audio[AudioManager]
  Keyboard[Tastiera / touch / gamepad] --> Input[InputManager]
  Input --> Engine[Motore del gioco]
  Loop[FixedStepLoop] --> Engine
  Engine --> Render[Renderer del gioco]
  Assets[AssetLoader] --> Render
  React[Adattatore React] --> Settings
  UI --> CSS[Classi CSS con scope ag-game]
~~~

## Classi disponibili

| Classe | Responsabilità |
|---|---|
| GameLifecycleController | Pause indipendenti per menu, scheda nascosta, focus e utente; coordinamento input, loop e audio |
| GameUIController | Collegamento comune ai sette giochi, menu, fullscreen e controller |
| VersionedStore | Persistenza JSON versionata, validator, migrazioni esplicite, protezione versioni future e fallback in memoria |
| SettingsStore | Preferenze validate, snapshot immutabili stabili, sottoscrizioni e reset separato dai progressi |
| I18n | Cataloghi, fallback e interpolazione testuale |
| InputManager | Tastiera, touch simultaneo, gamepad e rilascio sicuro delle sorgenti |
| AudioManager | SFX sintetizzati, canali effects/music/voice, mute immediato e unlock dopo gesto |
| FullscreenController | API nativa, fallback CSS e cleanup |
| FixedStepLoop | Simulazione a passo fisso e recupero limitato |
| AssetLoader | Preload immagini, progressi, errori e AbortSignal |
| AppearanceController | Tema sistema/chiaro/scuro, lingua, contrasto e movimento ridotto |
| SettingsDialog | Menu accessibile, focus ciclico, localizzazione live e preferenze per capacità |

GAME_PROFILES e createGameSettings conservano difficoltà e capacità proprie dei sette giochi. Le classi grafiche ag-game, ag-shell, ag-topbar, ag-panel, ag-button, ag-dialog e ag-field condividono token e stati; le varianti primary/danger/quiet/comic permettono di preservare l'identità di ciascun gioco.

## Quick start

Richiede Node.js 22 o successivo per le verifiche; Chrome/Edge installato per CDP. Eseguire `npm ci` per installare gli strumenti di sviluppo; il runtime resta senza dipendenze.

~~~sh
npm ci
npx playwright install chromium firefox webkit
npm run verify
~~~

Il test browser avvia e chiude autonomamente server e browser headless. BROWSER_BINARY può indicare un eseguibile Chrome/Edge alternativo. La demo è examples/index.html: servirla con HTTP, non file://.

~~~js
import { createGameSettings, AppearanceController, SettingsDialog, GAME_PROFILES } from './src/index.js';

const root = document.querySelector('#game');
root.classList.add('ag-game');
const settings = createGameSettings('battleship');
const appearance = new AppearanceController(root, settings);
const profile = GAME_PROFILES.battleship;
const dialog = new SettingsDialog(root, settings, {
  channels: [...profile.channels],
  difficulties: profile.difficulties.map(value => ({ value, label: value })),
});
document.querySelector('#settings').onclick = event => dialog.open(event.currentTarget);
// Includere styles/game-ui.css. Smontando il gioco: dialog.dispose(); appearance.dispose().
~~~

Per incorporare il pacchetto in un consumer locale: dipendenza file:../videogames-kit oppure copia versionata di src/, adapters/ e styles/ nella toolchain del gioco. Gli export pubblici del pacchetto sono il core, /integration, /react, /react-ui e /styles.css; non sono serviti moduli da CDN.

## Documentazione e verifiche

- [Provenienza, contratti e integrazione nei sette giochi](docs/integration.md)
- [Report integrazione nei sette giochi e benchmark prima/dopo](docs/integration-report.md)
- [Release, compatibilità, aggiornamento selettivo e rollback](docs/release.md)
- [Test e benchmark 0.3.0](docs/verification-0.3.0.md)
- [Novità 0.3.0](docs/release-notes-0.3.0.md)
- [Catalogo grafico interattivo](examples/catalog.html)
- [Verifiche del nucleo](docs/verification.md)
- [Esempio React con cleanup](examples/react.tsx)
- [Demo DOM funzionante](examples/index.html)

La suite locale passa 22 test, il test browser copre interazioni reali, e il componente React è stato verificato con i consumer React 18.3.1 e 19.0.0. I risultati dettagliati sono negli artifacts. La CI in .github/workflows/ci.yml esegue controlli, test unitari e browser a ogni push.

La versione 0.3.0 è integrata nei sette repository locali, con preferenze migrate, CSS e test indipendenti. La pubblicazione dei giochi segue i workflow dei rispettivi repository. Non è stata assegnata una licenza di redistribuzione agli asset o ai sorgenti dei giochi. Le pratiche sono state reimplementate nel kit senza copiarne personaggi, contenuti o grafica.

## Profili configurabili

```js
import {registerGameProfile, createGameSettings, GameLifecycleController} from './src/index.js';
registerGameProfile({
  gameId: 'nuovo-gioco', difficulties: ['normal', 'expert'], difficulty: 'normal',
  channels: ['effects'], defaults: {theme: 'system'},
  messages: {it: {expert: 'Esperto'}, en: {expert: 'Expert'}},
  legacy: [{key: 'vecchie-preferenze', fields: [{from: 'lingua', to: 'language'}]}],
});
const settings = createGameSettings('nuovo-gioco');
const lifecycle = new GameLifecycleController({input, loop, audio});
lifecycle.pause('settings');
lifecycle.pause('manual');
lifecycle.resume('settings'); // La pausa manuale resta attiva.
lifecycle.resume('manual');
// Smontaggio: lifecycle.dispose(); poi dispose delle risorse possedute dal gioco.
```

I sette preset rimangono disponibili in `GAME_PROFILES`; `getGameProfile()` e `listGameProfiles()` includono anche quelli registrati dall'applicazione. Le migrazioni leggono le chiavi precedenti senza cancellarle e aggiornano soltanto preferenze validate. Non registrare due volte lo stesso identificativo.

`GameUIController.lifecycle` gestisce automaticamente impostazioni e visibilità. I callback `onOpen`/`onClose` esistenti sono invocati alla prima pausa e all'ultima ripresa, così i giochi mantengono il proprio stato. Il controller non possiede il motore: input, loop e pause specifiche possono essere collegati esplicitamente con `GameLifecycleController`.

Le classi `ag-grid` e `ag-grid--3` definiscono colonne uguali e una colonna su schermi stretti. `ag-equal-items` uniforma larghezza, margini e allineamento delle schede in una griglia esistente, evitando ingrandimenti/rotazioni degli stati selezionati. Nei dialoghi tutte le select condividono la stessa colonna e larghezza; i checkbox conservano la misura accessibile e si allineano a destra.

Tipografia comune: `--ag-font` e token `--ag-type-body`, `--ag-type-label`, `--ag-type-caption`, `--ag-type-title`. Controlli a 16 px, etichette a 15 px e messaggi a 14 px con interlinea 1.4–1.5; misure in rem per rispettare le preferenze del browser. I titoli crescono con la viewport e le etichette vanno a capo senza alterare le colonne. I menu mobili mantengono almeno 14 px.

La [skill videogiochi](skills/videogiochi/SKILL.md) raccoglie le pratiche verificate del kit. L’entrypoint rimane breve; le guide su UX e release si leggono soltanto quando pertinenti. Il sorgente versionato della skill è in `skills/videogiochi/`; le installazioni locali OpenCode e Codex devono essere allineate a questi file.

## Privacy e annunci sui siti

Modulo facoltativo e separato dal runtime: [privacy condivisa](docs/site-privacy.md), inventario in `sites.json`. Include Klaro locale con provenienza e licenza, preferenze e informativa, gate per servizi facoltativi e unità AdSense CHILD predisposta. Gli annunci live sono disattivati in attesa della configurazione Google. `npm run sync:sites` produce un piano; `npm run test:privacy` verifica il modulo senza impressioni pubblicitarie reali.
