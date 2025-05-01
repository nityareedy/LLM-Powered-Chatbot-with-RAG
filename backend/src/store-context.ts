import { createContextKey } from "@connectrpc/connect";

export const envStore = createContextKey<Env | undefined>(undefined);
