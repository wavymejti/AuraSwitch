const PROGRAM_ERRORS: Record<string, string> = {
  NotAuthorized: "Nie masz uprawnień do tej operacji.",
  NotExpired: "Opiekun jest jeszcze aktywny – czas jeszcze nie minął.",
  NotInTakeover: "Przejęcie nie zostało aktywowane.",
  NotActive: "Fundusz jest w trybie przejęcia.",
  RecipientNotAllowed: "Odbiorca spoza listy zatwierdzonych placówek.",
  InsufficientFunds: "Za mało środków w funduszu.",
  InvalidConfig:
    "Nieprawidłowe ustawienia funduszu (czas > 0, 1–3 placówki, bez opiekunów na liście).",
};

// Anchor custom error numbers start at 6000, in declaration order.
const CODE_BY_NUMBER = Object.keys(PROGRAM_ERRORS);

const errorText = (e: any): string => {
  const logs: string[] =
    e?.logs ?? e?.transactionLogs ?? e?.error?.logs ?? [];
  return [e?.message, e?.transactionMessage, ...logs, String(e ?? "")]
    .filter(Boolean)
    .join("\n");
};

const programCode = (e: any, text: string): string | undefined => {
  const direct = e?.error?.errorCode?.code;
  if (direct) return direct;
  const named = text.match(/Error Code: (\w+)/)?.[1];
  if (named) return named;
  const hex = text.match(/custom program error: 0x([0-9a-f]+)/i)?.[1];
  if (hex) return CODE_BY_NUMBER[parseInt(hex, 16) - 6000];
  return undefined;
};

export interface HumanError {
  message: string;
  /** Raw error text, shown small under the message for debugging. */
  detail: string;
}

/** Turns wallet / RPC / program errors into a sentence a caregiver can read. */
export const humanError = (err: unknown): HumanError => {
  const e = err as any;
  const text = errorText(e);
  const detail = String(e?.message ?? e ?? "").slice(0, 400);
  const say = (message: string) => ({ message, detail });

  const code = programCode(e, text);
  if (code && PROGRAM_ERRORS[code]) return say(PROGRAM_ERRORS[code]);

  if (/\b429\b|Too Many Requests|rate limit/i.test(text))
    return say("Sieć testowa ogranicza liczbę zapytań – odczekaj chwilę i spróbuj ponownie.");
  if (/User rejected|rejected the request|denied|cancel/i.test(text))
    return say("Anulowano w portfelu.");
  if (/Unexpected error/i.test(text))
    return say(
      "Portfel zgłosił błąd – sprawdź, czy w Phantom wybrane jest to samo konto, które jest połączone ze stroną, i czy sieć to Devnet.",
    );
  if (/no record of a prior credit|insufficient lamports/i.test(text))
    return say("Za mało SOL w portfelu na tę operację.");
  if (/insufficient funds for rent/i.test(text))
    return say("Konto odbiorcy jest puste – najpierw zasil je minimalną kwotą.");
  if (/Invalid public key|Non-base58/i.test(text)) return say("Nieprawidłowy adres.");
  if (/block height exceeded|has expired/i.test(text))
    return say("Transakcja wygasła – zatwierdź ją w portfelu w ciągu kilkunastu sekund.");
  const tail = String(e?.message ?? "").slice(-200);
  if (/TRANSAKCJA WYGASŁA/.test(text))
    return {
      message: "Transakcja wygasła – w sieci testowej trzeba ją zatwierdzić w Phantomie w ciągu ~30 sekund. Kliknij jeszcze raz.",
      detail: tail,
    };
  if (/portfel zmienił transakcję/i.test(text))
    return {
      message: "Phantom zmienił transakcję przed podpisaniem – zrób zrzut ekranu tego komunikatu i przekaż go dalej.",
      detail: tail,
    };
  if (/portfel podmienił blockhash/i.test(text))
    return {
      message: "Portfel jest ustawiony na inną sieć – w Phantom wybierz Settings → Developer Settings → Solana Devnet.",
      detail: tail,
    };
  if (/Blockhash not found|was not confirmed|Failed to fetch|NetworkError/i.test(text))
    return say("Problem z siecią – spróbuj ponownie.");
  return say(detail || "Nieznany błąd.");
};
