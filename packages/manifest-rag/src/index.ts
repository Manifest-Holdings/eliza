import type { Plugin } from "@elizaos/core-plugin-v1";
import { ragProvider } from "./providers/rag.ts";

export const manifestRagPlugin: Plugin = {
    name: "manifest rag",
    description: "Making agents smarter",
    actions: [],
    evaluators: [],
    providers: [ragProvider],
};
export default manifestRagPlugin;