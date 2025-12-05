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
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            initializeApp({
                projectId: process.env.GOOGLE_CLOUD_PROJECT,
            });
        }
    } catch (e) {
        console.error("Failed to initialize Firebase Admin:", e);
    }
}

const db = getFirestore();

export async function POST(req: NextRequest) {
    try {
        const { fileUri, mimeType, isGcsUri } = await req.json();

        if (!fileUri) {
            return NextResponse.json({ error: "No file URI provided" }, { status: 400 });
        }

        // Load History from Firestore
        let history: any[] = [];
        try {
            const snapshot = await db.collection("tiktok_history")
                .orderBy("createdAt", "desc")
                .limit(20)
                .get();

            history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`Loaded ${history.length} videos from Firestore`);
        } catch (e) {
            console.warn("Could not load history from Firestore:", e);
        }

        // Sort by engagement score and get top performers
        const topPerformers = history
            .map((entry: any) => ({
                ...entry,
                score: (entry.stats?.likes || 0) + (entry.stats?.saves || 0) * 2 + (entry.stats?.comments || 0) * 3 + (entry.stats?.shares || 0) * 4
            }))
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, 5);

        const contextDescription = topPerformers.map((video: any, index: number) => `
Example ${index + 1} (High Performing):
- Hook: ${video.analysis?.hook || 'N/A'}
- Topic: ${video.analysis?.topic || 'N/A'}
- Style: ${video.analysis?.style || 'N/A'}
- Key Elements: ${JSON.stringify(video.analysis?.keyElements || [])}
- Stats: ${JSON.stringify(video.stats || {})}
`).join("\n");

        // Use Vertex AI to analyze the new video
        if ((isGcsUri || fileUri.startsWith("gs://")) && isVertexAIConfigured() && vertexModel) {
            console.log("Analyzing new TikTok video with Vertex AI...");

            const result = await vertexModel.generateContent({
                contents: [{
                    role: "user",
                    parts: [
                        { fileData: { mimeType: mimeType || "video/mp4", fileUri: fileUri } },
                        {
                            text: `You are an expert TikTok strategist. 

Here is context on my past top-performing videos:
${contextDescription || "No previous videos in knowledge base yet."}

Analyze this NEW video I just uploaded. 
Based on the patterns of my successful videos above, provide actionable feedback.

Generate a JSON object with the following keys:
1. **feedback**: Specific critique on the hook, pacing, and visual style compared to my best work.
2. **score**: A predicted viral score from 1-10 based on the hook and retention potential.
3. **improvedScript**: Suggest a rewritten version of the script (or key lines) to make it punchier.
4. **viralHooks**: 3 alternative opening hooks that would grab attention better.
5. **caption**: An SEO-optimized caption with hashtags.
6. **thumbnailText**: 3 short, punchy text overlays for the cover.

Do not include markdown formatting like \`\`\`json. Just the raw JSON.` }
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

            return NextResponse.json({ success: true, analysis });

        } else {
            return NextResponse.json({
                error: "Server configuration error: Vertex AI not configured for GCS files."
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error("Analysis error:", error);
        return NextResponse.json({
            error: "Analysis failed",
            details: error.message || String(error)
        }, { status: 500 });
    }
}
