import { webSearch } from "./actions/webSearch";
import { WebSearchService } from "./services/webSearchService";

export const webSearchPlugin = {
    name: "webSearch",
    description: "Search the web and get news",
    actions: [webSearch],
    evaluators: [],
    providers: [],
    services: [new WebSearchService() as any],
    clients: [],
    adapters: [],
};

export default webSearchPlugin;
