import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import fs from "fs";
import path from "path";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");
const fileManager = new GoogleAIFileManager(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

const DATA_FILE_PATH = path.join(process.cwd(), "data", "tiktok_history.json");

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // 1. Upload New Video to Gemini
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const tempFilePath = path.join("/tmp", `analyze_${Date.now()}_${file.name}`);
        fs.writeFileSync(tempFilePath, buffer);

        const uploadResponse = await fileManager.uploadFile(tempFilePath, {
            mimeType: file.type,
            displayName: file.name,
        });
        fs.unlinkSync(tempFilePath);

        // Wait for processing
        let fileRecord = await fileManager.getFile(uploadResponse.file.name);
        while (fileRecord.state === FileState.PROCESSING) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            fileRecord = await fileManager.getFile(uploadResponse.file.name);
        }

        if (fileRecord.state === FileState.FAILED) {
            throw new Error("Video processing failed");
        }

        // 2. Load History and Select Top Performers
        let history = [];
        if (fs.existsSync(DATA_FILE_PATH)) {
            const fileContent = fs.readFileSync(DATA_FILE_PATH, "utf-8");
            try {
                history = JSON.parse(fileContent);
            } catch (e) {
                console.warn("Could not parse history file.");
            }
        }

        // Sort by a composite score (e.g., likes + 2*saves + comments) or just likes for simplicity
        // Let's do a simple engagement score: likes + saves + comments + shares
        const topPerformers = history
            .map((entry: any) => ({
                ...entry,
                score: (entry.stats.likes || 0) + (entry.stats.saves || 0) * 2 + (entry.stats.comments || 0) * 3 + (entry.stats.shares || 0) * 4
            }))
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, 5); // Take top 5

        const contextDescription = topPerformers.map((video: any, index: number) => `
        Example ${index + 1} (High Performing):
        - Hook: ${video.analysis.hook}
        - Topic: ${video.analysis.topic}
        - Style: ${video.analysis.style}
        - Key Elements: ${JSON.stringify(video.analysis.keyElements)}
        - Stats: ${JSON.stringify(video.stats)}
    `).join("\n");

        // 3. Analyze with Gemini using Context
        const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });
        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadResponse.file.mimeType,
                    fileUri: uploadResponse.file.uri,
                },
            },
            {
                text: `You are an expert TikTok strategist. 
        
        Here is context on my past top-performing videos:
        ${contextDescription}

        Analyze this NEW video I just uploaded. 
        Based on the patterns of my successful videos above, provide actionable feedback.

        Generate a JSON object with the following keys:
        1. **feedback**: Specific critique on the hook, pacing, and visual style compared to my best work.
        2. **score**: A predicted viral score from 1-10 based on the hook and retention potential.
        3. **improvedScript**: Suggest a rewritten version of the script (or key lines) to make it punchier.
        4. **viralHooks**: 3 alternative opening hooks that would grab attention better.
        5. **caption**: An SEO-optimized caption with hashtags.
        6. **thumbnailText**: 3 short, punchy text overlays for the cover.

        Do not include markdown formatting like \`\`\`json. Just the raw JSON.
        `
            },
        ]);

        const analysisText = result.response.text();
        let analysis;
        try {
            const cleanedText = analysisText.replace(/```json/g, '').replace(/```/g, '').trim();
            analysis = JSON.parse(cleanedText);
        } catch (e) {
            console.error("Failed to parse analysis JSON", e);
            analysis = { raw: analysisText };
        }

        return NextResponse.json({ success: true, analysis });

    } catch (error) {
        console.error("Analysis error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
