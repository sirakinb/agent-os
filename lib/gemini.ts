import { VertexAI } from "@google-cloud/vertexai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { writeFileSync } from "fs";
import { join } from "path";
// Import the new Gen AI SDK
const { Client } = require("@google/genai");

// Vertex AI configuration - for production with Firebase Storage GCS URIs
const projectId = process.env.GOOGLE_CLOUD_PROJECT || "";
const location = "us-central1";

// Handle credentials from environment variable (for Vercel)
// Vertex AI SDK uses Application Default Credentials (ADC)
// We need to write the JSON to a file and set GOOGLE_APPLICATION_CREDENTIALS
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
        console.log("Found GOOGLE_APPLICATION_CREDENTIALS_JSON, length:", process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON.length);
        const credPath = join('/tmp', 'gcp-credentials.json');
        writeFileSync(credPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
        console.log("Wrote GCP credentials to:", credPath);

        // Verify file exists
        const fs = require('fs');
        if (fs.existsSync(credPath)) {
            console.log("Credential file verified at:", credPath, "Size:", fs.statSync(credPath).size);
        } else {
            console.error("Credential file NOT found after writing!");
        }
    } catch (e) {
        console.error("Failed to write GCP credentials:", e);
    }
} else {
    console.log("GOOGLE_APPLICATION_CREDENTIALS_JSON not found in env");
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.log("Using existing GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS);
    } else {
        console.warn("No credentials found in environment!");
    }
}

// Initialize new Gen AI Client (supports Gemini 3 via Google AI Studio)
let genaiClient: any = null;
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

try {
    // Initialize with API Key for Google AI Studio access (Gemini 3)
    genaiClient = new Client({
        apiKey: apiKey,
    });
    console.log("Gen AI Client initialized (Google AI Studio)");
} catch (e) {
    console.error("Failed to initialize Gen AI Client:", e);
}

// Legacy Vertex AI SDK - for GCS File Access (The Eyes)
let vertexAI: VertexAI | null = null;
let vertexModel: ReturnType<VertexAI["getGenerativeModel"]> | null = null;

if (projectId) {
    try {
        vertexAI = new VertexAI({
            project: projectId,
            location: location,
        });

        // Use Gemini 1.5 Pro (stable) for robust video processing and GCS access
        vertexModel = vertexAI.getGenerativeModel({
            model: "gemini-1.5-pro"
        });

        console.log("Vertex AI initialized (Gemini 1.5 Pro)");
    } catch (e) {
        console.error("Failed to initialize Vertex AI:", e);
    }
}

// Legacy Google AI SDK - for local development and Gemini File API uploads
export const genAI = new GoogleGenerativeAI(apiKey);
export const fileManager = new GoogleAIFileManager(apiKey);

// Export components
export { vertexAI, vertexModel, genaiClient };

// Helper to check if Vertex AI is configured
export const isVertexAIConfigured = () => !!projectId && !!vertexModel;
