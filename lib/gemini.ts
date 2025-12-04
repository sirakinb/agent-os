import { VertexAI } from "@google-cloud/vertexai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { writeFileSync } from "fs";
import { join } from "path";
// Import the new Gen AI SDK
const { Client } = require("@google/genai");

// Vertex AI configuration - for production with Firebase Storage GCS URIs
const projectId = process.env.GOOGLE_CLOUD_PROJECT || "";
// Gemini 3 requires global endpoint, but we set location to us-central1 and let the SDK handle it
// or we might need to set 'global' if the new SDK supports it.
// Based on docs: export GOOGLE_CLOUD_LOCATION=global
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

// Initialize new Gen AI Client (supports Gemini 3)
let genaiClient: any = null;

if (projectId) {
    try {
        // The new SDK client initialization
        genaiClient = new Client({
            vertexAi: true,
            project: projectId,
            location: 'us-central1', // Try us-central1 first, as global might be inferred or explicit
        });
        console.log("Gen AI Client initialized for project:", projectId);
    } catch (e) {
        console.error("Failed to initialize Gen AI Client:", e);
    }
}

// Legacy Vertex AI SDK (keeping for now just in case, but likely replacing usage)
let vertexAI: VertexAI | null = null;
let vertexModel: ReturnType<VertexAI["getGenerativeModel"]> | null = null;

if (projectId) {
    try {
        vertexAI = new VertexAI({
            project: projectId,
            location: 'global', // We tried global here for old SDK
        });

        vertexModel = vertexAI.getGenerativeModel({
            model: "gemini-3-pro-preview"
        });

        console.log("Legacy Vertex AI initialized");
    } catch (e) {
        console.error("Failed to initialize Legacy Vertex AI:", e);
    }
}

// Legacy Google AI SDK - for local development and Gemini File API uploads
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
export const genAI = new GoogleGenerativeAI(apiKey);
export const fileManager = new GoogleAIFileManager(apiKey);

// Export components
export { vertexAI, vertexModel, genaiClient };

// Helper to check if Vertex AI is configured
export const isVertexAIConfigured = () => !!projectId && !!genaiClient;
