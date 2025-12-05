import { NextRequest, NextResponse } from "next/server";

const GETLATE_API_KEY = process.env.GETLATE_API_KEY;
const GETLATE_BASE_URL = "https://getlate.dev/api/v1";

export async function GET(req: NextRequest) {
  if (!GETLATE_API_KEY) {
    return NextResponse.json(
      { error: "GetLate API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform") || "instagram";

    // Get the redirect URL for the OAuth flow
    // After OAuth, GetLate will redirect back to their success page
    // The callback will be handled by GetLate - we just need to poll for the new account

    // First, get or create a default profile
    const profilesRes = await fetch(`${GETLATE_BASE_URL}/profiles`, {
      headers: {
        Authorization: `Bearer ${GETLATE_API_KEY}`,
      },
    });

    let profileId: string;

    if (profilesRes.ok) {
      const profilesData = await profilesRes.json();
      const profiles = profilesData.profiles || [];

      if (profiles.length > 0) {
        profileId = profiles[0]._id;
      } else {
        // Create a default profile if none exists
        const createProfileRes = await fetch(`${GETLATE_BASE_URL}/profiles`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GETLATE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Agent OS",
            description: "Default profile for Agent OS",
            color: "#6366f1",
          }),
        });

        if (createProfileRes.ok) {
          const newProfile = await createProfileRes.json();
          profileId = newProfile._id || newProfile.profile?._id;
        } else {
          throw new Error("Failed to create profile");
        }
      }
    } else {
      throw new Error("Failed to fetch profiles");
    }

    // Construct the OAuth connect URL
    // GetLate's connect endpoint initiates OAuth flow
    const connectUrl = `${GETLATE_BASE_URL}/connect/${platform}?profileId=${profileId}`;

    // Make request to get the OAuth redirect URL
    const connectRes = await fetch(connectUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${GETLATE_API_KEY}`,
      },
    });

    if (connectRes.ok) {
      const data = await connectRes.json();
      // GetLate returns { authUrl: "https://instagram.com/oauth/...", state: "..." }
      if (data.authUrl) {
        return NextResponse.json({ url: data.authUrl });
      }
      if (data.url) {
        return NextResponse.json({ url: data.url });
      }
    }

    // If request failed, log error
    const errorText = await connectRes.text();
    console.error("GetLate connect error:", errorText);

    return NextResponse.json({
      error: "Failed to get OAuth URL from GetLate"
    }, { status: 500 });

  } catch (error) {
    console.error("Connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate connection" },
      { status: 500 }
    );
  }
}
