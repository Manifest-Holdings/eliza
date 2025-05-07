import { EmailAutomationService } from "./services/emailAutomationService";
import { emailEvaluator } from "./evaluators/emailEvaluator";

const emailAutomationPlugin = {
    name: "email-automation",
    description: "AI-powered email automation plugin for Eliza",
    services: [new EmailAutomationService() as any],
    clients: [],
    evaluators: [emailEvaluator],
    providers: [],
};

export default emailAutomationPlugin;
