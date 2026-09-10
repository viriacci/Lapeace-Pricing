# La Peace Pricing

Webowa aplikacja do wyceny zleceń i materiałów Minecraft Java 1.21.11.

## Funkcje

- wyszukiwanie przedmiotów z bazy Minecraft 1.21.11,
- polskie i angielskie nazwy przedmiotów,
- obsługa własnych przedmiotów,
- stacki, sztuki, cena za sztukę i automatyczne sumowanie,
- biblioteka zapisanych cen,
- wiele wycen z możliwością zmiany nazwy,
- statusy wycen: w trakcie / zrealizowano,
- wspólna baza zespołu w Supabase,
- logowanie użytkowników,
- zapraszanie do zespołu linkiem `?join=...`,
- synchronizacja zmian przez Supabase Realtime z awaryjnym odpytywaniem,
- lokalna kopia danych i zabezpieczenie niezapisanej zmiany przy szybkim odświeżeniu lub zamknięciu karty,
- PWA z bezpiecznym cache i preferowaniem świeżego kodu aplikacji.

## Architektura

Frontend jest celowo uproszczony do dwóch warstw JavaScript:

- `app.js` jest jedynym źródłem stanu interfejsu i logiki wycen,
- `cloud-sync.js` odpowiada wyłącznie za logowanie, zespoły i synchronizację z Supabase.

Dane zespołu są przechowywane w `workspace_state`. `localStorage` pełni rolę lokalnej kopii, a nie niezależnego źródła prawdy konkurującego z chmurą.

GitHub Pages jest wdrażane automatycznie przez `.github/workflows/pages.yml`.
