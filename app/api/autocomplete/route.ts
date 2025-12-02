import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) {
        return NextResponse.json({ suggestions: [] });
    }

    try {
        const response = await fetch(
            `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}`
        );

        // The API returns window.google.ac.h(["query", [["suggestion", 0], ...]])
        // We need to parse this JSON-P like response or just text.
        // Actually, with client=youtube, it often returns JSON if we add &client=firefox or similar, 
        // but the user specified `client=youtube`.
        // Let's try to fetch and see the format. 
        // Usually it returns JSON-P.

        const text = await response.text();

        // Extract the array part
        const match = text.match(/window\.google\.ac\.h\((.*)\)/);
        if (match && match[1]) {
            const data = JSON.parse(match[1]);
            const suggestions = data[1].map((item: any) => item[0]);
            return NextResponse.json({ suggestions });
        }

        // Fallback if format is different (e.g. standard JSON)
        try {
            const data = JSON.parse(text);
            if (Array.isArray(data) && data.length > 1) {
                return NextResponse.json({ suggestions: data[1] });
            }
        } catch (e) { }

        return NextResponse.json({ suggestions: [] });

    } catch (error) {
        console.error("Autocomplete error:", error);
        return NextResponse.json({ error: "Autocomplete failed" }, { status: 500 });
    }
}
