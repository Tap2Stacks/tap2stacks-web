/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_TUSDC_ADDRESS?: string;
  readonly VITE_VAULT_ADDRESS?: string;
  readonly VITE_PROOF_ANCHOR_ADDRESS?: string;
  readonly VITE_ENABLE_DEV_TOOLS?: string;
  readonly VITE_PREVIEW_TOPUP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
