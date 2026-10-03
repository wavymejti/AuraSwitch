/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC?: string;
  readonly VITE_HEARTBEAT_SECRET?: string;
  readonly VITE_APTEKA?: string;
  readonly VITE_OSRODEK?: string;
  readonly VITE_NONCE_BASE?: string;
}
