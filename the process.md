# The Process: Under the Hood

Here is the exact technical workflow that happens when you upload a video to the Timestamp Generator:

## 1. File Upload & Secure Storage
*   **Action**: You drag and drop a video file.
*   **Frontend**: The file is sent via a `POST` request to `/api/upload`.
*   **Backend**: 
    *   The server temporarily buffers the file.
    *   It uses the `GoogleAIFileManager` to upload the video directly to Google's secure Generative AI storage.
    *   **Result**: A `fileUri` (e.g., `https://generativelanguage.googleapis.com/...`) is returned. This URI is a reference to the file in Google's cloud, so we don't have to send the heavy video data back and forth again.

## 2. Gemini Analysis (The "Raw" Pass)
*   **Action**: The app automatically triggers the analysis phase.
*   **Backend**: The server calls `/api/analyze` with the `fileUri`.
*   **AI Model**: We invoke **Gemini 1.5 Pro** (configured as the high-reasoning model).
*   **Prompt**: We ask Gemini to:
    > "Analyze this video and generate a comprehensive list of timestamps and chapter titles. Focus on key topics, visual changes, and important spoken content."
*   **Result**: Gemini watches the video (processing audio and visual frames) and returns a raw JSON list of timestamps and titles (e.g., `0:00 - Intro`, `2:30 - coding demo`).

## 3. Data Enrichment (YouTube Autocomplete)
*   **Action**: The app moves to the "Optimizing" phase.
*   **Backend**: The server calls `/api/refine`.
*   **Parallel Processing**: For *every single chapter title* generated in Step 2, the server fires off a request to the **YouTube Autocomplete API** (`suggestqueries.google.com`).
    *   *Input*: "coding demo"
    *   *YouTube Output*: ["coding demo for beginners", "coding demo python", "coding demo interview"]
*   **Result**: We now have a rich dataset: the original timestamp, the original AI title, and a list of real things people actually search for on YouTube related to that title.

## 4. Intelligent Refinement (Gemini 3.0)
*   **Action**: This is the "Secret Sauce" step.
*   **AI Model**: We invoke **Gemini 3.0 Pro Preview**.
*   **Prompt**: We feed it the *entire* dataset from Step 3 (timestamps + raw titles + YouTube suggestions) and give it a specific persona:
    > "You are an expert YouTube SEO strategist. Rewrite these titles to be SEO optimized, consistent, accurate, and clean."
*   **Logic**: Gemini 3.0 looks at the raw title and the suggestions.
    *   *Example*: It sees raw title "nanobana 20" and suggestion "Nano Banana 2 review". It realizes "nanobana 20" was likely a typo or misheard speech and corrects it to "Nano Banana 2".
    *   *Example*: It sees "demo 1" and replaces it with a more descriptive search term from the suggestions like "Demo 1: Git Infographic Creation".
*   **Result**: A final, polished, SEO-optimized list of chapters.

## 5. Delivery
*   **Frontend**: The React app receives the refined list.
*   **Display**: It renders the timestamps with a premium UI.
*   **Copy**: When you click "Copy All", a robust script (with fallbacks for all browser security contexts) formats the text as `Time – Title` and puts it in your clipboard, ready for YouTube.
