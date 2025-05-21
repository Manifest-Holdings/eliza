import { postgresAdapter } from "./client";

const postgresPlugin = {
    name: "postgres",
    description: "PostgreSQL database adapter plugin",
    adapters: [postgresAdapter],
};
export default postgresPlugin;

/*
export const postgresAdapter: Adapter = {
    init: (runtime: IAgentRuntime) => {
        const POSTGRES_URL = runtime.getSetting("POSTGRES_URL");
        if (POSTGRES_URL) {
            elizaLogger.info("Initializing PostgreSQL connection...");
            const db = new PostgresDatabaseAdapter({
                connectionString: POSTGRES_URL,
                parseInputs: true,
            });

            // Test the connection
            db.init()
                .then(() => {
                    elizaLogger.success(
                        "Successfully connected to PostgreSQL database"
                    );
                })
                .catch((error) => {
                    elizaLogger.error("Failed to connect to PostgreSQL:", error);
                });

            return db;
        } else {
            throw new Error("POSTGRES_URL is not set");
        }
    },
};
*/
