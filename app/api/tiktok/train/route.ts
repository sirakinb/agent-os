import { NextRequest, NextResponse } from "next/server";
import { vertexModel, isVertexAIConfigured } from "@/lib/gemini";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from 'uuid';

const DATA_FILE_PATH = path.join(process.cwd(), "data", "tiktok_history.json");

export async function POST(req: NextRequest) {
    try {
        const { fileUri, mimeType, isGcsUri, stats } = await req.json();

        if (!fileUri) {
            return NextResponse.json({ error: "No file URI provided" }, { status: 400 });
        }

        const { likes = 0, saves = 0, comments = 0, shares = 0 } = stats || {};

        // Use Vertex AI to analyze the video
        if ((isGcsUri || fileUri.startsWith("gs://")) && isVertexAIConfigured() && vertexModel) {
            console.log("Analyzing TikTok video with Vertex AI...");

            const result = await vertexModel.generateContent({
                contents: [{
                    role: "user",
                    parts: [
                        { fileData: { mimeType: mimeType || "video/mp4", fileUri: fileUri } },
                        {
                            text: `Analyze this TikTok video for training purposes. 
Extract the following structured information:
1. **Hook**: What was the visual or audio hook in the first 3 seconds?
2. **Topic**: What is the core subject matter?
3. **Style**: Describe the editing style, pacing, and tone (e.g., fast-paced, vlog, educational, humorous).
4. **Key Elements**: List visual elements, text overlays, or sounds that stand out.
5. **Transcript Summary**: A brief summary of what was said.

Format the output as a JSON object with keys: hook, topic, style, keyElements (array), transcriptSummary.
Do not include markdown formatting like \`\`\`json.` }
                    ]
                }],
            });

            const analysisText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
            let analysis;
            try {
                const cleanedText = analysisText.replace(/```json/g, '').replace(/```/g, '').trim();
                analysis = JSON.parse(cleanedText);
            } catch (e) {
                console.error("Failed to parse analysis JSON", e);
                analysis = { raw: analysisText };
            }

            // Save to History
            const newEntry = {
                id: uuidv4(),
                fileUri: fileUri,
                analysis,
                stats: { likes: Number(likes), saves: Number(saves), comments: Number(comments), shares: Number(shares) },
                timestamp: new Date().toISOString(),
            };

            let history = [];
            try {
                if (fs.existsSync(DATA_FILE_PATH)) {
                    const fileContent = fs.readFileSync(DATA_FILE_PATH, "utf-8");
                    history = JSON.parse(fileContent);
                }
            } catch (e) {
                console.warn("Could not parse history file, starting fresh.");
            }

            history.push(newEntry);

            // Ensure data directory exists
            const dataDir = path.dirname(DATA_FILE_PATH);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(history, null, 2));

            return NextResponse.json({ success: true, entry: newEntry });

        } else {
            return NextResponse.json({
                error: "Server configuration error: Vertex AI not configured for GCS files."
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Training error:", error);
        return NextResponse.json({
            error: "Training failed",
            details: error.message || String(error)
        }, { status: 500 });
    }
}
