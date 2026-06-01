import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerLearningCommand } from "./commands.ts";
import { registerLearningTools } from "./tools.ts";

export function registerLearningLoop(pi: ExtensionAPI) {
  registerLearningCommand(pi);
  registerLearningTools(pi);
}
