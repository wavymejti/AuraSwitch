// Demo identities and RPC access (RPC URL comes from app/.env.local – never hard-coded).
import fs from "node:fs";

export const A = process.env.A ?? "2JzEXDxS9iba1U9qB8SbteKkFtoLA97rz7a9Aj8AKFBt";
export const B = process.env.B ?? "CfUqLp1EGRXFjcA5MBi6RKGg8yPTCiVpirzV1AfXYUcZ";
export const DEVICE = process.env.DEVICE ?? "F849H9pe12xYkC5k5enZpS4ePsiWJC3LL2d29jtYxPEG";
export const PROGRAM = "CmMRpxgNfSqx69y3tXV4hvVkh7RztYK5Et1SrycikQM7";

export const appEnv = (key) => {
  try {
    return fs
      .readFileSync(new URL("../../app/.env.local", import.meta.url), "utf8")
      .match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]
      ?.trim();
  } catch {
    return undefined;
  }
};

export const rpc = async (method, params) => {
  const url = appEnv("VITE_RPC") ?? "https://api.devnet.solana.com";
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }).then((r) => r.json());
  if (res.error) throw new Error(`${method}: ${JSON.stringify(res.error)}`);
  return res.result;
};
