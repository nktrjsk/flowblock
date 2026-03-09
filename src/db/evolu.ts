import { createEvolu, SimpleName } from "@evolu/common";
import { createUseEvolu } from "@evolu/react";
import { evoluReactWebDeps } from "@evolu/react-web";
import { Database } from "./schema";

export const evolu = createEvolu(evoluReactWebDeps)(Database, {
  name: SimpleName.orThrow("FlowBlock"),
});
export const useEvolu = createUseEvolu(evolu);
