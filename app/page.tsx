"use client";

import { useState } from "react";
import NextImage from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileVideo, CheckCircle, Loader2, Sparkles, Copy, Type, Image as ImageIcon, FileText, Tag, User, PanelLeftClose, PanelLeftOpen, Link2, Calendar, Send, LogOut, Cloud } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { uploadToFirebaseStorage, formatBytes, UploadProgress } from "@/lib/storage";
import { isFirebaseConfigured } from "@/lib/firebase";
import TikTokEnhance from "./components/TikTokEnhance";
import Transcription from "./components/Transcription";
import ConnectSocials from "./components/ConnectSocials";
import SchedulePost from "./components/SchedulePost";
import ContentCalendar from "./components/ContentCalendar";
import Login from "./components/Login";

type Chapter = {
  time: string;
  title: string;
  originalTitle?: string;
  suggestions?: string[];
};

type Metadata = {
  videoTitles: string[];
  thumbnailTitles: string[];
  description: string;
  tags: string;
};

export default function Home() {
  const { user, loading, signOut, isConfigured } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "optimizing" | "metadata" | "done">("idle");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [activeTab, setActiveTab] = useState<"upload" | "youtube">("upload");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState<"youtube" | "tiktok" | "transcription" | "connect" | "schedule" | "calendar">("youtube");
  
  // Detect if we're on production (Vercel) - files > 4MB need Firebase Storage
  const isProduction = typeof window !== "undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1");

  // Dropzone hook - must be called before any conditional returns
  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': [] },
    maxFiles: 1
  });

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated (only if Firebase is configured)
  if (isConfigured && !user) {
    return <Login />;
  }

  const processVideo = async () => {
    if (!file && activeTab === "upload") return;
    if (!youtubeUrl && activeTab === "youtube") return;

    try {
      console.log("Starting video processing...");
      setStatus("uploading");
      setUploadProgress(null);

      let fileUri, mimeType, transcript;

      if (activeTab === "upload" && file) {
        // Check if file is large and we're on production
        const FILE_SIZE_THRESHOLD = 4 * 1024 * 1024; // 4MB
        const useFirebaseStorage = isProduction && file.size > FILE_SIZE_THRESHOLD && isFirebaseConfigured;
        
        if (useFirebaseStorage) {
          // Production path: Upload to Firebase Storage first, then process
          console.log("Using Firebase Storage for large file upload...");
          toast.info("Uploading to cloud storage...");
          
          try {
            const { downloadUrl } = await uploadToFirebaseStorage(file, (progress) => {
              setUploadProgress(progress);
              console.log(`Upload progress: ${progress.progress.toFixed(1)}%`);
            });
            
            console.log("Firebase upload complete, processing with Gemini...");
            setUploadProgress(null);
            toast.info("Processing video with AI...");
            
            // Now send the Firebase URL to our API for Gemini processing
            const uploadRes = await fetch("/api/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                firebaseUrl: downloadUrl,
                fileName: file.name,
                mimeType: file.type,
              }),
            });
            
            if (!uploadRes.ok) {
              const errorData = await uploadRes.json();
              throw new Error(errorData.details || "Processing failed");
            }
            
            const data = await uploadRes.json();
            fileUri = data.fileUri;
            mimeType = data.mimeType;
            console.log("Gemini processing successful. File URI:", fileUri);
            
          } catch (storageError) {
            console.error("Firebase Storage error:", storageError);
            throw new Error(`Upload failed: ${storageError instanceof Error ? storageError.message : "Unknown error"}`);
          }
        } else {
          // Local/small file path: Direct upload to API
        const formData = new FormData();
        formData.append("file", file);

          console.log("Uploading file directly:", file.name);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

          if (!uploadRes.ok) {
            const errorData = await uploadRes.json();
            throw new Error(errorData.details || "Upload failed");
          }
          
        const data = await uploadRes.json();
        fileUri = data.fileUri;
        mimeType = data.mimeType;
        console.log("Upload successful. File URI:", fileUri);
        }

      } else if (activeTab === "youtube") {
        console.log("Processing YouTube URL:", youtubeUrl);
        const ytRes = await fetch("/api/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: youtubeUrl }),
        });

        if (!ytRes.ok) throw new Error("YouTube processing failed");
        const data = await ytRes.json();
        transcript = data.transcript;
        console.log("YouTube transcript fetched. Length:", transcript?.length);
      }

      setStatus("analyzing");
      console.log("Starting Gemini analysis...");
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUri, mimeType, transcript }),
      });

      if (!analyzeRes.ok) throw new Error("Analysis failed");
      const { chapters: rawChapters } = await analyzeRes.json();
      console.log("Raw chapters received:", rawChapters);

      setChapters(rawChapters);
      setStatus("optimizing");

      // Call the new Refine endpoint
      console.log("Starting optimization/refinement...");
      const refineRes = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapters: rawChapters }),
      });

      if (!refineRes.ok) throw new Error("Refinement failed");
      const { chapters: refinedChapters } = await refineRes.json();
      console.log("Refined chapters received:", refinedChapters);

      setChapters(refinedChapters);

      // Metadata Generation
      setStatus("metadata");
      console.log("Starting metadata generation...");
      const metadataRes = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUri,
          mimeType,
          transcript,
          chapterTitles: refinedChapters.map((c: any) => c.title)
        }),
      });

      if (!metadataRes.ok) throw new Error("Metadata generation failed");
      const { metadata: generatedMetadata } = await metadataRes.json();
      console.log("Metadata received:", generatedMetadata);
      setMetadata(generatedMetadata);

      setStatus("done");
      toast.success("All content generated successfully!");

    } catch (error) {
      console.error("Processing error:", error);
      toast.error("Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  const copyToClipboard = async (text: string, label: string = "content") => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast.success(`Copied ${label} to clipboard!`);
        console.log(`Copied ${label} (Async):`, text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          document.execCommand('copy');
          toast.success(`Copied ${label} to clipboard!`);
          console.log(`Copied ${label} (Fallback):`, text);
        } catch (err) {
          console.error('Fallback copy failed', err);
          toast.error(`Failed to copy ${label}`);
        }

        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error(`Failed to copy ${label}`);
    }
  };

  const copyTimestamps = () => {
    const text = chapters.map(c => `${c.time} – ${c.title}`).join("\n");
    copyToClipboard(text, "Timestamps");
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white selection:bg-indigo-500/30 flex">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="w-64 border-r border-neutral-800 bg-neutral-950/50 backdrop-blur-xl fixed h-full z-10 flex flex-col"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <NextImage
                    src="/agentOS_logo.png"
                    alt="Agent OS Logo"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                  <span className="font-bold text-lg tracking-tight">Agent OS</span>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  <PanelLeftClose className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-2">
                <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wider px-4 mb-2">Content Tools</p>
                <button
                  onClick={() => setCurrentView("youtube")}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium border shadow-sm transition-all",
                    currentView === "youtube"
                      ? "bg-white/5 text-white border-white/10"
                      : "border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                  )}
                >
                  <FileVideo className="w-5 h-5 text-indigo-400" />
                  YouTube Assets
                </button>
                <button
                  onClick={() => setCurrentView("tiktok")}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium border shadow-sm transition-all",
                    currentView === "tiktok"
                      ? "bg-white/5 text-white border-white/10"
                      : "border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                  )}
                >
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  TikTok Enhance
                </button>
                <button
                  onClick={() => setCurrentView("transcription")}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium border shadow-sm transition-all",
                    currentView === "transcription"
                      ? "bg-white/5 text-white border-white/10"
                      : "border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                  )}
                >
                  <FileText className="w-5 h-5 text-green-400" />
                  Transcription
                </button>

                {/* Divider */}
                <div className="my-4 border-t border-neutral-800" />

                <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wider px-4 mb-2">Social Media</p>
                <button
                  onClick={() => setCurrentView("connect")}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium border shadow-sm transition-all",
                    currentView === "connect"
                      ? "bg-white/5 text-white border-white/10"
                      : "border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                  )}
                >
                  <Link2 className="w-5 h-5 text-pink-400" />
                  Connect Socials
                </button>
                <button
                  onClick={() => setCurrentView("schedule")}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium border shadow-sm transition-all",
                    currentView === "schedule"
                      ? "bg-white/5 text-white border-white/10"
                      : "border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                  )}
                >
                  <Send className="w-5 h-5 text-orange-400" />
                  Upload & Schedule
                </button>
                <button
                  onClick={() => setCurrentView("calendar")}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium border shadow-sm transition-all",
                    currentView === "calendar"
                      ? "bg-white/5 text-white border-white/10"
                      : "border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                  )}
                >
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  Content Calendar
                </button>
              </nav>
            </div>

            <div className="mt-auto p-6 border-t border-neutral-800">
              {user ? (
                <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <NextImage
                        src={user.photoURL}
                        alt={user.displayName || "User"}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    ) : (
                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center">
                  <User className="w-4 h-4 text-neutral-400" />
                      </div>
                    )}
                    <div className="text-sm">
                      <p className="font-medium truncate max-w-[120px]">
                        {user.displayName || user.email?.split("@")[0] || "User"}
                      </p>
                      <p className="text-neutral-500 text-xs truncate max-w-[120px]">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-sm">
                    <p className="font-medium text-amber-400">Dev Mode</p>
                    <p className="text-neutral-500 text-xs">Firebase not configured</p>
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={cn("flex-1 p-8 transition-all duration-300", isSidebarOpen ? "ml-64" : "ml-0")}>
        <div className="max-w-5xl mx-auto">

          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="fixed top-8 left-8 p-2 bg-neutral-900/50 border border-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors z-20"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          )}

          {currentView === "tiktok" ? (
            <TikTokEnhance />
          ) : currentView === "transcription" ? (
            <Transcription />
          ) : currentView === "connect" ? (
            <ConnectSocials />
          ) : currentView === "schedule" ? (
            <SchedulePost />
          ) : currentView === "calendar" ? (
            <ContentCalendar />
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <h1 className="text-3xl font-bold text-white mb-2">
                  YouTube Assets
                </h1>
                <p className="text-neutral-400">
                  Generate SEO-optimized content from your videos.
                </p>
              </motion.div>

              <AnimatePresence mode="wait">
                {status === "idle" && (
                  <motion.div
                    key="input-area"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-1 shadow-xl"
                  >
                    <div className="bg-neutral-950/50 rounded-[20px] p-8 border border-white/5">

                      {/* Tabs */}
                      <div className="flex gap-4 mb-8 border-b border-neutral-800 pb-4">
                        <button
                          onClick={() => setActiveTab("upload")}
                          className={cn(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-all relative",
                            activeTab === "upload" ? "text-white" : "text-neutral-400 hover:text-neutral-200"
                          )}
                        >
                          Upload File
                          {activeTab === "upload" && (
                            <motion.div layoutId="activeTab" className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-indigo-500" />
                          )}
                        </button>
                        <button
                          onClick={() => setActiveTab("youtube")}
                          className={cn(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-all relative",
                            activeTab === "youtube" ? "text-white" : "text-neutral-400 hover:text-neutral-200"
                          )}
                        >
                          YouTube URL
                          {activeTab === "youtube" && (
                            <motion.div layoutId="activeTab" className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-indigo-500" />
                          )}
                        </button>
                      </div>

                      {activeTab === "upload" ? (
                        <div
                          {...getRootProps()}
                          className={cn(
                            "border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 group bg-neutral-900/20",
                            isDragActive ? "border-indigo-500 bg-indigo-500/5" : "border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/40"
                          )}
                        >
                          <input {...getInputProps()} />
                          <div className="w-20 h-20 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-105 transition-transform shadow-lg border border-white/5">
                            {file ? <FileVideo className="w-10 h-10 text-indigo-400" /> : <Upload className="w-10 h-10 text-neutral-400 group-hover:text-white transition-colors" />}
                          </div>
                          {file ? (
                            <div>
                              <p className="text-xl font-medium text-white mb-2">{file.name}</p>
                              <p className="text-sm text-neutral-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xl font-medium text-white mb-2">Drop your video here</p>
                              <p className="text-sm text-neutral-500">or click to browse (up to 10GB)</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-neutral-900/20 border border-neutral-800 rounded-2xl p-10">
                          <div className="relative max-w-2xl mx-auto">
                            <input
                              type="text"
                              placeholder="Paste YouTube URL here..."
                              value={youtubeUrl}
                              onChange={(e) => setYoutubeUrl(e.target.value)}
                              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-6 py-4 text-lg focus:outline-none focus:border-indigo-500 transition-all pl-14 shadow-inner"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500">
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" /></svg>
                            </div>
                          </div>
                          <p className="text-neutral-500 text-sm mt-6 text-center">
                            We'll fetch the transcript and generate assets automatically.
                          </p>
                        </div>
                      )}

                      {(file || (activeTab === "youtube" && youtubeUrl)) && (
                        <div className="mt-8 flex justify-end">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={processVideo}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl px-8 py-3 font-medium text-lg hover:shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center gap-2"
                          >
                            <Sparkles className="w-5 h-5" />
                            Generate Content
                          </motion.button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {(status === "uploading" || status === "analyzing" || status === "optimizing" || status === "metadata") && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-12 text-center backdrop-blur-sm"
                  >
                    <div className="relative w-24 h-24 mx-auto mb-8">
                      <div className="absolute inset-0 border-4 border-neutral-800 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        {uploadProgress ? (
                          <Cloud className="w-10 h-10 text-indigo-400" />
                        ) : (
                        <Sparkles className="w-10 h-10 text-indigo-400 animate-pulse" />
                        )}
                      </div>
                    </div>

                    <h2 className="text-3xl font-bold text-white mb-4">
                      {status === "uploading" && (activeTab === "youtube" ? "Fetching Transcript..." : uploadProgress ? "Uploading to Cloud..." : "Processing Video...")}
                      {status === "analyzing" && "Analyzing Content..."}
                      {status === "optimizing" && "Refining Timestamps..."}
                      {status === "metadata" && "Generating Metadata..."}
                    </h2>
                    
                    {/* Upload Progress Bar */}
                    {uploadProgress && status === "uploading" && (
                      <div className="max-w-md mx-auto mb-6">
                        <div className="bg-neutral-800 rounded-full h-3 overflow-hidden">
                          <motion.div
                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress.progress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <div className="flex justify-between mt-2 text-sm text-neutral-500">
                          <span>{uploadProgress.progress.toFixed(1)}%</span>
                          <span>{formatBytes(uploadProgress.bytesTransferred)} / {formatBytes(uploadProgress.totalBytes)}</span>
                        </div>
                      </div>
                    )}
                    
                    <p className="text-neutral-400 text-lg">
                      {status === "uploading" && (activeTab === "youtube" ? "Getting captions from YouTube" : uploadProgress ? "Uploading to Firebase Storage..." : "Sending to Gemini for AI processing")}
                      {status === "analyzing" && "Extracting key moments and chapters"}
                      {status === "optimizing" && "Polishing chapter titles with YouTube Data"}
                      {status === "metadata" && "Creating titles, description, and tags"}
                    </p>
                  </motion.div>
                )}

                {status === "done" && metadata && (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                  >
                    {/* Timestamps Section */}
                    <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl overflow-hidden backdrop-blur-sm shadow-xl">
                      <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                          <div className="p-2 bg-green-500/10 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          </div>
                          Optimized Timestamps
                        </h2>
                        <button
                          onClick={copyTimestamps}
                          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors border border-white/5"
                        >
                          <Copy className="w-4 h-4" />
                          Copy
                        </button>
                      </div>
                      <div className="p-8 font-mono text-sm space-y-4 max-h-[50vh] overflow-y-auto">
                        {chapters.map((chapter, idx) => (
                          <div key={idx} className="flex gap-6 group items-baseline hover:bg-white/5 p-2 rounded-lg transition-colors -mx-2">
                            <span className="text-indigo-400 font-bold min-w-[60px] text-right">{chapter.time}</span>
                            <span className="text-neutral-300 group-hover:text-white transition-colors text-base">
                              {chapter.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Video Titles */}
                      <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl overflow-hidden backdrop-blur-sm p-1 shadow-xl">
                        <div className="bg-neutral-950/50 rounded-[20px] p-6 h-full border border-white/5">
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-3">
                              <div className="p-2 bg-blue-500/10 rounded-lg">
                                <Type className="w-5 h-5 text-blue-400" />
                              </div>
                              Video Titles
                            </h3>
                          </div>
                          <div className="space-y-3">
                            {metadata.videoTitles.map((title, idx) => (
                              <div key={idx} className="flex gap-3 items-start group p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                <button
                                  onClick={() => copyToClipboard(title, "Title")}
                                  className="mt-1 p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                <p className="text-neutral-300 text-base flex-1">{title}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Thumbnail Text */}
                      <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl overflow-hidden backdrop-blur-sm p-1 shadow-xl">
                        <div className="bg-neutral-950/50 rounded-[20px] p-6 h-full border border-white/5">
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-3">
                              <div className="p-2 bg-purple-500/10 rounded-lg">
                                <ImageIcon className="w-5 h-5 text-purple-400" />
                              </div>
                              Thumbnail Text
                            </h3>
                          </div>
                          <div className="space-y-3">
                            {metadata.thumbnailTitles.map((title, idx) => (
                              <div key={idx} className="flex gap-3 items-start group p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                <button
                                  onClick={() => copyToClipboard(title, "Thumbnail Text")}
                                  className="mt-1 p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                <p className="text-neutral-300 text-base flex-1">{title}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl overflow-hidden backdrop-blur-sm p-1 shadow-xl">
                      <div className="bg-neutral-950/50 rounded-[20px] p-6 h-full border border-white/5">
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-lg font-bold text-white flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                              <FileText className="w-5 h-5 text-green-400" />
                            </div>
                            Description
                          </h3>
                          <button
                            onClick={() => copyToClipboard(metadata.description, "Description")}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors border border-white/5"
                          >
                            <Copy className="w-4 h-4" />
                            Copy
                          </button>
                        </div>
                        <div className="bg-black/30 rounded-xl p-4 text-neutral-300 whitespace-pre-wrap font-mono text-sm border border-white/5">
                          {metadata.description}
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl overflow-hidden backdrop-blur-sm p-1 shadow-xl">
                      <div className="bg-neutral-950/50 rounded-[20px] p-6 h-full border border-white/5">
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-lg font-bold text-white flex items-center gap-3">
                            <div className="p-2 bg-orange-500/10 rounded-lg">
                              <Tag className="w-5 h-5 text-orange-400" />
                            </div>
                            Tags
                          </h3>
                          <button
                            onClick={() => copyToClipboard(metadata.tags, "Tags")}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors border border-white/5"
                          >
                            <Copy className="w-4 h-4" />
                            Copy
                          </button>
                        </div>
                        <div className="bg-black/30 rounded-xl p-4 text-neutral-300 font-mono text-sm border border-white/5 leading-loose">
                          {metadata.tags}
                        </div>
                      </div>
                    </div>

                    <div className="p-8 border-t border-neutral-800 bg-neutral-900/20 text-center rounded-3xl mt-12">
                      <button
                        onClick={() => { setFile(null); setStatus("idle"); setChapters([]); setMetadata(null); }}
                        className="text-neutral-500 hover:text-white text-sm transition-colors font-medium"
                      >
                        Start Over
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
