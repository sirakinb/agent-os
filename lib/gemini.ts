import { VertexAI } from "@google-cloud/vertexai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";

// Vertex AI configuration - for production with Firebase Storage GCS URIs
const projectId = process.env.GOOGLE_CLOUD_PROJECT || "";
const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

// Handle credentials from environment variable (for Vercel)
// Parse GOOGLE_APPLICATION_CREDENTIALS_JSON if provided
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
        // Write credentials to a temp file for the SDK to pick up
        // This is a common pattern for serverless environments
        const fs = require('fs');
        const path = require('path');
        const credPath = path.join('/tmp', 'gcp-credentials.json');
        fs.writeFileSync(credPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
    } catch (e) {
        console.error("Failed to write GCP credentials:", e);
    }
}

// Initialize Vertex AI if project is configured
let vertexAI: VertexAI | null = null;
let vertexModel: ReturnType<VertexAI["getGenerativeModel"]> | null = null;

if (projectId) {
    try {
        vertexAI = new VertexAI({ project: projectId, location });
        vertexModel = vertexAI.getGenerativeModel({ model: "gemini-3-pro-preview" });
        console.log("Vertex AI initialized for project:", projectId);
    } catch (e) {
        console.error("Failed to initialize Vertex AI:", e);
    }
}

// Legacy Google AI SDK - for local development and Gemini File API uploads
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
export const genAI = new GoogleGenerativeAI(apiKey);
export const fileManager = new GoogleAIFileManager(apiKey);

// Export Vertex AI components
export { vertexAI, vertexModel };

// Helper to check if Vertex AI is configured
export const isVertexAIConfigured = () => !!projectId && !!vertexAI;
