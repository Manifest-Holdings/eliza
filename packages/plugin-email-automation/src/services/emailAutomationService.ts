import { Service, ServiceType, IAgentRuntime, elizaLogger, Memory, ModelClass, generateText, composeContext } from "@elizaos/core";
import { EmailService } from "./emailService";
import { EmailContext, EmailOptions, GeneratedEmailContent } from "../types";
import { shouldEmailTemplate } from "../templates/shouldEmail";
import { emailFormatTemplate } from "../templates/emailFormat";

export class EmailAutomationService extends Service {
    static get serviceType(): ServiceType {
        return ServiceType.EMAIL_AUTOMATION;
    }

    get serviceType(): ServiceType {
        return ServiceType.EMAIL_AUTOMATION;
    }

    private emailService!: EmailService;
    private runtime!: IAgentRuntime;

    constructor() {
        super();
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        this.runtime = runtime;
        elizaLogger.info("🔄 Initializing Email Automation Service...");

        // Check if enabled
        const isEnabled = runtime.getSetting('EMAIL_AUTOMATION_ENABLED')?.toLowerCase() === 'true' || false;
        elizaLogger.info(`📋 Email Automation Enabled: ${isEnabled}`);

        if (!isEnabled) {
            elizaLogger.info("❌ Email automation is disabled");
            return;
        }

        try {
            // Required settings
            const resendApiKey = runtime.getSetting('RESEND_API_KEY');
            const defaultToEmail = runtime.getSetting('DEFAULT_TO_EMAIL');
            const defaultFromEmail = runtime.getSetting('DEFAULT_FROM_EMAIL');

            elizaLogger.debug("🔑 Checking configuration:", {
                hasApiKey: !!resendApiKey,
                hasToEmail: !!defaultToEmail,
                hasFromEmail: !!defaultFromEmail
            });

            if (!resendApiKey || !defaultToEmail || !defaultFromEmail) {
                throw new Error('Missing required email configuration: RESEND_API_KEY, DEFAULT_TO_EMAIL, DEFAULT_FROM_EMAIL');
            }

            this.emailService = new EmailService({
                RESEND_API_KEY: resendApiKey,
                OWNER_EMAIL: defaultToEmail
            });

            elizaLogger.success(`✅ Service ${this.serviceType} initialized successfully`);
            elizaLogger.info("📧 Email service ready to process messages");
        } catch (error) {
            elizaLogger.error("❌ Failed to initialize email service:", error);
            // Don't rethrow - let the service gracefully handle missing config
        }
    }

    private async buildContext(memory: Memory): Promise<EmailContext> {
        elizaLogger.debug("🔄 Building email context for message:", {
            userId: memory.userId,
            messageId: memory.id,
            contentLength: memory.content.text.length
        });

        const state = await this.runtime.composeState(memory);

        // Include message content in state for template access
        if (state) {
            state.message = {
                content: memory.content,
                userId: memory.userId,
                id: memory.id
            };
        }

        return {
            memory,
            state,
            metadata: state?.metadata || {},
            timestamp: new Date(),
            conversationId: memory.id || ''
        };
    }

    async evaluateMessage(memory: Memory): Promise<boolean> {
        if (!this.emailService) {
            elizaLogger.error("❌ Email service not initialized");
            throw new Error('Missing required email configuration');
        }

        try {
            // Build context first
            const context = await this.buildContext(memory);
            elizaLogger.info("🔍 Evaluating accumulated conversation for email automation:", {
                text: memory.content.text,
                userId: memory.userId,
                roomId: memory.roomId
            });

            // Check if we should send an email
            const shouldEmail = await this.shouldSendEmail(context);

            if (shouldEmail) {
                elizaLogger.info("✨ Accumulated context triggered email automation, preparing to send...");
                await this.handleEmailTrigger(context);
                elizaLogger.success("✅ Email processed and sent successfully");
                return true;
            }

            elizaLogger.info("⏭️ Current context does not warrant email automation");
            return false;

        } catch (error) {
            elizaLogger.error("❌ Error evaluating message for email:", error);
            return false;
        }
    }

    private async shouldSendEmail(context: EmailContext): Promise<boolean> {
        elizaLogger.info("🤔 Evaluating if message should trigger email...");

        // Now TypeScript knows we're using the full State type
        elizaLogger.info("🔍 Full state debug:", {
            message: context.state.message?.content?.text || 'No message text',
            recentMessages: context.state.recentMessages || [],
            // agentName: context.state.agentName || 'Unknown',
            // bio: context.state.bio || '',
            // topics: context.state.topics || [],
            // rawState: context.state
        });

        const customPrompt = this.runtime.getSetting('EMAIL_EVALUATION_PROMPT');
        const template = customPrompt || shouldEmailTemplate;

        const composedContext = composeContext({
            state: context.state,  // Now properly typed as EmailState
            template
        });

        // Log the actual composed context
        elizaLogger.debug("📝 Template variables:", {
            messageText: context.memory?.content?.text || 'No message text',
            composedContextStart: composedContext.substring(0, 200)
        });

        const decision = await generateText({
            runtime: this.runtime,
            context: composedContext,
            modelClass: ModelClass.SMALL
        });

        elizaLogger.info("📝 Final composed prompt:", {
            prompt: composedContext
        });

        const shouldEmail = decision.includes("[EMAIL]");
        elizaLogger.info(`📊 Email decision: ${shouldEmail ? "✅ Should send" : "❌ Should not send"}`, {
            decision: decision.trim(),
            trigger: shouldEmail
        });

        return shouldEmail;
    }

    private async handleEmailTrigger(context: EmailContext) {
        try {
            // Extract name and contact info from the message text
            const messageLines = context.memory.content.text.split('\n');
            const nameMatch = messageLines.find(line => line.includes('Cooper Ribb'));
            const emailMatch = messageLines.find(line => line.includes('@'));
            const phoneMatch = messageLines.find(line => line.includes('512-'));
            const linkedinMatch = messageLines.find(line => line.includes('linkedin.com'));
            const githubMatch = messageLines.find(line => line.includes('github.com'));

            const userInfo = {
                id: context.memory.userId,
                displayName: nameMatch ? nameMatch.trim() : this.formatUserIdentifier(context.memory.userId),
                email: emailMatch ? emailMatch.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0] : '',
                phone: phoneMatch ? phoneMatch.match(/\d{3}-\d{3}-\d{4}/)?.[0] : '',
                linkedin: linkedinMatch ? linkedinMatch.match(/linkedin\.com\/[\w-]+/)?.[0] : '',
                github: githubMatch ? githubMatch.match(/github\.com\/[\w-]+/)?.[0] : '',
                platform: this.detectPlatform(context.memory.userId),
                metadata: context.metadata || {}
            };

            // Format contact info nicely
            const contactLines = [
                userInfo.displayName,
                [userInfo.email, userInfo.phone].filter(Boolean).join(' | '),
                [
                    userInfo.linkedin ? `LinkedIn: ${userInfo.linkedin}` : '',
                    userInfo.github ? `GitHub: ${userInfo.github}` : ''
                ].filter(Boolean).join(' | ')
            ].filter(Boolean);

            const messageText = context.memory.content.text;
            const enhancedContext = {
                ...context.state,
                message: messageText,
                userInfo,
                platform: userInfo.platform,
                userId: userInfo.id,
                senderName: userInfo.displayName,
                contactInfo: contactLines.join('\n'),
                previousMessages: messageText,
                bio: '',
                lore: ''
            };

            elizaLogger.info("🔍 Enhanced Context:", {
                enhancedContext,
                messageLength: messageText.length,
                userDetails: userInfo
            });

            const emailPrompt = composeContext({
                state: enhancedContext,
                template: emailFormatTemplate
            });

            elizaLogger.info("📧 Generated Email Prompt:", {
                fullPrompt: emailPrompt,
                template: emailFormatTemplate
            });

            // Generate content with enhanced context
            const formattedEmail = await generateText({
                runtime: this.runtime,
                context: emailPrompt,
                modelClass: ModelClass.SMALL
            });

            elizaLogger.info("📧 LLM Generated Email:", {
                formattedEmail: formattedEmail
            });

            // Parse and validate sections
            const sections = this.parseFormattedEmail(formattedEmail);

            // Add explicit validation with helpful errors
            if (!sections.background) {
                elizaLogger.error("Missing background section in generated email");
                throw new Error("Email generation failed: Missing background section");
            }

            if (!sections.keyPoints || sections.keyPoints.length === 0) {
                elizaLogger.error("Missing or empty key points in generated email");
                throw new Error("Email generation failed: No key points generated");
            }

            // Create email content with ALL sections
            const emailContent: GeneratedEmailContent = {
                subject: sections.subject,
                blocks: [
                    // Replace the old contact block with our formatted version
                    {
                        type: 'paragraph',
                        content: enhancedContext.contactInfo,  // This uses our nicely formatted contactLines
                        metadata: {
                            style: 'margin-bottom: 1.5em; font-family: monospace; white-space: pre;'
                        }
                    },
                    {
                        type: 'paragraph',
                        content: sections.background,
                        metadata: {
                            style: 'margin-bottom: 1.5em;'
                        }
                    },
                    {
                        type: 'heading',
                        content: 'Key Points'
                    },
                    {
                        type: 'bulletList',
                        content: sections.keyPoints
                    },
                    // Add Technical Details section
                    {
                        type: 'heading',
                        content: 'Technical Details'
                    },
                    {
                        type: 'bulletList',
                        content: sections.technicalDetails || []
                    },
                    // Add Next Steps section
                    {
                        type: 'heading',
                        content: 'Next Steps'
                    },
                    {
                        type: 'bulletList',
                        content: sections.nextSteps || []
                    }
                ],
                metadata: {
                    tone: 'professional',
                    intent: 'connection_request',
                    priority: 'high'
                }
            };

            elizaLogger.info("📋 Email content prepared:", {
                subject: emailContent.subject,
                blocksCount: emailContent.blocks.length,
                sections: {
                    hasBackground: !!sections.background,
                    keyPointsCount: sections.keyPoints.length,
                    technicalDetailsCount: sections.technicalDetails?.length,
                    nextStepsCount: sections.nextSteps?.length
                }
            });

            const emailOptions = {
                to: this.runtime.getSetting('DEFAULT_TO_EMAIL') || '',
                from: this.runtime.getSetting('DEFAULT_FROM_EMAIL') || '',
                headers: {
                    'X-Conversation-ID': context.conversationId,
                    'X-User-ID': userInfo.id,
                    'X-Platform': userInfo.platform,
                    'X-Display-Name': userInfo.displayName
                }
            };

            elizaLogger.info("📤 Composing email...", {
                to: emailOptions.to,
                from: emailOptions.from,
                conversationId: context.conversationId
            });

            await this.emailService.sendEmail(emailContent, emailOptions);
        } catch (error) {
            elizaLogger.error("❌ Email generation failed:", { error, context });
            throw error;
        }
    }

    private parseFormattedEmail(formattedEmail: string): {
        subject: string;
        applicant?: string;
        contact?: string;
        platform?: string;
        background: string;
        keyPoints: string[];
        technicalDetails?: string[];
        nextSteps: string[];
    } {
        const sections: any = {};

        // Extract subject
        const subjectMatch = formattedEmail.match(/Subject:\s*(.+?)(?=\n|$)/i);
        sections.subject = subjectMatch?.[1]?.trim() || '';

        // Extract applicant info
        const applicantMatch = formattedEmail.match(/Applicant:\s*(.+?)(?=\n|Contact:|$)/i);
        sections.applicant = applicantMatch?.[1]?.trim();

        // Extract contact info
        const contactMatch = formattedEmail.match(/Contact:\s*(.+?)(?=\n|Platform:|Background:|$)/i);
        sections.contact = contactMatch?.[1]?.trim();

        // Extract platform info
        const platformMatch = formattedEmail.match(/Platform:\s*(.+?)(?=\n|Background:|$)/i);
        sections.platform = platformMatch?.[1]?.trim();

        // Extract background
        const backgroundMatch = formattedEmail.match(/Background:\s*([\s\S]*?)(?=\n\n|Key Points:|$)/i);
        sections.background = backgroundMatch?.[1]?.trim() || '';

        // Extract key points
        const keyPointsMatch = formattedEmail.match(/Key Points:\n([\s\S]*?)(?=\n\n|Technical Details:|Next Steps:|$)/);
        sections.keyPoints = keyPointsMatch?.[1]
            ?.split('\n')
            .map(point => point.trim())
            .filter(point => point.startsWith('•'))
            .map(point => point.replace('•', '').trim()) || [];

        // Extract technical details
        const technicalDetailsMatch = formattedEmail.match(/Technical Details:\n([\s\S]*?)(?=\n\n|Next Steps:|$)/);
        sections.technicalDetails = technicalDetailsMatch?.[1]
            ?.split('\n')
            .map(point => point.trim())
            .filter(point => point.startsWith('•'))
            .map(point => point.replace('•', '').trim()) || [];

        // Extract next steps
        const nextStepsMatch = formattedEmail.match(/Next Steps:\n([\s\S]*?)(?=\n\n|$)/);
        sections.nextSteps = nextStepsMatch?.[1]
            ?.split('\n')
            .map(point => point.trim())
            .filter(point => point.startsWith('•') || /^\d+\./.test(point))  // Check for bullets or numbers
            .map(point => point.replace(/^(\d+\.|•)/, '').trim()) || [];

        return sections;
    }

    private formatUserIdentifier(userId: string): string {
        // If userId is a Discord ID (typically a large number)
        if (/^\d{17,19}$/.test(userId)) {
            return `Discord User ${userId}`;
        }
        // For email addresses
        if (userId.includes('@')) {
            return userId;
        }
        // Default format
        return `User ${userId}`;
    }

    private detectPlatform(userId: string): string {
        // Discord IDs are typically 17-19 digit numbers
        if (/^\d{17,19}$/.test(userId)) {
            return 'discord';
        }
        // Email format
        if (userId.includes('@')) {
            return 'email';
        }
        // Default platform
        return 'unknown';
    }
}