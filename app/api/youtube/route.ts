import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    console.log(`[${requestId}] Processing YouTube request (RapidAPI: youtube-transcript3)`);

    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        // Extract Video ID
        const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;

        if (!videoId) {
            return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
        }

        console.log(`[${requestId}] Extracted Video ID: ${videoId}`);

        const rapidApiKey = process.env.RAPIDAPI_KEY;
        if (!rapidApiKey) {
            console.error(`[${requestId}] RAPIDAPI_KEY is missing`);
            return NextResponse.json({ error: "Server configuration error: RAPIDAPI_KEY missing" }, { status: 500 });
        }

        // Fetch Transcript and Title in parallel
        console.log(`[${requestId}] Fetching transcript and title...`);

        const [transcriptRes, oembedRes] = await Promise.all([
            fetch(`https://youtube-transcript3.p.rapidapi.com/api/transcript?videoId=${videoId}`, {
                method: 'GET',
                headers: {
                    'x-rapidapi-key': rapidApiKey,
                    'x-rapidapi-host': 'youtube-transcript3.p.rapidapi.com'
                }
            }),
            fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
        ]);

        // Process Title
        let title = "YouTube Video";
        if (oembedRes.ok) {
            try {
                const oembedData = await oembedRes.json();
                title = oembedData.title || title;
                console.log(`[${requestId}] Fetched Title: ${title}`);
            } catch (e) {
                console.warn(`[${requestId}] Failed to parse oEmbed title`, e);
            }
        } else {
            console.warn(`[${requestId}] Failed to fetch oEmbed title: ${oembedRes.status}`);
        }

        // Process Transcript
        if (!transcriptRes.ok) {
            const errorText = await transcriptRes.text();
            console.error(`[${requestId}] RapidAPI Error (${transcriptRes.status}): ${errorText}`);
            return NextResponse.json({
                error: `Failed to fetch transcript from RapidAPI: ${transcriptRes.statusText}`
            }, { status: transcriptRes.status });
        }

        const data = await transcriptRes.json();

        if (!data.success || !data.transcript) {
            console.error(`[${requestId}] Invalid RapidAPI response`, data);
            return NextResponse.json({ error: "Failed to retrieve transcript data" }, { status: 500 });
        }

        // Map to our format: { start: number, text: string }
        // RapidAPI returns: { offset: string, duration: string, text: string, lang: string }
        const transcript = data.transcript.map((item: any) => ({
            start: parseFloat(item.offset),
            text: item.text
        }));

        console.log(`[${requestId}] Successfully parsed ${transcript.length} lines`);
        if (transcript.length > 0) {
            const lastItem = transcript[transcript.length - 1];
            console.log(`[${requestId}] Transcript ends at: ${lastItem.start}s`);
        }

        return NextResponse.json({
            success: true,
            title: title,
            transcript: transcript,
        });

    } catch (error: any) {
        console.error(`[${requestId}] YouTube processing error:`, error);
        return NextResponse.json(
            { error: error.message || "YouTube processing failed" },
            { status: 500 }
        );
    }
}
