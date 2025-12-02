import { NextRequest, NextResponse } from "next/server";

const GETLATE_API_KEY = process.env.GETLATE_API_KEY;
const GETLATE_BASE_URL = "https://getlate.dev/api/v1";

export async function GET(request: NextRequest) {
  if (!GETLATE_API_KEY) {
    return NextResponse.json(
      { error: "GetLate API key not configured" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${GETLATE_BASE_URL}/profiles`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${GETLATE_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || "Failed to fetch profiles" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching profiles:", error);
    return NextResponse.json(
      { error: "Failed to fetch profiles from GetLate API" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!GETLATE_API_KEY) {
    return NextResponse.json(
      { error: "GetLate API key not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    
    const response = await fetch(`${GETLATE_BASE_URL}/profiles`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GETLATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || "Failed to create profile" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating profile:", error);
    return NextResponse.json(
      { error: "Failed to create profile" },
      { status: 500 }
    );
  }
}






