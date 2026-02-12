import {Request, Response} from 'express';
import prisma from '../lib/prisma.js';
import openai from '../configs/openai.js';

//controller function to make revision 
export const makeRevision = async (req:Request, res: Response ) => {
    const userId = req.userId;
    try {
        
        const {projectId} = req.params;
        const {message} = req.body;

         const user = await prisma.user.findUnique({
            where: {id: userId}
        })

        if(!userId || !user){
            return res.status(401).json({ message: 'unauthorized '});
        }

        if(user.credits < 2){
            return res.status(403).json({ message: 'add more credits to make changes'});
        }

        if(!message || message.trim() === ''){
             if(user.credits < 5)
            return res.status(400).json({ message: 'Please enter a valid prompt'});
        }

        const currentProject = await prisma.websiteProject.findUnique({
            where: {id: projectId, userId},
            include: {versions: true}
        })

        if(!currentProject){
            return res.status(404).json({ message: 'Project not found' });
        }

        await prisma.conversation.create({
            data: {
                role: 'user',
                content: message,
                projectId
            }
        })

        await prisma.user.update({
            where: {id: userId},
            data: {credits: {decrement: 5}}
        })

        //Enhance user prompt
        const promptEnhanceResponse = await openai.chat.completions.create({
            model: "kwaipilot/kat-coder-pro",
            messages:[
                {
                    role: 'system',
                    content: `You are a prompt enhancement specialist. The user wants to make changes to their website. Enhance their request to be more specific and actionable for a web developer.

    Enhance this by:
    1. Being specific about what elements to change
    2. Mentioning design details (colors, spacing, sizes)
    3. Clarifying the desired outcome
    4. Using clear technical terms

Return ONLY the enhanced request, nothing else. Keep it concise (1-2 sentences).`
                },
                {
                    role: 'user',
                    content: `User's request: "${message}"`
                }
            ]
        })

        const enhancePrompt = promptEnhanceResponse.choices[0].message.content;

        await prisma.conversation.create({
            data: {
                role: 'assistant',
                content: `I've enhanced your prompt to: "${enhancePrompt}"`,
                projectId
            }
        })
       
        await prisma.conversation.create({
            data: {
                role: 'assistant',
                content: 'Now making changes to your website...',
                projectId
            }
        })

        // Generate website code
        const codeGenerationResponse = await openai.chat.completions.create({
            model: "kwaipilot/kat-coder-pro",
            messages: [
                {
                    role: 'system',
                    content:`You are an expert web developer. 

    CRITICAL REQUIREMENTS:
    - Return ONLY the complete updated HTML code with the requested changes.
    - Use Tailwind CSS for ALL styling (NO custom CSS).
    - Use Tailwind utility classes for all styling changes.
    - Include all JavaScript in <script> tags before closing </body>
    - Make sure it's a complete, standalone HTML document with Tailwind CSS
    - Return the HTML Code Only, nothing else

    Apply the requested changes while maintaining the Tailwind CSS styling approach.`
                },
                {
                    role: 'user',
                    content: `Here is the current website code: "${currentProject.current_code}
                     The user wants this change: "${enhancePrompt}"`
                }
            ]
        })

        const code = codeGenerationResponse.choices[0].message.content || '';

        if(!code){
             await prisma.conversation.create({
            data:{
                role: 'assistant',
                content: "i've made the changes to your website! you can now preview it",
                projectId
            }
        })
         await prisma.user.update({
            where: {id: userId},
            data: {credits: {increment: 5}}
        })
        return;
        }

        const version = await prisma.version.create({
            data: {
                code: code.replace(/```[a-z]*\n?/gi,'')
                .replace(/```$/g,'')
                .trim(),
                description: 'changes made',
                projectId
            }
        })

        await prisma.conversation.create({
            data:{
                role: 'assistant',
                content: "i've made the changes to your website! you can now preview it",
                projectId
            }
        })

        await prisma.websiteProject.update({
            where: {id: projectId},
            data: {
                current_code: code.replace(/```[a-z]*\n?/gi,'')
                .replace(/```$/g,'')
                .trim(),
                current_version_index: version.id
            }
        })

        res.json({message: 'Changes made successfully'})
    } catch (error : any) {
        await prisma.user.update({
            where: {id: userId},
            data: {credits: {increment: 5}}
        })

        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
}

// Controller Function to rollback to a specific version
export const rollbackToVersion = async (req:Request, res: Response ) => {
    try {
        const userId = req.userId;
        if(!userId){
            return res.status(401).json({ message: 'unauthorized' })
        }
        const { projectId, versionId } = req.params;

        const project = await prisma.websiteProject.findUnique({
            where: {id: projectId, userId},
            include: {versions: true}
        })

        if (!project){
             return res.status(404).json({ message: 'Project not found' })
        }

        const version = project.versions.find((version)=>version.id === versionId);

        if(!version){
             return res.status(404).json({ message: 'Version not found' })
        }

        await prisma.websiteProject.update({
            where: {id: projectId, userId},
            data: {
                current_code: version.code,
                current_version_index: version.id
            }
        })

        await prisma.conversation.create({
            data: {
                role: 'assistant',
                content: "I've rolled back your website to selected version. You can now preview it",
                projectId
            }
        })

        res.json({ message: "Version rolled back"})
    } catch (error : any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
}

//Create Project

// Replace your existing createProject function with this:

export const createProject = async (req: Request, res: Response) => {
    try {
        // 1. Get the correct input variable
        const { initial_prompt } = req.body; 
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // 2. Check User Credits
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });
        
        if (user.credits < 5) {
            return res.status(403).json({ message: 'Not enough credits (need 5)' });
        }

        console.log("Generating project for:", initial_prompt);

        // 3. Generate the Website Code using AI
        const response = await openai.chat.completions.create({
            model: "kwaipilot/kat-coder-pro",
            messages: [
                {
                    role: 'system',
                    content: `You are an expert web developer. 
                    Return ONLY a complete, single-file HTML document.
                    Use Tailwind CSS for styling.
                    Include all JavaScript inside <script> tags.
                    Do not include markdown formatting (like \`\`\`html).`
                },
                {
                    role: 'user',
                    content: `Create a website based on this request: ${initial_prompt}`
                }
            ]
        });

        const generatedCode = response.choices[0].message.content || "";
        
        // Clean up the code (remove markdown code blocks if present)
        const cleanCode = generatedCode.replace(/```html/g, '').replace(/```/g, '').trim();

        // 4. Save Project to Database
        // We set current_version_index to "" temporarily because we don't have the Version ID yet
        const project = await prisma.websiteProject.create({
            data: {
                userId: userId,
                current_code: cleanCode,
                isPublished: false,
                current_version_index: "", // ✅ Fixes the red line
                name: initial_prompt,
                initial_prompt: initial_prompt,
                versions: {
                    create: {
                        code: cleanCode,
                        description: "Initial Generation"
                    }
                }
            }
        });

        // 5. Link the Project to the Version we just created
        // We find the version associated with this project to get its real ID
        const firstVersion = await prisma.version.findFirst({
            where: { projectId: project.id }
        });

        if (firstVersion) {
            await prisma.websiteProject.update({
                where: { id: project.id },
                data: { current_version_index: firstVersion.id }
            });
        }

        // 6. Deduct Credits
        await prisma.user.update({
            where: { id: userId },
            data: { credits: { decrement: 5 } }
        });

        // 7. Send Response
        res.json({ projectId: project.id, message: "Project created successfully!" });

    } catch (error: any) {
        console.error("Error creating project:", error);
        res.status(500).json({ message: error.message || "Server Error" });
    }
};

//Controller Function to Delete a Project
export const deleteProject = async (req:Request, res: Response ) => {
    try {
        const userId = req.userId;
        const { projectId } = req.params;
       

         await prisma.websiteProject.delete({
            where: {id: projectId, userId},
        })

        res.json({ message: "Project deleted successfully"})
    } catch (error : any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
}

//Controller for getting project code for preview
export const getProjectPreview = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { projectId } = req.params;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const project = await prisma.websiteProject.findFirst({
            where: { id: projectId, userId }, // Ensures only the owner can see it
            include: { versions: true }
        });
         
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        res.json({ project }); 

    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
};

export const getPublishedProjects = async (req: Request, res: Response) => {
    try {
        const projects = await prisma.websiteProject.findMany({
            where: { 
                isPublished: true 
            },
            orderBy: { 
                updatedAt: 'desc' // Show newest first
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        res.json({ projects });
    } catch (error: any) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};

// Get a single project by id
export const getProjectById = async (req:Request, res: Response ) => {
    try {
        const { projectId } = req.params;

        const project = await prisma.websiteProject.findFirst({
            where: {id: projectId},
        })

        if(!project || project.isPublished === false || !project?.current_code){
            return res.status(404).json({ message: 'Project not found'});
        }
        
        res.json({ code: project.current_code  });
    } catch (error : any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
}

//Controller to save project code
export const saveProjectCode = async (req:Request, res: Response ) => {
    try {
        const userId = req.userId;
        const { projectId } = req.params;
        const {code} = req.body;

        if(!userId){
            return res.status(401).json({ message: 'unauthoruzed'})
        }

        if(!code){
            return res.status(400).json({ message: 'code is required'});
        }
        const project = await prisma.websiteProject.findUnique({
            where: {id: projectId, userId}
        })

        if(!project){
            return res.status(404).json({ message: 'Project not found'});
        }

        await prisma.websiteProject.update({
            where: {id: projectId},
            data: {current_code: code, current_version_index: ''}
        })
        
        res.json({ message: 'Project save'  });
    } catch (error : any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
}

// Add this at the bottom of projectController.ts

export const togglePublish = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { projectId } = req.params;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const project = await prisma.websiteProject.findUnique({
            where: { id: projectId, userId } // Ensure user owns the project
        })

        if (!project) {
            return res.status(404).json({ message: 'Project not found' })
        }

        const updatedProject = await prisma.websiteProject.update({
            where: { id: projectId },
            data: { isPublished: !project.isPublished }
        })

        res.json({ 
            message: updatedProject.isPublished ? 'Project Published Successfully' : 'Project Unpublished',
            isPublished: updatedProject.isPublished
        })

    } catch (error: any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
    }
}