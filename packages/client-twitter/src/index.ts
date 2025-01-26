import { Client, elizaLogger, IAgentRuntime } from "@elizaos/core";
import { ClientBase, getScrapper } from "./base.ts";
import { validateTwitterConfig, TwitterConfig } from "./environment.ts";
import { TwitterInteractionClient } from "./interactions.ts";
import { TwitterPostClient } from "./post.ts";
import { TwitterSearchClient } from "./search.ts";
import { TwitterSpaceClient } from "./spaces.ts";

/**
 * A manager that orchestrates all specialized Twitter logic:
 * - client: base operations (login, timeline caching, etc.)
 * - post: autonomous posting logic
 * - search: searching tweets / replying logic
 * - interaction: handling mentions, replies
 * - space: launching and managing Twitter Spaces (optional)
 */
class TwitterManager {
    client: ClientBase;
    post: TwitterPostClient;
    search: TwitterSearchClient;
    interaction: TwitterInteractionClient;
    space?: TwitterSpaceClient;

    constructor(runtime: IAgentRuntime, twitterConfig: TwitterConfig) {
        // Pass twitterConfig to the base client
        this.client = new ClientBase(runtime, twitterConfig);

        // Posting logic
        this.post = new TwitterPostClient(this.client, runtime);

        // Optional search logic (enabled if TWITTER_SEARCH_ENABLE is true)
        if (twitterConfig.TWITTER_SEARCH_ENABLE) {
            elizaLogger.warn("Twitter/X client running in a mode that:");
            elizaLogger.warn("1. violates consent of random users");
            elizaLogger.warn("2. burns your rate limit");
            elizaLogger.warn("3. can get your account banned");
            elizaLogger.warn("use at your own risk");
            this.search = new TwitterSearchClient(this.client, runtime);
        }

        // Mentions and interactions
        this.interaction = new TwitterInteractionClient(this.client, runtime);

        // Optional Spaces logic (enabled if TWITTER_SPACES_ENABLE is true)
        if (twitterConfig.TWITTER_SPACES_ENABLE) {
            this.space = new TwitterSpaceClient(this.client, runtime);
        }
    }
    async stop() {
      if (this.client.twitterClient) {
          await this.post.stop();
          await this.interaction.stop();
          if (this.search) {
              await this.search.stop();
          }
      } else {
          // it's still starting up
      }
    }
}

export const TwitterClientInterface: Client = {
    runtime: false,
    async start(runtime: IAgentRuntime) {
        let twitterConfig: TwitterConfig
        try {
            twitterConfig = await validateTwitterConfig(runtime);
        } catch(e) {
            elizaLogger.error("TwitterConfig validation failed for",
              runtime.getSetting("TWITTER_USERNAME") || process.env.TWITTER_USERNAME,
              "email",
              runtime.getSetting("TWITTER_EMAIL") || process.env.TWITTER_EMAIL,
            );
            return;
        }

        elizaLogger.log("Twitter client started");

        const manager = new TwitterManager(runtime, twitterConfig);

        async function checkStart() {
            if (manager.client.twitterClient) {
                // Initialize login/session
                await manager.client.init();

                // Start the posting loop
                await manager.post.start();

                // Start the search logic if it exists
                if (manager.search) {
                    await manager.search.start();
                }

                // Start interactions (mentions, replies)
                await manager.interaction.start();

                // If Spaces are enabled, start the periodic check
                if (manager.space) {
                    manager.space.startPeriodicSpaceCheck();
                }
            } else {
              setTimeout(checkStart, 1000)
            }
        }
        // not waiting until they're started
        checkStart()

        return manager;
    },
    validate: async (secrets) => {
        try {
            const twClient = await getScrapper(secrets.username);
            // try logging in
            await twClient.login(
                secrets.username,
                secrets.password,
                secrets.email,
                secrets.twitter2faSecret
            );
            const success = await twClient.isLoggedIn()
            if (success) {
                // fresh login, store new cookies
                if (TwitterClientInterface.runtime !== undefined) {
                    elizaLogger.info("Validation: successfully logged in, caching cookies");
                    await TwitterClientInterface.runtime?.cacheManager.set(
                        `twitter/${secrets.username}/cookies`,
                        await twClient.getCookies()
                    );
                }
            }

            return success
        } catch (error) {
            console.error(error)
            elizaLogger.error('Error validating twitter login for twitter', secrets.username, error);
            return false;
        }
    },
    async stop(runtime: IAgentRuntime) {
        elizaLogger.log(`Twitter client stop for ${runtime.character.name} (${runtime.agentId})`);

        // get manager
        const manager = runtime.clients.twitter

        // stop post/search/interaction
        if (manager) {
            if (manager.client.twitterClient) {
                await manager.post.stop();
                await manager.interaction.stop();
                if (manager.search) {
                    await manager.search.stop();
                }
            } else {
                // it's still starting up
            }
        } // already stoped
    },
};

export default TwitterClientInterface;
