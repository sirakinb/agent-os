import { NextRequest, NextResponse } from "next/server";
import { vertexModel, isVertexAIConfigured } from "@/lib/gemini";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin
if (!getApps().length) {
    try {
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
            const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
            initializeApp({
                credential: cert(credentials),
                projectId: process.env.GOOGLE_CLOUD_PROJECT || credentials.project_id,
            });
        }
    } catch (e) {
        console.error("Failed to initialize Firebase Admin:", e);
    }
}

const db = getApps().length > 0 ? getFirestore() : null;

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

            // Save to Firestore
            const newEntry = {
                fileUri: fileUri,
                analysis,
                stats: { likes: Number(likes), saves: Number(saves), comments: Number(comments), shares: Number(shares) },
                timestamp: new Date().toISOString(),
                createdAt: new Date(),
            };

            if (db) {
                const docRef = await db.collection("tiktok_history").add(newEntry);
                console.log("Saved to Firestore with ID:", docRef.id);
                return NextResponse.json({ success: true, entry: { id: docRef.id, ...newEntry } });
            } else {
                console.log("Firestore not available, returning without persistence");
                return NextResponse.json({ success: true, entry: { id: Date.now().toString(), ...newEntry } });
            }

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
