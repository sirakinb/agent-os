import { NextRequest, NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";

export async function POST(req: NextRequest) {
    try {
        const { chapters } = await req.json();

        if (!chapters || !Array.isArray(chapters)) {
            return NextResponse.json({ error: "Invalid chapters data" }, { status: 400 });
        }

        // 1. Fetch Autocomplete Suggestions for ALL chapters in parallel
        // We do this server-side to keep the client fast and avoid CORS issues if any
        const chaptersWithSuggestions = await Promise.all(
            chapters.map(async (chapter: any) => {
                try {
                    const res = await fetch(
                        `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(chapter.title)}`
                    );
                    const text = await res.text();
                    let suggestions = [];

                    // Parse JSON-P or JSON
                    const match = text.match(/window\.google\.ac\.h\((.*)\)/);
                    if (match && match[1]) {
                        const data = JSON.parse(match[1]);
                        suggestions = data[1].map((item: any) => item[0]);
                    } else {
                        try {
                            const data = JSON.parse(text);
                            if (Array.isArray(data) && data.length > 1) {
                                suggestions = data[1];
                            }
                        } catch (e) { }
                    }

                    return { ...chapter, suggestions };
                } catch (e) {
                    return { ...chapter, suggestions: [] };
                }
            })
        );

        // 2. Ask Gemini to Refine/Polish the list
        const model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });

        const prompt = `
      You are an expert YouTube SEO strategist and copywriter.
      
      I have a list of raw video chapters and their corresponding YouTube search suggestions.
      Your task is to REWRITE these chapter titles to be:
      1. **SEO Optimized**: Use the search suggestions if they are relevant and high-quality.
      2. **Consistent**: Use Title Case for all titles (e.g., "Intro to AI" not "intro to ai").
      3. **Accurate**: Fix typos (e.g., "imagenes" -> "Images", "nanobana 20" -> "Nano Banana 2" if it makes more sense in context).
      4. **Clean**: Remove unnecessary punctuation like trailing colons.
      
      Here is the data:
      ${JSON.stringify(chaptersWithSuggestions, null, 2)}
      
      Return ONLY a JSON array of objects with 'time' and 'title'.
      Example:
      [
        { "time": "0:00", "title": "Introduction to Gemini 3.0" },
        { "time": "1:30", "title": "Advanced Coding Features" }
      ]
    `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

        let refinedChapters;
        try {
            refinedChapters = JSON.parse(cleanedText);
        } catch (e) {
            console.error("Failed to parse refined chapters:", responseText);
            // Fallback to original if parsing fails, but try to fix simple JSON errors if possible
            refinedChapters = chapters;
        }

        return NextResponse.json({ chapters: refinedChapters });

    } catch (error) {
        console.error("Refine error:", error);
        return NextResponse.json({ error: "Refinement failed" }, { status: 500 });
    }
}
