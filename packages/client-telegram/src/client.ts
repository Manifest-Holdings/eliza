import {
    elizaLogger,
    type Plugin,
} from "@elizaos/core";
import type { Client, IAgentRuntime } from "@elizaos/core";
import { TelegramClient } from "./telegramClient.ts";
import { validateTelegramConfig } from "./environment.ts";

export const TelegramClientInterface: Client = {
    name: 'telegram',
    start: async (runtime: IAgentRuntime) => {
        await validateTelegramConfig(runtime);

        const tg = new TelegramClient(
            runtime,
            runtime.getSetting("TELEGRAM_BOT_TOKEN")
        );

        await tg.start();

        elizaLogger.success(
            `✅ Telegram client successfully started for character ${runtime.character.name}`
        );
        return tg;
    },
    validate: async (token) => {
      try {
        console.log('telegram token', token, `https://api.telegram.org/bot${token}/getMe`)
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        if (!response.ok) {
            elizaLogger.error('Invalid telegram token1:', response.statusText);
            return { success: false, message: response.statusText };
        }
        const data = await response.json();
        elizaLogger.log('data', data)
        if (data["ok"]) {
            return { success: true, message: '' };
        } else {
            elizaLogger.error('Invalid telegram token2:', data["description"]);
            return { success: false, message: data["description"] };
        }
      } catch (error) {
          // maybe don't log error.message as it may have secret in it
          elizaLogger.error('Error verifying telegram token:', error.message);
          return { success: false, message: error.message };
      }
    },
};