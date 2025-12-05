import { NextRequest, NextResponse } from "next/server";
import { vertexModel, isVertexAIConfigured, genaiClient } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const { fileUri, mimeType, isGcsUri } = await req.json();

        if (!fileUri) {
            return NextResponse.json({ error: "No file URI provided" }, { status: 400 });
        }

        // Step 1: Transcribe with Vertex AI (The Eyes - can read GCS)
        if ((isGcsUri || fileUri.startsWith("gs://")) && isVertexAIConfigured() && vertexModel) {
            console.log("Step 1: Transcribing video with Vertex AI (Gemini 2.0 Flash)...");

            const transcriptionPrompt = `
            Transcribe this entire video accurately.
            
            For the transcript:
            - Include speaker labels if multiple speakers are detected (e.g., "Speaker 1:", "Speaker 2:")
            - Add paragraph breaks where there are natural pauses or topic changes
            - Maintain the exact words spoken, including filler words like "um", "uh" if present
            
            For the SRT:
            - Use standard SRT format with sequential numbering
            - Each subtitle should be 1-3 lines max
            - Timestamps should be accurate in HH:MM:SS,mmm format
            - Keep each caption to about 42 characters per line for readability
            
            Return a JSON object with two fields:
            {
                "transcript": "The full transcript as continuous text with paragraph breaks",
                "srt": "The complete SRT file content as a string"
            }
            
            Do not include any markdown formatting. Just the raw JSON.
            `;

            const result = await vertexModel.generateContent({
                contents: [{
                    role: "user",
                    parts: [
                        { fileData: { mimeType: mimeType || "video/mp4", fileUri: fileUri } },
                        { text: transcriptionPrompt }
                    ]
                }],
            });

            const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
            console.log("Transcription complete, response length:", responseText.length);

            // Parse the response
            let data;
            try {
                const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                data = JSON.parse(cleanedText);
            } catch (e) {
                console.error("Failed to parse transcription JSON, attempting fallback", e);
                // Fallback: treat entire response as transcript
                data = {
                    transcript: responseText,
                    srt: ""
                };
            }

            // Optional Step 2: Use Gemini 3 to improve/format the transcript
            // (Skipped for now since Vertex AI already produces good results)

            return NextResponse.json({
                success: true,
                transcript: data.transcript,
                srt: data.srt
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
