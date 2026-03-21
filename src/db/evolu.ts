import { createEvolu, SimpleName } from "@evolu/common";
import { createUseEvolu } from "@evolu/react";
import { evoluReactWebDeps } from "@evolu/react-web";
import { Database } from "./schema";
import { SYNC_ENABLED_KEY } from "../constants";

export const EVOLU_RELAY_KEY = "flowblock_relay_url";
export const DEFAULT_RELAY_URL = "wss://free.evoluhq.com";

const storedRelay = localStorage.getItem(EVOLU_RELAY_KEY);
const relayUrl = storedRelay && (storedRelay.startsWith("wss://") || storedRelay.startsWith("ws://"))
  ? storedRelay
  : DEFAULT_RELAY_URL;

const syncEnabled = localStorage.getItem(SYNC_ENABLED_KEY) === "true";

export const evolu = createEvolu(evoluReactWebDeps)(Database, {
  name: SimpleName.orThrow("FlowBlock"),
  reloadUrl: import.meta.env.BASE_URL,
  transports: syncEnabled ? [{ type: "WebSocket", url: relayUrl }] : [],
});
export const useEvolu = createUseEvolu(evolu);
