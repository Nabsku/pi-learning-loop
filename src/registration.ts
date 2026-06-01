import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerLearningCommand } from "./commands.ts";
import { registerLearningTools } from "./tools.ts";
import { initConfig } from "./config-file.ts";

export function registerLearningLoop(pi: ExtensionAPI) {
  pi.on("resources_discover", (event, ctx) => {
    initConfig(event.cwd || ctx.cwd);
  });
  registerLearningCommand(pi);
  registerLearningTools(pi);
}
