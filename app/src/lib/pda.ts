import { BN } from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./config";

export const findVaultPda = (owner: PublicKey, vaultId: BN | number | string) =>
  PublicKey.findProgramAddressSync(
    [
      Buffer.from("care"),
      owner.toBuffer(),
      new BN(vaultId).toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID,
  )[0];
