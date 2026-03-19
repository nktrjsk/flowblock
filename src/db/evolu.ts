import { createEvolu, SimpleName } from "@evolu/common";
import { createUseEvolu } from "@evolu/react";
import { evoluReactWebDeps } from "@evolu/react-web";
import { Database } from "./schema";

export const EVOLU_RELAY_KEY = "flowblock_relay_url";
export const DEFAULT_RELAY_URL = "wss://free.evoluhq.com";

const storedRelay = localStorage.getItem(EVOLU_RELAY_KEY);
const relayUrl = storedRelay && (storedRelay.startsWith("wss://") || storedRelay.startsWith("ws://"))
  ? storedRelay
  : DEFAULT_RELAY_URL;

export const evolu = createEvolu(evoluReactWebDeps)(Database, {
  name: SimpleName.orThrow("FlowBlock"),
  transports: [{ type: "WebSocket", url: relayUrl }],
});
export const useEvolu = createUseEvolu(evolu);
