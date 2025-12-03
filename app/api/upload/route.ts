import { NextRequest, NextResponse } from "next/server";
import { fileManager } from "@/lib/gemini";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

// Note: Body size limits in Vercel serverless have hard limits (~4.5MB)
// For larger files, use Firebase Storage upload path (handled in frontend)

// Helper to download file from URL to temp location
async function downloadToTemp(url: string, filename: string): Promise<string> {
    const tempDir = join(tmpdir(), "content-studio-uploads");
    await mkdir(tempDir, { recursive: true });
    
    const tempFilePath = join(tempDir, `${Date.now()}-${filename}`);
    
    const response = await fetch(url);
    if (!response.ok || !response.body) {
        throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    // Stream the response to a file
    const writeStream = createWriteStream(tempFilePath);
    const readable = Readable.fromWeb(response.body as any);
    await pipeline(readable, writeStream);
    
    return tempFilePath;
}

export async function POST(req: NextRequest) {
    let tempFilePath: string | null = null;
    
    try {
        const contentType = req.headers.get("content-type") || "";
        
        // Handle Firebase Storage URL upload
        if (contentType.includes("application/json")) {
            const { firebaseUrl, fileName, mimeType } = await req.json();
            
            if (!firebaseUrl) {
                return NextResponse.json({ error: "No Firebase URL provided" }, { status: 400 });
            }
            
            console.log("Downloading from Firebase Storage:", fileName);
            tempFilePath = await downloadToTemp(firebaseUrl, fileName || "video.mp4");
            
            console.log("Uploading to Gemini File Manager...");
            const uploadResponse = await fileManager.uploadFile(tempFilePath, {
                mimeType: mimeType || "video/mp4",
                displayName: fileName || "uploaded-video",
            });
            
            // Clean up temp file
            await unlink(tempFilePath);
            tempFilePath = null;
            
            return NextResponse.json({
                success: true,
                fileUri: uploadResponse.file.uri,
                name: uploadResponse.file.name,
                mimeType: uploadResponse.file.mimeType,
            });
        }
        
        // Handle direct file upload (FormData) - works locally
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        console.log("Processing direct upload:", file.name, "Size:", file.size);
        
        // Buffer the file and write to temp
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        tempFilePath = join(tmpdir(), `upload-${Date.now()}-${file.name}`);
        await writeFile(tempFilePath, buffer);

        console.log("Uploading to Gemini File Manager...");
        const uploadResponse = await fileManager.uploadFile(tempFilePath, {
            mimeType: file.type,
            displayName: file.name,
        });

        // Clean up temp file
        await unlink(tempFilePath);
        tempFilePath = null;

        return NextResponse.json({
            success: true,
            fileUri: uploadResponse.file.uri,
            name: uploadResponse.file.name,
            mimeType: uploadResponse.file.mimeType,
        });

    } catch (error) {
        console.error("Upload error:", error);
        
        // Clean up temp file on error
        if (tempFilePath) {
            try {
                await unlink(tempFilePath);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        
        return NextResponse.json({ 
            error: "Upload failed", 
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
