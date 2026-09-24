# StonApp — loghi delle cerchie

## Cosa cambia

- Quando crei una cerchia puoi scegliere fra otto simboli oppure caricare una foto dalla galleria. La foto viene ritagliata quadrata, ridimensionata a 256 × 256 e salvata come JPEG nel database insieme alla cerchia.
- Il logo compare nell'elenco e nell'intestazione della cerchia.
- Se apri un utente dall'interno di una cerchia, i messaggi privati conservano quella provenienza. Una barra sopra la conversazione indica da quale cerchia stai scrivendo.
- Nella Chat generale, accanto al mittente, compare il logo della cerchia per i nuovi messaggi non letti. Se una persona scrive da più cerchie, compaiono più loghi. I messaggi diretti mantengono la bustina.
- Toccando un logo apri la conversazione e puoi rispondere dalla stessa cerchia. Toccando invece la riga dell'utente nella Chat generale scrivi un messaggio diretto.
- La conversazione privata resta unica fra le due persone: aprirla mostra tutti i loro messaggi e azzera tutti i relativi indicatori. Le nuove bolle provenienti da una cerchia riportano il nome della cerchia.
- Le cerchie esistenti senza logo usano un simbolo legato alla tipologia. I messaggi storici senza provenienza restano leggibili; non è possibile dedurne retroattivamente la cerchia.
- Il server consegna il primo messaggio anche a un destinatario collegato che non abbia mai aperto quella conversazione.

## Come avviare sul Mac

1. Conserva la tua cartella attuale come copia di sicurezza. Estrai lo ZIP e lavora nella cartella estratta `stoneapp copia`, che contiene sia `stonApp` sia `stonApp-backend`.
2. Ferma il vecchio server e il vecchio processo Expo con Ctrl+C nei rispettivi terminali.
3. Apri un terminale nella cartella estratta `stonApp-backend` ed esegui:

```bash
npm ci
node server.js
```

4. Apri un secondo terminale nella cartella estratta `stonApp` ed esegui:

```bash
npm ci
npx expo start -c
```

5. Avvia il simulatore con `i`, oppure apri Expo Go sul telefono come fai abitualmente. Mac e telefono devono raggiungere lo stesso server.

L'indirizzo del server in `stonApp/App.js` è rimasto `http://192.168.0.150:3001`. Se l'IP del Mac è cambiato, controllalo con `ipconfig getifaddr en0` e aggiorna `API_BASE_URL`.

Sono stati aggiunti `expo-image-picker` e `expo-image-manipulator` nelle versioni previste dall'Expo SDK 57 già presente nel tuo progetto. `npm ci` usa il file di dipendenze aggiornato. Se usi una development build personalizzata anziché Expo Go, ricostruiscila per includere i nuovi moduli nativi.

Aggiorna sia frontend sia backend: il nuovo invio richiede la conferma del server aggiornato.

## Prova con due utenti

1. Accedi sul simulatore con A e sul telefono con B.
2. Con A crea una cerchia con un simbolo, invita B e fai accettare l'invito a B.
3. Lascia B nella Home. Con A entra nella cerchia, tocca B e invia un messaggio privato.
4. Su B controlla il pallino della scheda Chat e il logo accanto ad A. Tocca il logo: si apre la conversazione con l'indicazione della cerchia; gli indicatori si azzerano.
5. Ripeti con una seconda cerchia usando una foto. Senza aprire la conversazione su B, invia da A messaggi dalle due cerchie: devono apparire entrambi i loghi.
6. Dalla Chat generale di A invia un messaggio diretto: su B deve apparire anche la bustina.
7. Prova ad annullare la scelta di una foto: il logo scelto prima deve restare. Chiudi e riapri l'app: il logo della cerchia deve essere ancora presente.

## Verifiche eseguite

- Sette test automatici sulla selezione e validazione dei loghi, sull'origine dei messaggi, sui destinatari e sull'accumulo degli indicatori: superati.
- Controllo sintattico del server e del codice JSX: superato.
- Esportazione del bundle iOS tramite Expo/Metro: completata.
- Configurazione Expo e plugin: verificata.

Per ripetere i test, dalla cartella `stonApp-backend`:

```bash
node --test tests/circle-logos.test.js
```

La prova su iPhone/simulatore e la verifica con il tuo MongoDB restano da eseguire sul Mac. Durante la preparazione non è stato avviato il server contro il database reale.

Gli indicatori dei messaggi non letti restano in memoria, come nel progetto iniziale: questa modifica non introduce recupero delle notifiche ricevute mentre l'app è chiusa o notifiche push.

Nota sul progetto ricevuto: `server.js` contiene una credenziale MongoDB direttamente nel codice. Prima di condividere il progetto o pubblicarlo, trasferiscila in una variabile d'ambiente e cambiala su Atlas. Non è stata riportata in queste istruzioni.

Riferimenti delle API Expo utilizzate:
- https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/
- https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/
