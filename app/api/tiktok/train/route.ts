import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from 'uuid';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");
const fileManager = new GoogleAIFileManager(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

const DATA_FILE_PATH = path.join(process.cwd(), "data", "tiktok_history.json");

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const likes = Number(formData.get("likes") || 0);
        const saves = Number(formData.get("saves") || 0);
        const comments = Number(formData.get("comments") || 0);
        const shares = Number(formData.get("shares") || 0);

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // 1. Upload to Gemini
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Create a temporary file to upload to Gemini
        const tempFilePath = path.join("/tmp", `upload_${Date.now()}_${file.name}`);
        fs.writeFileSync(tempFilePath, buffer);

        const uploadResponse = await fileManager.uploadFile(tempFilePath, {
            mimeType: file.type,
            displayName: file.name,
        });

        // Clean up temp file
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

        // 2. Analyze with Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });
        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadResponse.file.mimeType,
                    fileUri: uploadResponse.file.uri,
                },
            },
            {
                text: `Analyze this TikTok video for training purposes. 
        Extract the following structured information:
        1. **Hook**: What was the visual or audio hook in the first 3 seconds?
        2. **Topic**: What is the core subject matter?
        3. **Style**: Describe the editing style, pacing, and tone (e.g., fast-paced, vlog, educational, humorous).
        4. **Key Elements**: List visual elements, text overlays, or sounds that stand out.
        5. **Transcript Summary**: A brief summary of what was said.
        
        Format the output as a JSON object with keys: hook, topic, style, keyElements (array), transcriptSummary.
        Do not include markdown formatting like \`\`\`json.`
            },
        ]);

        const analysisText = result.response.text();
        let analysis;
        try {
            // clean up potential markdown code blocks
            const cleanedText = analysisText.replace(/```json/g, '').replace(/```/g, '').trim();
            analysis = JSON.parse(cleanedText);
        } catch (e) {
            console.error("Failed to parse analysis JSON", e);
            analysis = { raw: analysisText };
        }

        // 3. Save to History
        const newEntry = {
            id: uuidv4(),
            filename: file.name,
            fileUri: uploadResponse.file.uri, // Store URI for potential future re-use (though it expires)
            analysis,
            stats: { likes, saves, comments, shares },
            timestamp: new Date().toISOString(),
        };

        let history = [];
        if (fs.existsSync(DATA_FILE_PATH)) {
            const fileContent = fs.readFileSync(DATA_FILE_PATH, "utf-8");
            try {
                history = JSON.parse(fileContent);
            } catch (e) {
                console.warn("Could not parse history file, starting fresh.");
            }
        }

        history.push(newEntry);
        fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(history, null, 2));

        return NextResponse.json({ success: true, entry: newEntry });

    } catch (error: any) {
        console.error("Training error:", error);
        return NextResponse.json({
            error: "Internal Server Error",
            details: error.message || String(error)
        }, { status: 500 });
    }
}
