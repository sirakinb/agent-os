import { NextRequest, NextResponse } from "next/server";

const GETLATE_API_KEY = process.env.GETLATE_API_KEY;
const GETLATE_BASE_URL = "https://getlate.dev/api/v1";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");

  if (!GETLATE_API_KEY) {
    return NextResponse.json(
      { error: "GetLate API key not configured" },
      { status: 500 }
    );
  }

  try {
    let url = `${GETLATE_BASE_URL}/accounts`;
    if (platform) {
      url += `?platform=${platform}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${GETLATE_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || "Failed to fetch accounts" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts from GetLate API" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  if (!accountId) {
    return NextResponse.json(
      { error: "Account ID is required" },
      { status: 400 }
    );
  }

  if (!GETLATE_API_KEY) {
    return NextResponse.json(
      { error: "GetLate API key not configured" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `${GETLATE_BASE_URL}/accounts/${accountId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${GETLATE_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || "Failed to disconnect account" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting account:", error);
    return NextResponse.json(
      { error: "Failed to disconnect account" },
      { status: 500 }
    );
  }
}






