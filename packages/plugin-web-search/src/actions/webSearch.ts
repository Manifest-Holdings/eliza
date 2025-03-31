import {
    type Action,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger
} from "@elizaos/core";
import { encodingForModel, type TiktokenModel } from "js-tiktoken";
import { WebSearchService } from "../services/webSearchService";
import type { SearchResult } from "../types";

const DEFAULT_MAX_WEB_SEARCH_TOKENS = 4000;
const DEFAULT_MODEL_ENCODING = "gpt-3.5-turbo";

function getTotalTokensFromString(
    str: string,
    encodingName: TiktokenModel = DEFAULT_MODEL_ENCODING
) {
    const encoding = encodingForModel(encodingName);
    return encoding.encode(str).length;
}

function MaxTokens(
    data: string,
    maxTokens: number = DEFAULT_MAX_WEB_SEARCH_TOKENS
): string {
    if (getTotalTokensFromString(data) >= maxTokens) {
        return data.slice(0, maxTokens);
    }
    return data;
}

export const webSearch: Action = {
    name: "WEB_SEARCH",
    similes: [
        "SEARCH_WEB",
        "INTERNET_SEARCH",
        "LOOKUP",
        "QUERY_WEB",
        "FIND_ONLINE",
        "SEARCH_ENGINE",
        "WEB_LOOKUP",
        "ONLINE_SEARCH",
        "FIND_INFORMATION",
    ],
    suppressInitialMessage: true,
    description:
        "Perform a web search to find information related to the message.",
    // eslint-disable-next-line
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const tavilyApiKeyOk = !!runtime.getSetting("TAVILY_API_KEY");

        return tavilyApiKeyOk;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ) => {
        elizaLogger.log("Composing state for message:", message);
        
        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const webSearchPrompt = message.content.text;
        elizaLogger.log("web search prompt received:", webSearchPrompt);

        const webSearchService = new WebSearchService();
        await webSearchService.initialize(runtime);
        const searchResponse = await webSearchService.search(
            webSearchPrompt,
        );

        if (searchResponse && searchResponse.results.length) {
            // Format results into a searchable context
            const searchContext = [
                searchResponse.answer,
                ...searchResponse.results.map(result => `${result.title}\n${result.content}`)
            ].filter(Boolean).join('\n\n');
            
            // Update state with search results
            state = await runtime.composeState(message, {
                ...state,
                searchContext: searchContext,
                searchMetadata: {
                    query: webSearchPrompt,
                    timestamp: new Date().toISOString(),
                    resultCount: searchResponse.results.length
                }
            });

            // Format a user-friendly response
            const formattedResults = searchResponse.results
                .map((result, i) => `${i + 1}. [${result.title}](${result.url})`)
                .join('\n');

            callback({
                text: searchResponse.answer 
                    ? `${searchResponse.answer}\n\nRelevant sources:\n\n${formattedResults}`
                    : `Found ${searchResponse.results.length} relevant results:\n\n${formattedResults}`,
                metadata: {
                    count: searchResponse.results.length,
                    results: searchResponse.results,
                    query: webSearchPrompt,
                    context: searchContext
                }
            });
        } else {
            elizaLogger.error("search failed or returned no data.");
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Find the latest news about SpaceX launches.",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here is the latest news about SpaceX launches:",
                    action: "WEB_SEARCH",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you find details about the iPhone 16 release?",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here are the details I found about the iPhone 16 release:",
                    action: "WEB_SEARCH",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What is the schedule for the next FIFA World Cup?",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here is the schedule for the next FIFA World Cup:",
                    action: "WEB_SEARCH",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Check the latest stock price of Tesla." },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here is the latest stock price of Tesla I found:",
                    action: "WEB_SEARCH",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What are the current trending movies in the US?",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here are the current trending movies in the US:",
                    action: "WEB_SEARCH",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What is the latest score in the NBA finals?",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here is the latest score from the NBA finals:",
                    action: "WEB_SEARCH",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "When is the next Apple keynote event?" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here is the information about the next Apple keynote event:",
                    action: "WEB_SEARCH",
                },
            },
        ],
    ],
} as Action;