import type { DurableObjectNamespace } from "@cloudflare/workers-types";

export interface Env {
  VERSION?: string;
  ENVIRONMENT?: string;
  VAULT_DO?: DurableObjectNamespace;
}
