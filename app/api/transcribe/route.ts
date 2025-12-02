import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import fs from "fs";
import path from "path";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");
const fileManager = new GoogleAIFileManager(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // 1. Upload to Gemini
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const tempFilePath = path.join("/tmp", `transcribe_${Date.now()}_${file.name}`);
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

        // 2. Transcribe with Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });
        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadResponse.file.mimeType,
                    fileUri: uploadResponse.file.uri,
                },
            },
            {
                text: `Transcribe this video.
        
        Provide two outputs in a JSON object:
        1. **transcript**: The full transcript as a continuous text with paragraph breaks where appropriate.
        2. **srt**: The transcript formatted as a valid SRT file string (SubRip Subtitle format). Ensure timestamps are accurate.

        Do not include markdown formatting like \`\`\`json. Just the raw JSON.
        `
            },
        ]);

        const responseText = result.response.text();
        let data;
        try {
            const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            data = JSON.parse(cleanedText);
        } catch (e) {
            console.error("Failed to parse transcription JSON", e);
            return NextResponse.json({ error: "Failed to parse transcription response", raw: responseText }, { status: 500 });
        }

        return NextResponse.json({ success: true, transcript: data.transcript, srt: data.srt });

    } catch (error: any) {
        console.error("Transcription error:", error);
        return NextResponse.json({
            error: "Internal Server Error",
            details: error.message || String(error)
        }, { status: 500 });
    }
}
