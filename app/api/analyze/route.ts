import { NextRequest, NextResponse } from "next/server";
import { genAI, fileManager } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const { fileUri, mimeType, transcript, isGcsUri } = await req.json();

        if (!fileUri && !transcript) {
            return NextResponse.json({ error: "No file URI or transcript provided" }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        let promptParts: any[] = [];

        if (transcript) {
            // Use transcript for analysis
            const transcriptText = transcript.map((t: any) => `[${t.start}s] ${t.text}`).join("\n");
            promptParts.push(`
        Analyze this video transcript and generate a comprehensive list of timestamps and chapter titles.
        Focus on key topics, visual changes (inferred from context), and important spoken content.
        
        Transcript:
        ${transcriptText}
      `);
        } else if (isGcsUri || fileUri.startsWith("gs://")) {
            // Use GCS URI directly - for large files uploaded to Firebase Storage
            console.log("Using GCS URI directly:", fileUri);
            promptParts.push({
                fileData: {
                    mimeType: mimeType || "video/mp4",
                    fileUri: fileUri,
                },
            });
        } else {
            // Use Gemini File API URI
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

        promptParts.push(`
      Format the output strictly as a JSON array of objects with 'time' and 'title' keys.
      IMPORTANT: For timestamps longer than 1 hour, use the format H:MM:SS (e.g., 1:20:34 instead of 80:34).
      For timestamps under 1 hour, use MM:SS (e.g., 14:20).
      
      Example:
      [
        { "time": "0:00", "title": "Introduction" },
        { "time": "15:30", "title": "Middle Topic" },
        { "time": "1:05:20", "title": "Topic after one hour" }
      ]
      
      Do not include any markdown formatting like \`\`\`json. Just the raw JSON.
    `);

        const result = await model.generateContent(promptParts);

        const responseText = result.response.text();
        // Clean up markdown if present
        const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

        let chapters;
        try {
            chapters = JSON.parse(cleanedText);
        } catch (e) {
            console.error("Failed to parse JSON:", responseText);
            // Fallback: try to parse line by line if JSON fails
            chapters = [];
            // Simple regex fallback could be added here
        }

        return NextResponse.json({ chapters });

    } catch (error) {
        console.error("Analysis error:", error);
        return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
    }
}
