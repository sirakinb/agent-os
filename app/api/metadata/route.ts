import { NextRequest, NextResponse } from "next/server";
import { genAI, fileManager, vertexModel, isVertexAIConfigured } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const { fileUri, mimeType, chapterTitles, transcript, isGcsUri } = await req.json();

        if (!fileUri && !transcript) {
            return NextResponse.json({ error: "No file URI or transcript provided" }, { status: 400 });
        }

        // 1. Fetch Autocomplete Suggestions for context (using chapter titles as seeds)
        const seeds = chapterTitles ? chapterTitles.slice(0, 5) : [];
        const suggestionsMap: Record<string, string[]> = {};

        await Promise.all(
            seeds.map(async (seed: string) => {
                try {
                    const res = await fetch(
                        `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(seed)}`
                    );
                    const text = await res.text();
                    const match = text.match(/window\.google\.ac\.h\((.*)\)/);
                    if (match && match[1]) {
                        const data = JSON.parse(match[1]);
                        suggestionsMap[seed] = data[1].map((item: any) => item[0]);
                    }
                } catch (e) {
                    // ignore errors
                }
            })
        );

        const fixedPrefix = `Join My Community to Level Up ➡ https://www.skool.com/vibecodepioneers

📅 Book a Meeting with Our Team: https://tally.so/r/3NBGBl

Subscribe to my newsletter: https://bajulaiye.beehiiv.com/`;

        let promptParts: any[] = [];
        let useVertexAI = false;

        if (transcript) {
            const transcriptText = transcript.map((t: any) => `[${t.start}s] ${t.text}`).join("\n");
            promptParts.push(`
         You are an expert YouTube SEO strategist.
         I need you to generate high-performing metadata for this video based on its transcript.
         
         Transcript Context:
         ${transcriptText.substring(0, 50000)}
       `);
        } else if ((isGcsUri || fileUri?.startsWith("gs://")) && isVertexAIConfigured()) {
            // Use Vertex AI for Firebase Storage GCS URIs
            console.log("Using Vertex AI for metadata with GCS URI:", fileUri);
            useVertexAI = true;
            promptParts.push({
                fileData: {
                    mimeType: mimeType || "video/mp4",
                    fileUri: fileUri,
                },
            });
            promptParts.push(`
         You are an expert YouTube SEO strategist.
         I need you to generate high-performing metadata for this video.
       `);
        } else if (isGcsUri || fileUri?.startsWith("gs://")) {
            // GCS URI but Vertex AI not configured
            console.error("GCS URI provided but Vertex AI is not configured");
            return NextResponse.json({
                error: "Server configuration error: Cannot process Firebase Storage files."
            }, { status: 500 });
        } else {
            // Use Gemini File API URI
            let file = await fileManager.getFile(fileUri.split("/").pop()!);
            if (file.state !== "ACTIVE") {
                // Wait for file to be active
                while (file.state === "PROCESSING") {
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                    file = await fileManager.getFile(fileUri.split("/").pop()!);
                }
            }

            promptParts.push({
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri,
                },
            });

            promptParts.push(`
         You are an expert YouTube SEO strategist.
         I need you to generate high-performing metadata for this video.
       `);
        }

        promptParts.push(`
      Here is some context on what people are searching for related to this video's topics:
      ${JSON.stringify(suggestionsMap, null, 2)}
      
      Please generate the following:
      
      1. **Video Titles**: 5 options. They should be clickable, SEO-rich, and exciting. Use the "Vibe Coding" style (modern, tech-forward).
      2. **Thumbnail Titles**: 5 options. Short, punchy text (max 5 words) that would look good on a thumbnail image.
      3. **Description**: 
         - MUST start exactly with this text:
           """
           ${fixedPrefix}
           """
         - Followed by a compelling hook/intro.
         - Then a bulleted summary of what is covered in the video (use the video content for this).
         - **IMPORTANT**: Do NOT use markdown bolding (like **text**). Write in plain text.
         - Use hyphens (-) for bullet points.
         - Tone: Professional, Exciting, "Vibe Coding".
      4. **Tags**: A comma-separated list of 15-20 high-ranking keywords.
      
      Format the output strictly as JSON:
      {
        "videoTitles": ["Title 1", "Title 2", ...],
        "thumbnailTitles": ["Thumb 1", "Thumb 2", ...],
        "description": "Full description text...",
        "tags": "tag1, tag2, tag3..."
      }
    `);

        let responseText: string;

        if (useVertexAI && vertexModel) {
            console.log("Calling Vertex AI for metadata generation...");
            const result = await vertexModel.generateContent({
                contents: [{ role: "user", parts: promptParts }],
            });
            const response = await result.response;
            responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } else {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
            const result = await model.generateContent(promptParts);
            responseText = result.response.text();
        }

        const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

        let metadata;
        try {
            metadata = JSON.parse(cleanedText);
        } catch (e) {
            console.error("Failed to parse metadata:", responseText);
            return NextResponse.json({ error: "Failed to parse metadata" }, { status: 500 });
        }

        return NextResponse.json({ metadata });

    } catch (error) {
        console.error("Metadata error:", error);
        return NextResponse.json({ error: "Metadata generation failed" }, { status: 500 });
    }
}
