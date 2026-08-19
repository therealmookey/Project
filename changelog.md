# Changelog

Alle belangrijke wijzigingen in dit project worden hier bijgehouden.

## [4.0.0] - 2026-08-19

### Grote update - Tracker module en module rechten

#### Toegevoegd
- ✅ **Tracker module** - Realtime chauffeurs volgen op kaart
- ✅ **Proactief bellen module** op dashboard
- ✅ **Module rechten systeem** - per gebruiker aan/uitzetten
- ✅ **Navigatie filtering** - gebruikers zien alleen wat ze mogen
- ✅ **Sortering voorspellingen** - Te laat (langste eerst), Op schema (eerstkomende eerst)
- ✅ **Gebruikers volledig verwijderen** - inclusief auth.users
- ✅ **Tracker coördinaten** toegevoegd aan adressen
- ✅ **Excel export** met alle combinaties in registraties
- ✅ **Status check** bij registratie (controleert planning status)

#### Gewijzigd
- 🔄 Navigatie laadt asynchroon (geen flits meer)
- 🔄 Module rechten gecached voor snellere laadtijden
- 🔄 Tracker timeout ingesteld op 4 uur
- 🔄 Polling + Realtime combinatie voor stabiele verbinding

#### Opgelost
- 🐛 Gebruikers kunnen nu volledig verwijderd worden
- 🐛 Navigatie toont geen modules meer voor onbevoegde gebruikers
- 🐛 Tracker verbinding blijft stabiel met fallback

---

## [3.0.1] - 2026-08-17

### Kleine aanpassingen

- Sortering van ziekenhuis voorspellingen verbeterd

---

## [3.0.0] - 2026-08-13

### Grote update - Modularisatie en nieuwe features

#### Toegevoegd
- ✅ Alle modules omgezet naar ES Modules
- ✅ Actie module op dashboard (proactief bellen)
- ✅ Winkelmandje functionaliteit in planning (combinaties selecteren)
- ✅ Automatische registratie bij status "uitgevoerd"
- ✅ Automatische voorraad update bij opstart
- ✅ Excel export met alle combinaties
- ✅ Status check bij registratie
- ✅ Analytics filters (ziekenhuis, periode, aangepaste periode)
- ✅ Analytics Excel export
- ✅ Versie badge op alle pagina's
- ✅ Dark mode op alle pagina's

#### Gewijzigd
- 🔄 Navigatie nu modulair
- 🔄 Theme beheer nu modulair
- 🔄 Auth beheer nu modulair
- 🔄 Agenda en voorspellingen nu aparte modules
- 🔄 Planning nummering per dag
- 🔄 Drag & drop sortering vloeiend

#### Opgelost
- 🐛 Dubbele initialisatie van dark mode
- 🐛 404 errors bij ontbrekende tabellen
- 🐛 Grafiek errors bij lege data
- 🐛 Excel export met filters

---

## [2.2.0] - 2026-07-23

### Vorige versie - Core modules

- Basis modules: utils, supabase, version, theme, navigation
- Dashboard met agenda en voorspellingen
- Planning met drag & drop en PDF
- Registraties met filters en export
- Stock met combinaties
- Admin met gebruikersbeheer

---

## [2.1.0] - 2026-07-23

- Theme module toegevoegd
- Navigation module toegevoegd

---

## [2.0.0] - 2026-07-23

- Eerste module structuur
- Supabase core
- Version beheer 