# Runde 2: In-Process-Erweiterungen

Diese Runde erlaubt ausschließlich flüchtigen Prozesszustand. Es werden weder
Dateien geschrieben noch Environment-Variablen gelesen, zusätzliche HTTP-Server
gestartet oder Module dynamisch geladen.

| Nr | was | Bezug zum alten Plan | betroffene Dateien | Aufwand | Risiko | Entscheidung |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Versionierter request-exakter LRU-Extract-Cache | #18 + #19 | `extract.ts`, `runtime-config.ts`, Manifest, Tests, Docs | M | mittel: Cache-Identity darf keine Secrets enthalten und Hits müssen die vollständige Antwort bewahren | **ja** — prozesslokal, begrenzt und konfigurierbar. |
| 2 | Volltext auf Abruf über Referenz und Bereich am bestehenden Extract-Tool | #17 | `extract.ts`, `index.ts`, Manifest, Tests, Docs | M | mittel: Referenz lebt nur mit dem Cache-Eintrag | **ja** — zusätzliches Argument am bestehenden Tool ist ausreichend; kein neues Tool nötig. |
| 3 | Budget-Preflight für Fan-out, Deadline und Extract-Kontext | #10 | `extract.ts`, `research.ts`/`index.ts`, Runtime/Manifest, Tests, Docs | M | mittel: nur ehrliche vorab durchsetzbare Limits | **ja, teilweise** — die **tägliche Quote wird ausdrücklich nicht portiert**, weil sie ein persistentes Ledger braucht. |
| 4 | Read-only Health-Tool für Adaptive-Samples | #24 + brauchbarer Teil von #12 | `provider-stats.ts`, `index.ts`, Manifest, Tests, Docs | S | niedrig: Prozesslebensdauer muss sichtbar bleiben | **ja** — Tool statt HTTP-Endpunkt, keine Tagesbuckets über Neustarts. |
| 5 | Prozesslokale Shadow-Quality-Beobachtungen | #23 | neue Beobachtungs-Hilfe, `index.ts`, Health-Tool, Tests, Docs | M | niedrig: nur aggregierte, request-lokale Messungen | **ja** — keine SQLite, keine Console-Ausgabe. |
| 6 | Deterministischer Routing-Override statt Kill-Switch | #16 | `index.ts`, `extract.ts`, Manifest, Tests, Docs | S | niedrig: Override muss im Routing-Report sichtbar sein | **ja** — Tool-Argument erzwingt einen Provider bzw. deaktiviert Auto-Routing ohne Environment-Variablen. |
| 7 | Expliziter, begrenzter Extract-Benchmark | #15 + #35 | `index.ts`, `extract.ts`, Manifest, Tests, Docs | M | mittel: kostenverursachende Aufrufe nur opt-in, Hound-Gate bleibt wirksam | **ja** — separates, read-only Ergebnis-Tool mit hartem Provider-call-Limit und prozesslokaler Empfehlung; nie automatisch. |

Jeder umgesetzte Punkt erhält einen eigenen Commit. Der Cache ist die gemeinsame
Grundlage für Volltextreferenzen; die Volltextfunktion wird deshalb erst nach
Punkt 1 implementiert. Dokumentation und `dist/index.js` werden mit dem jeweils
betroffenen Feature aktualisiert.
