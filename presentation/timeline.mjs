// Single source of truth for clip lengths and narration – used by record.mjs,
// post/montage.mjs and the subtitles. Times are in seconds (target length in the film).
export const CLIPS = [
  { id: "I.1", src: "page", target: 6, line: "Co się stanie z pieniędzmi na leczenie mojego dziecka, jeśli jutro trafię do szpitala?" },
  { id: "I.2", src: "page", target: 10, line: "Pełnomocnictwo w banku wygasa, a sąd ustanawia opiekuna tygodniami. A leki trzeba kupić dziś." },
  { id: "II.1", src: "page", target: 4, line: "AuraSwitch. Opieka, która nie czeka na sąd." },
  { id: "II.2", src: "page", target: 8, line: "Dopóki jesteś obok, twój telefon mówi „Jestem”. Gdy sygnał zniknie, fundusz trafi do zastępcy." },
  { id: "III.1", src: "screen", target: 14, keep1x: ["phantom:open", "phantom:confirm"], frame: "window", line: "Opiekun zakłada fundusz: wskazuje zastępcę, ustala czas bez sygnału i wpłaca pół SOL-a. Podpisuje w Phantomie." },
  { id: "III.2", src: "page", target: 8, pip: "phone", line: "Telefon leży obok. Laptop słyszy go przez Bluetooth i co kilka sekund wysyła do sieci „Jestem”." },
  { id: "III.3", src: "page", target: 12, speed: "auto", pip: "phone", line: "Sygnał znika. Nikt nic nie klika – licznik w programie na Solanie biegnie do zera." },
  { id: "III.4", src: "page", target: 16, line: "Zero. Program przekazuje cały fundusz zastępcy. Saldo rośnie na żywo – bez banku, notariusza i sądu." },
  { id: "III.5", src: "screen", target: 12, keep1x: ["phantom:open", "phantom:confirm"], frame: "window", line: "Opiekun wraca? Jedno „Jestem” w Phantomie i fundusz znów jest aktywny." },
  { id: "IV.1", src: "page", target: 8, line: "Przekazanie podpisał klucz urządzenia, ale pieniądze trafiły tylko do zastępcy." },
  { id: "IV.2", src: "page", target: 10, line: "Reguły są w programie. Przed czasem odmówi, na inny adres odmówi. Tu nie ma pośrednika, który może powiedzieć „nie”." },
  { id: "V.1", src: "page", target: 7, line: "Sprawdźcie sami – bez telefonu, z dwoma kontami w Phantomie." },
  { id: "V.2", src: "page", target: 5, line: "AuraSwitch. Opieka, która nie czeka na sąd." },
];

export const clip = (id) => CLIPS.find((c) => c.id === id);

/** Slide steps per slide id (must match app/src/pages/Slides.tsx). */
export const SLIDE_STEPS = { "I.1": 1, "I.2": 3, "II.1": 1, "II.2": 3, "IV.2": 3, "V.1": 1, "V.2": 1 };
