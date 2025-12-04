import { NextRequest, NextResponse } from "next/server";
import { fileManager } from "@/lib/gemini";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// Note: Body size limits in Vercel serverless have hard limits (~4.5MB)
// For larger files, use Firebase Storage upload path (handled in frontend)

export async function POST(req: NextRequest) {
    let tempFilePath: string | null = null;
    
    try {
        const contentType = req.headers.get("content-type") || "";
        
        // Handle Firebase Storage URL - return GCS URI for direct Gemini use
        if (contentType.includes("application/json")) {
            const { firebaseUrl, fileName, mimeType, storagePath } = await req.json();
            
            if (!firebaseUrl && !storagePath) {
                return NextResponse.json({ error: "No Firebase URL or storage path provided" }, { status: 400 });
            }
            
            // Convert Firebase Storage path to GCS URI for Gemini
            // Firebase Storage bucket: agentos-prod.firebasestorage.app
            const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "agentos-prod.firebasestorage.app";
            const gcsUri = `gs://${bucket}/${storagePath}`;
            
            console.log("Using GCS URI for Gemini:", gcsUri);
            
            // Return the GCS URI - Gemini can use this directly
            return NextResponse.json({
                success: true,
                fileUri: gcsUri,
                name: fileName || "uploaded-video",
                mimeType: mimeType || "video/mp4",
                isGcsUri: true,
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
