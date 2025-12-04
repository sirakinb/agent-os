```typescript
import { NextRequest, NextResponse } from "next/server";
import { genAI, fileManager, vertexModel, isVertexAIConfigured, genaiClient } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const { fileUri, mimeType, transcript, isGcsUri } = await req.json();

        if (!fileUri && !transcript) {
            return NextResponse.json({ error: "No file URI or transcript provided" }, { status: 400 });
        }

        let promptParts: any[] = [];
        let useVertexAI = false;

        if (transcript) {
            // Use transcript for analysis
            const transcriptText = transcript.map((t: any) => "[" + t.start + "s] " + t.text).join("\n");
            promptParts.push(`
        Analyze this video transcript and generate a comprehensive list of timestamps and chapter titles.
        Focus on key topics, visual changes(inferred from context), and important spoken content.

    Transcript:
        ${ transcriptText }
`);
        } else if ((isGcsUri || fileUri.startsWith("gs://")) && isVertexAIConfigured()) {
            // Use Vertex AI for Firebase Storage GCS URIs
            console.log("Using Vertex AI with GCS URI:", fileUri);
            useVertexAI = true;
            promptParts.push({
                fileData: {
                    mimeType: mimeType || "video/mp4",
                    fileUri: fileUri,
                },
            });
        } else if (isGcsUri || fileUri.startsWith("gs://")) {
            // GCS URI but Vertex AI not configured - this won't work
            console.error("GCS URI provided but Vertex AI is not configured");
            return NextResponse.json({
                error: "Server configuration error: Cannot process Firebase Storage files. Please configure GOOGLE_CLOUD_PROJECT."
            }, { status: 500 });
        } else {
            // Use Gemini File API URI (local development path)
            // Wait for file to be active
            let file = await fileManager.getFile(fileUri.split("/").pop()!);
            while (file.state === "PROCESSING") {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                file = await fileManager.getFile(fileUri.split("/").pop()!);
            }

            if (file.state === "FAILED") {
                return NextResponse.json({ error: "Video processing failed" }, { status: 500 });
            }

            promptParts.push({
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri,
                },
            });
        }

        const analysisPrompt = `
      Analyze this video content and generate a comprehensive list of timestamps and chapter titles.
      Focus on key topics, visual changes, and important spoken content.
      
      Format the output strictly as a JSON array of objects with 'time' and 'title' keys.
    IMPORTANT: For timestamps longer than 1 hour, use the format H: MM: SS(e.g., 1: 20: 34 instead of 80: 34).
      For timestamps under 1 hour, use MM: SS(e.g., 14: 20).

    Example:
[
    { "time": "0:00", "title": "Introduction" },
    { "time": "15:30", "title": "Middle Topic" },
    { "time": "1:05:20", "title": "Topic after one hour" }
]
      
      Do not include any markdown formatting like \`\`\`json. Just the raw JSON.
    `;

promptParts.push({ text: analysisPrompt });

let responseText: string;

if (useVertexAI && genaiClient) {
    // Use new Gen AI SDK for Gemini 3
    console.log("Calling Gen AI SDK (Gemini 3)...");

    // Debug info
    const fs = require('fs');
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const credFileExists = credPath ? fs.existsSync(credPath) : false;
    console.log("Cred path:", credPath, "Exists:", credFileExists);

    const parts = promptParts.map(p => {
        if (typeof p === 'string') return { text: p };
        if (p.fileData) return { fileData: { mimeType: p.fileData.mimeType, fileUri: p.fileData.fileUri } };
        if (p.text) return { text: p.text };
        return p;
    });

    const response = await genaiClient.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ role: 'user', parts: parts }],
    });

    responseText = response.text();
} else {
    // Use Google AI SDK (Legacy)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Fallback to stable for non-Vertex
    const result = await model.generateContent(promptParts);
    responseText = result.response.text();
}

// Clean up markdown if present
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

    // Gather debug info
    const fs = require('fs');
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const credFileExists = credPath ? fs.existsSync(credPath) : false;
    const envJsonLen = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON.length : 0;

    return NextResponse.json({
        error: "Analysis failed",
        details: error instanceof Error ? error.message : String(error),
        debug: {
            credPath,
            credFileExists,
            envJsonLen,
            projectId: process.env.GOOGLE_CLOUD_PROJECT,
            location: process.env.GOOGLE_CLOUD_LOCATION
        }
    }, { status: 500 });
}
}
