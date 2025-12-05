import { NextRequest, NextResponse } from "next/server";
import { genAI, fileManager, vertexModel, isVertexAIConfigured, genaiClient } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const { fileUri, mimeType, transcript, isGcsUri } = await req.json();

        if (!fileUri && !transcript) {
            return NextResponse.json({ error: "No file URI or transcript provided" }, { status: 400 });
        }

        let videoContext = "";

        // Step 1: Get Video Context (The Eyes)
        if (transcript) {
            // Use transcript directly
            videoContext = transcript.map((t: any) => "[" + t.start + "s] " + t.text).join("\n");
        } else if ((isGcsUri || fileUri.startsWith("gs://")) && isVertexAIConfigured() && vertexModel) {
            // Use Vertex AI (Gemini 1.5 Pro) to process GCS video
            console.log("Step 1: Processing video with Vertex AI (Gemini 1.5 Pro)...");

            const extractionPrompt = `
            Analyze this video in detail. 
            Output a comprehensive chronological log of the video content, including:
            - Exact timestamps for every scene change or topic shift.
            - Detailed description of visual content.
            - Summary of spoken content.
            
            Format:
            [MM:SS] Event description...
            `;

            const result = await vertexModel.generateContent({
                contents: [{
                    role: "user",
                    parts: [
                        { fileData: { mimeType: mimeType || "video/mp4", fileUri: fileUri } },
                        { text: extractionPrompt }
                    ]
                }],
            });

            videoContext = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
            console.log("Video context extracted, length:", videoContext.length);

        } else if (isGcsUri || fileUri.startsWith("gs://")) {
            return NextResponse.json({
                error: "Server configuration error: Vertex AI not configured for GCS files."
            }, { status: 500 });
        } else {
            // Use Gemini File API (Local dev)
            let file = await fileManager.getFile(fileUri.split("/").pop()!);
            while (file.state === "PROCESSING") {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                file = await fileManager.getFile(fileUri.split("/").pop()!);
            }
            if (file.state === "FAILED") return NextResponse.json({ error: "Video processing failed" }, { status: 500 });

            // For File API, we can pass the file directly to Gemini 3 via Google AI Studio!
            // But to keep logic consistent, let's extract context first or pass file handle?
            // Actually, for File API, Gemini 3 (Google AI Studio) CAN access it directly.
            // So we can skip the extraction step for non-GCS files if we want.
            // But let's stick to the hybrid flow for consistency or just use Gemini 3 directly here.

            // DIRECT GEMINI 3 for File API (since it supports it)
            console.log("Using Direct Gemini 3 for File API...");
            const response = await genaiClient.models.generateContent({
                model: 'gemini-pro',
                contents: [{
                    role: 'user',
                    parts: [
                        { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
                        { text: "Analyze this video and generate chapters." } // We'll add the full prompt below
                    ]
                }],
            });
            // We can just return this result, but we need to format it.
            // Let's just set videoContext to null and handle it in Step 2 logic
            // Actually, let's just do the generation here and return.
            const responseText = response.text();
            const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
            let chapters;
            try { chapters = JSON.parse(cleanedText); } catch (e) { chapters = []; }
            return NextResponse.json({ chapters });
        }

        // Step 2: Generate Chapters (The Brain - Gemini 3)
        console.log("Step 2: Generating chapters with Gemini 3...");

        const analysisPrompt = `
        You are an expert video editor.
        Based on the following detailed log of a video, generate a comprehensive list of timestamps and chapter titles.
        
        Video Log:
        ${videoContext.substring(0, 100000)} 
        
        Format the output strictly as a JSON array of objects with 'time' and 'title' keys.
        IMPORTANT: For timestamps longer than 1 hour, use the format H:MM:SS.
        For timestamps under 1 hour, use MM:SS.

        Example:
        [
            { "time": "0:00", "title": "Introduction" },
            { "time": "15:30", "title": "Middle Topic" }
        ]
        
        Do not include any markdown formatting like \`\`\`json. Just the raw JSON.
        `;

        const response = await genaiClient.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
        });

        const responseText = response.text();
        const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

        let chapters;
        try {
            chapters = JSON.parse(cleanedText);
        } catch (e) {
            console.error("Failed to parse JSON:", responseText);
            chapters = [];
        }

        return NextResponse.json({ chapters });

    } catch (error) {
        console.error("Analysis error:", error);
        return NextResponse.json({
            error: "Analysis failed",
            details: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
    }
}
