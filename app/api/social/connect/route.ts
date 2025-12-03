import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Social connect endpoint" });
}

export async function POST() {
  return NextResponse.json({ message: "Social connect endpoint" });
}
