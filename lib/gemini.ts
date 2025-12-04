import { VertexAI, HarmCategory, HarmBlockThreshold } from "@google-cloud/vertexai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";

// Vertex AI configuration - for production with Firebase Storage GCS URIs
const projectId = process.env.GOOGLE_CLOUD_PROJECT || "";
const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

// Initialize Vertex AI if project is configured
let vertexAI: VertexAI | null = null;
let vertexModel: ReturnType<VertexAI["getGenerativeModel"]> | null = null;

if (projectId) {
    try {
        // Parse credentials from JSON string if provided
        let googleAuthOptions: any = {};

        if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
            try {
                const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
                googleAuthOptions = {
                    credentials,
                    projectId: credentials.project_id || projectId,
                };
                console.log("Using credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON");
            } catch (e) {
                console.error("Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:", e);
            }
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            // Use file path if provided (local development)
            console.log("Using credentials from GOOGLE_APPLICATION_CREDENTIALS file");
        }

        vertexAI = new VertexAI({
            project: projectId,
            location,
            ...googleAuthOptions
        });

        vertexModel = vertexAI.getGenerativeModel({
            model: "gemini-3-pro-preview"
        });

        console.log("Vertex AI initialized for project:", projectId);
    } catch (e) {
        console.error("Failed to initialize Vertex AI:", e);
        console.error("Error details:", e instanceof Error ? e.message : String(e));
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
