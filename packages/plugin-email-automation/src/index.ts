import type { Plugin } from "@elizaos/core";
import { EmailAutomationService } from "./services/emailAutomationService";
import { emailEvaluator } from "./evaluators/emailEvaluator";

export const emailAutomationPlugin: Plugin = {
    name: "email-automation",
    description: "AI-powered email automation plugin for Eliza",
    services: [new EmailAutomationService()],
    clients: [],
    evaluators: [emailEvaluator],
    providers: [],
};

export default emailAutomationPlugin;
