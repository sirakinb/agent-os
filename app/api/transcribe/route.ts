import { NextRequest, NextResponse } from "next/server";
import { vertexModel, isVertexAIConfigured } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const { fileUri, mimeType, isGcsUri } = await req.json();

        if (!fileUri) {
            return NextResponse.json({ error: "No file URI provided" }, { status: 400 });
        }

        // Step 1: Transcribe with Vertex AI (The Eyes - can read GCS)
        if ((isGcsUri || fileUri.startsWith("gs://")) && isVertexAIConfigured() && vertexModel) {
            console.log("Step 1: Transcribing video with Vertex AI...");

            // First, get the raw transcript
            const transcriptPrompt = `
            Transcribe this entire video word-for-word.
            
            Rules:
            - Include ALL spoken words exactly as said
            - Add paragraph breaks where there are natural pauses (3+ seconds) or topic changes
            - Include speaker labels if multiple speakers (e.g., "Speaker 1:", "Speaker 2:")
            - DO NOT include timestamps in this transcript
            - DO NOT include any markdown or formatting
            - Just output the plain text transcript
            `;

            console.log("Getting transcript...");
            const transcriptResult = await vertexModel.generateContent({
                contents: [{
                    role: "user",
                    parts: [
                        { fileData: { mimeType: mimeType || "video/mp4", fileUri: fileUri } },
                        { text: transcriptPrompt }
                    ]
                }],
            });

            const transcript = transcriptResult.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
            console.log("Transcript received, length:", transcript.length);

            // Now generate SRT separately
            const srtPrompt = `
            Generate SRT subtitles for this video.
            
            Requirements:
            - Use standard SRT format with sequential numbering starting at 1
            - Timestamps in format: HH:MM:SS,mmm --> HH:MM:SS,mmm
            - Each subtitle block should be 1-2 lines max
            - Keep each line under 42 characters for readability
            - Include accurate timing synchronized with the speech
            
            Example format:
            1
            00:00:00,000 --> 00:00:02,500
            Hello and welcome to

            2
            00:00:02,500 --> 00:00:05,000
            this video about coding.

            Output ONLY the SRT content, nothing else. No explanations, no markdown.
            `;

            console.log("Generating SRT...");
            const srtResult = await vertexModel.generateContent({
                contents: [{
                    role: "user",
                    parts: [
                        { fileData: { mimeType: mimeType || "video/mp4", fileUri: fileUri } },
                        { text: srtPrompt }
                    ]
                }],
            });

            let srt = srtResult.response.candidates?.[0]?.content?.parts?.[0]?.text || "";

            // Clean up SRT - remove any markdown formatting
            srt = srt.replace(/```srt/gi, '').replace(/```/g, '').trim();

            console.log("SRT received, length:", srt.length);

            return NextResponse.json({
                success: true,
                transcript: transcript.trim(),
                srt: srt
            });

        } else {
            return NextResponse.json({
                error: "Server configuration error: Vertex AI not configured for GCS files."
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Transcription error:", error);
        return NextResponse.json({
            error: "Transcription failed",
            details: error.message || String(error)
        }, { status: 500 });
    }
}
