import type { PublicKey } from "@solana/web3.js";
import { motion } from "motion/react";
import { Bluetooth, BluetoothOff, Radio, Smartphone } from "lucide-react";
import { explorerTx } from "../lib/config";
import type { PresenceStatus } from "../hooks/usePresence";

interface Props {
  status: PresenceStatus | null;
  pda: PublicKey;
}

/** "Is the caregiver's phone nearby?" as reported by the local presence agent. */
export const PresenceBar = ({ status, pda }: Props) => {
  if (!status) return null;

  if (status.vault?.address !== pda.toBase58()) {
    return (
      <div className="presence is-off">
        <span className="presence-icon">
          <Radio size={20} />
        </span>
        <div className="presence-text">
          <strong>Agent obecności pilnuje innego funduszu</strong>
          <span>
            {status.vault ? `Fundusz nr ${status.vault.id}. ` : ""}Agent śledzi najnowszy fundusz z kluczem urządzenia.
          </span>
        </div>
      </div>
    );
  }

  const { phone, lastPing } = status;
  const ping = lastPing && (
    <>
      {" · "}ostatnie „Jestem”{" "}
      <a href={explorerTx(lastPing.sig)} target="_blank" rel="noreferrer">
        {lastPing.secsAgo} s temu
      </a>
    </>
  );

  if (!status.vault.active) {
    return (
      <div className="presence is-off">
        <span className="presence-icon">{phone.present ? <Smartphone size={20} /> : <BluetoothOff size={20} />}</span>
        <div className="presence-text">
          <strong>{phone.present ? "Telefon opiekuna jest w pobliżu" : "Telefon opiekuna poza zasięgiem"}</strong>
          <span>Fundusz jest już u zastępcy. Przywróci go tylko opiekun główny („Jestem” w portfelu).</span>
        </div>
      </div>
    );
  }

  return phone.present ? (
    <div className="presence is-near">
      <span className="presence-icon">
        <Smartphone size={20} />
        <motion.span
          className="presence-ripple"
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        />
      </span>
      <div className="presence-text">
        <strong>Telefon opiekuna w pobliżu</strong>
        <span>
          {phone.rssi !== null && `sygnał ${phone.rssi} dBm`}
          {ping}
        </span>
      </div>
    </div>
  ) : (
    <div className="presence is-gone">
      <span className="presence-icon">
        <Bluetooth size={20} />
      </span>
      <div className="presence-text">
        <strong>
          Telefon opiekuna poza zasięgiem
          {phone.absentForSecs !== null && ` od ${phone.absentForSecs} s`}
        </strong>
        <span>Urządzenie przestało mówić „Jestem”. Przy zerze agent przekaże fundusz zastępcy{ping}</span>
      </div>
    </div>
  );
};
