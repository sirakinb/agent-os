
const { VertexAI } = require('@google-cloud/vertexai');
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

async function listModels() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'agentos-prod';
    const location = 'us-central1'; // Try us-central1 first

    console.log(`Listing models for project: ${projectId}, location: ${location}`);

    // Handle credentials
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        const credPath = path.join('/tmp', 'gcp-credentials.json');
        fs.writeFileSync(credPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
    }

    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // Fetch models via REST API because SDK list_models might be limited
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken.token}`
            }
        });

        if (!response.ok) {
            console.error(`Error listing models: ${response.status} ${response.statusText}`);
            console.error(await response.text());
            return;
        }

        const data = await response.json();
        const models = data.models || [];

        console.log(`Found ${models.length} models.`);

        // Filter for Gemini models
        const geminiModels = models.filter(m => m.name.includes('gemini'));

        console.log("\n--- Available Gemini Models ---");
        geminiModels.forEach(m => {
            console.log(`ID: ${m.name.split('/').pop()}`);
            console.log(`Resource Name: ${m.name}`);
            console.log(`Version: ${m.versionId}`);
            console.log("--------------------------------");
        });

    } catch (error) {
        console.error("Failed to list models:", error);
    }
}

listModels();
