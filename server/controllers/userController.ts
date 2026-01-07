import { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import openai from '../configs/openai.js';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// 1. Get User Credits
export const getUserCredits = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId }
        })

        res.json({ credits: user?.credits })
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
}

// 2. Create User Project
export const createUserProject = async (req: Request, res: Response) => {
    const userId = req.userId;
    try {
        const { initial_prompt } = req.body;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } })

        if (user && user.credits < 5) {
            return res.status(403).json({ message: 'Add credits to create more projects' })
        }

        const project = await prisma.websiteProject.create({
            data: {
                name: initial_prompt.length > 50 ? initial_prompt.substring(0, 47) + '...' : initial_prompt,
                initial_prompt,
                userId
            }
        })

        await prisma.user.update({
            where: { id: userId },
            data: { totalCreation: { increment: 1 } }
        })

        await prisma.conversation.create({
            data: {
                role: 'user',
                content: initial_prompt,
                projectId: project.id
            }
        })

        // Deduct credits
        await prisma.user.update({
            where: { id: userId },
            data: { credits: { decrement: 5 } }
        })

        res.json({ projectId: project.id })

        // --- AI GENERATION LOGIC (Enhance + Generate Code) ---
        // (Keeping your existing AI logic here for brevity)
        const promptEnhanceResponse = await openai.chat.completions.create({
            model: "kwaipilot/kat-coder-pro:free",
            messages: [
                { role: 'system', content: `You are a prompt enhancement specialist...` },
                { role: 'user', content: initial_prompt }
            ]
        })
        const enhancedPrompt = promptEnhanceResponse.choices[0].message.content;

        await prisma.conversation.create({
            data: { role: 'assistant', content: `I've enhanced your prompt to: "${enhancedPrompt}"`, projectId: project.id },
        })
        
        // ... (Rest of your AI generation logic remains exactly as you had it) ...

    } catch (error: any) {
        // Refund credits on failure
        await prisma.user.update({
            where: { id: userId },
            data: { credits: { increment: 5 } }
        })
        console.log(error.code);
        res.status(500).json({ message: error.message });
    }
}

// 3. Get Single Project
export const getUserProject = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const { projectId } = req.params;

        const project = await prisma.websiteProject.findUnique({
            where: { id: projectId, userId },
            include: {
                conversation: { orderBy: { timestamp: 'asc' } },
                versions: { orderBy: { timestamp: 'asc' } }
            }
        })

        res.json({ project })
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
}

// 4. Get All Projects
export const getUserProjects = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const projects = await prisma.websiteProject.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' }
        })
        res.json({ projects })
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
}

// 5. Toggle Publish
export const togglePublish = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const { projectId } = req.params;
        const project = await prisma.websiteProject.findUnique({ where: { id: projectId, userId } })

        if (!project) return res.status(404).json({ message: 'Project not found' })

        await prisma.websiteProject.update({
            where: { id: projectId },
            data: { isPublished: !project.isPublished }
        })

        res.json({ message: project.isPublished ? 'Project Unpublished' : 'Project Published Successfully' })
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
}

// 6. Create Checkout Session
export const createCheckoutSession = async (req: Request, res: Response) => {
    try {
        interface Plan { credits: number; amount: number; }
        const plans = {
            basic: { credits: 100, amount: 5 },
            pro: { credits: 400, amount: 19 },
            enterprise: { credits: 1000, amount: 19 },
        }

        const userId = req.userId;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const { planId } = req.body as { planId: keyof typeof plans }
        const origin = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173';
        const plan: Plan = plans[planId]

        if (!plan) return res.status(404).json({ message: 'Plan not found' })

        const transaction = await prisma.transaction.create({
            data: {
                userId: userId,
                planId: req.body.planId,
                amount: plan.amount,
                credits: plan.credits,
                status: 'PENDING' // Ensure your DB schema has a default, or set it here
            }
        })

        const session = await stripe.checkout.sessions.create({
            success_url: `${origin}/loading?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/pricing`,
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: { name: `AiSiteBuilder - ${plan.credits} credits` },
                        unit_amount: Math.floor(transaction.amount * 100)
                    },
                    quantity: 1
                },
            ],
            mode: 'payment',
            metadata: { transactionId: transaction.id, userId: userId, appId: 'ai-site-builder' },
            expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        });

        res.json({ payment_link: session.url })
    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
}


export const verifyPayment = async (req: Request, res: Response) => {
    console.log("verify payment route hit!");
    try {
        const { sessionId } = req.body;
        
        // 1. Verify the session with Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            const transactionId = session.metadata?.transactionId;

            if (!transactionId) {
                 return res.status(400).json({ message: 'No transaction ID found' });
            }

            // 2. Find the transaction in your DB
            const transaction = await prisma.transaction.findUnique({
                where: { id: transactionId }
            });

            if (!transaction) {
                return res.status(404).json({ message: 'Transaction not found' });
            }

            // 3. Prevent double-crediting (Check if already processed)
            if (transaction.status === 'COMPLETED') {
                return res.json({ message: 'Credits already added' });
            }

            // 4. Update Transaction Status and Add Credits to User
            await prisma.$transaction([
                prisma.transaction.update({
                    where: { id: transactionId },
                    data: { status: 'COMPLETED' }
                }),
                prisma.user.update({
                    where: { id: transaction.userId },
                    data: { credits: { increment: transaction.credits } }
                })
            ]);

            return res.json({ message: 'Payment verified and credits added' });
        } else {
            return res.status(400).json({ message: 'Payment not successful' });
        }

    } catch (error: any) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};