import { NextRequest, NextResponse } from "next/server";

const GETLATE_API_KEY = process.env.GETLATE_API_KEY;
const GETLATE_BASE_URL = "https://getlate.dev/api/v1";

export async function POST(request: NextRequest) {
  if (!GETLATE_API_KEY) {
    return NextResponse.json(
      { error: "GetLate API key not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const {
      content,
      scheduledFor,
      timezone,
      platforms,
      mediaItems,
      profileId,
      postType,
      platformSpecificData,
    } = body;

    // Validate required fields
    if (!platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: "At least one platform is required" },
        { status: 400 }
      );
    }

    // Build the post payload
    const postPayload: any = {
      content: content || "",
      platforms: platforms.map((p: any) => ({
        platform: p.platform,
        accountId: p.accountId,
        ...(p.platformSpecificData && { platformSpecificData: p.platformSpecificData }),
      })),
    };

    // Add optional fields
    if (scheduledFor) {
      postPayload.scheduledFor = scheduledFor;
    }
    if (timezone) {
      postPayload.timezone = timezone;
    }
    // GetLate uses mediaItems with {type, url} format
    if (mediaItems && mediaItems.length > 0) {
      postPayload.mediaItems = mediaItems;
    }
    if (profileId) {
      postPayload.queuedFromProfile = profileId;
    }

    // Handle Instagram-specific post types
    if (postType === "reel") {
      postPayload.platforms = postPayload.platforms.map((p: any) => {
        if (p.platform === "instagram") {
          return {
            ...p,
            platformSpecificData: {
              ...p.platformSpecificData,
              mediaType: "REELS",
              ...platformSpecificData,
            },
          };
        }
        return p;
      });
    } else if (postType === "story") {
      postPayload.platforms = postPayload.platforms.map((p: any) => {
        if (p.platform === "instagram") {
          return {
            ...p,
            platformSpecificData: {
              ...p.platformSpecificData,
              contentType: "story",
              ...platformSpecificData,
            },
          };
        }
        return p;
      });
    }

    const response = await fetch(`${GETLATE_BASE_URL}/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GETLATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("GetLate post creation error:", errorData);
      return NextResponse.json(
        { error: errorData.error || errorData.message || "Failed to create post", details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating post:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (!GETLATE_API_KEY) {
    return NextResponse.json(
      { error: "GetLate API key not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const platform = searchParams.get("platform");
  const limit = searchParams.get("limit") || "50";
  const page = searchParams.get("page") || "1";

  try {
    let url = `${GETLATE_BASE_URL}/posts?limit=${limit}&page=${page}`;
    if (status) url += `&status=${status}`;
    if (platform) url += `&platform=${platform}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${GETLATE_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || "Failed to fetch posts" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!GETLATE_API_KEY) {
    return NextResponse.json(
      { error: "GetLate API key not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("postId");

  if (!postId) {
    return NextResponse.json(
      { error: "Post ID is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${GETLATE_BASE_URL}/posts/${postId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${GETLATE_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || "Failed to delete post" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting post:", error);
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    );
  }
}

