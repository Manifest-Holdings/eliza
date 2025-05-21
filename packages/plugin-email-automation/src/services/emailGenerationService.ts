import { elizaLogger, IAgentRuntime, generateObject, ModelClass } from "@elizaos/core";
import type { EmailBlock, GeneratedEmailContent, EmailGenerationOptions } from "../types";
import { EmailGenerationSchema, EmailPromptSchema } from "../schemas/emailGenerationSchema";

export class EmailGenerationService {
    constructor(private runtime: IAgentRuntime) {
        if (!runtime) throw new Error('Runtime not configured');
    }

    async generateEmail(options: EmailGenerationOptions): Promise<GeneratedEmailContent> {
        try {
            elizaLogger.debug("Starting email generation with options:", options);

            const validatedOptions = EmailPromptSchema.parse(options);
            elizaLogger.debug("Options validated successfully");

            elizaLogger.debug("Generating email content via AI...");
            const { object } = await generateObject({
                runtime: this.runtime,
                context: validatedOptions.content,
                modelClass: ModelClass.LARGE,
                schema: EmailGenerationSchema,
                schemaName: 'generateEmail',
                schemaDescription: "Generate a structured email"
            });
            elizaLogger.debug("AI generation complete:", object);

            if (!object) throw new Error('Invalid response: missing object');

            const emailContent = EmailGenerationSchema.parse(object);
            elizaLogger.debug("Generated content validated successfully");

            const blocks: EmailBlock[] = emailContent.parameters.blocks.map(block => ({
                //...block,
                type: block.type,
                content: block.content,
                metadata: {
                    // emailblock metadata is different
                    //...block.metadata,
                    style: block.metadata.style,
                    className: block.metadata.className,
                    importance: block.metadata.importance,
                }
            }));

            return {
                subject: emailContent.parameters.subject,
                blocks: blocks,
                metadata: {
                  //emailContent.parameters.metadata
                  tone:     emailContent.parameters.metadata.tone,
                  intent:   emailContent.parameters.metadata.intent,
                  priority: emailContent.parameters.metadata.priority,
                  language: emailContent.parameters.metadata.language,
                }
            };

        } catch (error) {
            elizaLogger.error("Email generation failed:", {
                error,
                errorMessage: error instanceof Error ? error.message : String(error),
                options
            });
            throw error;
        }
    }
}