"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileVideo, Sparkles, Plus, TrendingUp, MessageSquare, Save, Share2, Heart, Type } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadToFirebaseStorage, UploadProgress } from "@/lib/storage";

export default function TikTokEnhance() {
    const [activeTab, setActiveTab] = useState<"train" | "analyze">("train");
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "done">("idle");
    const [uploadProgress, setUploadProgress] = useState(0);
    const [result, setResult] = useState<any>(null);

    // Stats for Training
    const [stats, setStats] = useState({
        likes: "",
        saves: "",
        comments: "",
        shares: ""
    });

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

    const uploadAndGetUri = async (): Promise<{ fileUri: string; mimeType: string; isGcsUri: boolean }> => {
        if (!file) throw new Error("No file selected");

        // Step 1: Upload to Firebase Storage
        setStatus("uploading");
        setUploadProgress(0);

        console.log("Uploading to Firebase Storage...");
        const { storagePath } = await uploadToFirebaseStorage(file, (progress: UploadProgress) => {
            setUploadProgress(Math.round(progress.progress));
        });

        console.log("Firebase upload complete, storage path:", storagePath);

        // Step 2: Register with backend to get GCS URI
        const uploadRes = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                storagePath,
                fileName: file.name,
                mimeType: file.type,
            }),
        });

        if (!uploadRes.ok) {
            throw new Error("Failed to register upload");
        }

        const uploadData = await uploadRes.json();
        console.log("Upload registered, fileUri:", uploadData.fileUri);

        return {
            fileUri: uploadData.fileUri,
            mimeType: uploadData.mimeType,
            isGcsUri: uploadData.isGcsUri,
        };
    };

    const handleTrain = async () => {
        if (!file) return;

        try {
            const { fileUri, mimeType, isGcsUri } = await uploadAndGetUri();

            setStatus("processing");

            const res = await fetch("/api/tiktok/train", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fileUri,
                    mimeType,
                    isGcsUri,
                    stats: {
                        likes: stats.likes,
                        saves: stats.saves,
                        comments: stats.comments,
                        shares: stats.shares,
                    },
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.details || "Training failed");
            }

            await res.json();
            toast.success("Video added to Knowledge Base!");
            setFile(null);
            setStats({ likes: "", saves: "", comments: "", shares: "" });
            setStatus("idle");

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Something went wrong");
            setStatus("idle");
        }
    };

    const handleAnalyze = async () => {
        if (!file) return;

        try {
            const { fileUri, mimeType, isGcsUri } = await uploadAndGetUri();

            setStatus("processing");

            const res = await fetch("/api/tiktok/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fileUri,
                    mimeType,
                    isGcsUri,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.details || "Analysis failed");
            }

            const data = await res.json();
            setResult(data.analysis);
            setStatus("done");
            toast.success("Analysis complete!");

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Analysis failed");
            setStatus("idle");
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <h1 className="text-3xl font-bold text-white mb-2">
                    TikTok Enhance
                </h1>
                <p className="text-neutral-400">
                    Train AI on your best videos to get tailored feedback for new ones.
                </p>
            </motion.div>

            <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-1 shadow-xl mb-8">
                <div className="bg-neutral-950/50 rounded-[20px] p-8 border border-white/5">
                    {/* Tabs */}
                    <div className="flex gap-4 mb-8 border-b border-neutral-800 pb-4">
                        <button
                            onClick={() => { setActiveTab("train"); setStatus("idle"); setFile(null); setResult(null); }}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all relative",
                                activeTab === "train" ? "text-white" : "text-neutral-400 hover:text-neutral-200"
                            )}
                        >
                            Knowledge Base
                            {activeTab === "train" && (
                                <motion.div layoutId="activeTabTikTok" className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-indigo-500" />
                            )}
                        </button>
                        <button
                            onClick={() => { setActiveTab("analyze"); setStatus("idle"); setFile(null); setResult(null); }}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all relative",
                                activeTab === "analyze" ? "text-white" : "text-neutral-400 hover:text-neutral-200"
                            )}
                        >
                            Optimize New Video
                            {activeTab === "analyze" && (
                                <motion.div layoutId="activeTabTikTok" className="absolute bottom-[-17px] left-0 right-0 h-0.5 bg-indigo-500" />
                            )}
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        {status === "uploading" ? (
                            <motion.div
                                key="uploading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="py-20 text-center"
                            >
                                <div className="relative w-24 h-24 mx-auto mb-8">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle
                                            cx="48"
                                            cy="48"
                                            r="40"
                                            stroke="currentColor"
                                            strokeWidth="8"
                                            fill="none"
                                            className="text-neutral-800"
                                        />
                                        <circle
                                            cx="48"
                                            cy="48"
                                            r="40"
                                            stroke="currentColor"
                                            strokeWidth="8"
                                            fill="none"
                                            strokeDasharray={251.2}
                                            strokeDashoffset={251.2 - (251.2 * uploadProgress) / 100}
                                            className="text-indigo-500 transition-all duration-300"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-2xl font-bold text-white">{uploadProgress}%</span>
                                    </div>
                                </div>
                                <h2 className="text-2xl font-semibold text-white mb-2">
                                    Uploading video...
                                </h2>
                                <p className="text-neutral-400">
                                    {file?.name}
                                </p>
                            </motion.div>
                        ) : status === "processing" ? (
                            <motion.div
                                key="processing"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="py-20 text-center"
                            >
                                <div className="relative w-20 h-20 mx-auto mb-8">
                                    <div className="absolute inset-0 border-4 border-neutral-800 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-semibold text-white mb-2">
                                    {activeTab === "train" ? "Analyzing & Storing..." : "Generating Feedback..."}
                                </h2>
                                <p className="text-neutral-400">
                                    {activeTab === "train" ? "Extracting insights from your video." : "Comparing with your top performers."}
                                </p>
                            </motion.div>
                        ) : status === "done" && result ? (
                            <motion.div
                                key="results"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-8"
                            >
                                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-indigo-400" />
                                            AI Feedback
                                        </h3>
                                        <div className="bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-sm font-bold border border-indigo-500/20">
                                            Viral Score: {result.score}/10
                                        </div>
                                    </div>
                                    <p className="text-neutral-300 leading-relaxed">{result.feedback}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5 text-green-400" />
                                            Viral Hooks
                                        </h3>
                                        <ul className="space-y-3">
                                            {result.viralHooks?.map((hook: string, i: number) => (
                                                <li key={i} className="flex gap-3 text-neutral-300">
                                                    <span className="text-neutral-500 font-mono">{i + 1}.</span>
                                                    {hook}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                            <Type className="w-5 h-5 text-purple-400" />
                                            Thumbnail Text
                                        </h3>
                                        <ul className="space-y-3">
                                            {result.thumbnailText?.map((text: string, i: number) => (
                                                <li key={i} className="flex gap-3 text-neutral-300">
                                                    <span className="text-neutral-500 font-mono">{i + 1}.</span>
                                                    {text}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                                    <h3 className="text-lg font-bold text-white mb-4">Improved Script</h3>
                                    <div className="bg-black/30 rounded-xl p-4 text-neutral-300 whitespace-pre-wrap font-mono text-sm border border-white/5">
                                        {result.improvedScript}
                                    </div>
                                </div>

                                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                                    <h3 className="text-lg font-bold text-white mb-4">Suggested Caption</h3>
                                    <div className="bg-black/30 rounded-xl p-4 text-neutral-300 whitespace-pre-wrap font-mono text-sm border border-white/5">
                                        {result.caption}
                                    </div>
                                </div>

                                <button
                                    onClick={() => { setStatus("idle"); setFile(null); setResult(null); }}
                                    className="w-full py-4 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-all font-medium"
                                >
                                    Analyze Another Video
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="upload"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <div
                                    {...getRootProps()}
                                    className={cn(
                                        "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 group bg-neutral-900/20 mb-8",
                                        isDragActive ? "border-indigo-500 bg-indigo-500/5" : "border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/40"
                                    )}
                                >
                                    <input {...getInputProps()} />
                                    <div className="w-16 h-16 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-105 transition-transform shadow-lg border border-white/5">
                                        {file ? <FileVideo className="w-8 h-8 text-indigo-400" /> : <Upload className="w-8 h-8 text-neutral-400 group-hover:text-white transition-colors" />}
                                    </div>
                                    {file ? (
                                        <div>
                                            <p className="text-xl font-medium text-white mb-2">{file.name}</p>
                                            <p className="text-sm text-neutral-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-xl font-medium text-white mb-2">
                                                {activeTab === "train" ? "Upload a past successful video" : "Upload your new raw video"}
                                            </p>
                                            <p className="text-sm text-neutral-500">or click to browse</p>
                                        </div>
                                    )}
                                </div>

                                {activeTab === "train" && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                        <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800">
                                            <label className="block text-xs text-neutral-500 mb-2 font-medium uppercase tracking-wider flex items-center gap-1">
                                                <Heart className="w-3 h-3" /> Likes
                                            </label>
                                            <input
                                                type="number"
                                                value={stats.likes}
                                                onChange={(e) => setStats({ ...stats, likes: e.target.value })}
                                                className="w-full bg-transparent text-white font-mono focus:outline-none"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800">
                                            <label className="block text-xs text-neutral-500 mb-2 font-medium uppercase tracking-wider flex items-center gap-1">
                                                <Save className="w-3 h-3" /> Saves
                                            </label>
                                            <input
                                                type="number"
                                                value={stats.saves}
                                                onChange={(e) => setStats({ ...stats, saves: e.target.value })}
                                                className="w-full bg-transparent text-white font-mono focus:outline-none"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800">
                                            <label className="block text-xs text-neutral-500 mb-2 font-medium uppercase tracking-wider flex items-center gap-1">
                                                <MessageSquare className="w-3 h-3" /> Comments
                                            </label>
                                            <input
                                                type="number"
                                                value={stats.comments}
                                                onChange={(e) => setStats({ ...stats, comments: e.target.value })}
                                                className="w-full bg-transparent text-white font-mono focus:outline-none"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800">
                                            <label className="block text-xs text-neutral-500 mb-2 font-medium uppercase tracking-wider flex items-center gap-1">
                                                <Share2 className="w-3 h-3" /> Shares
                                            </label>
                                            <input
                                                type="number"
                                                value={stats.shares}
                                                onChange={(e) => setStats({ ...stats, shares: e.target.value })}
                                                className="w-full bg-transparent text-white font-mono focus:outline-none"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                )}

                                {file && (
                                    <div className="flex justify-end">
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={activeTab === "train" ? handleTrain : handleAnalyze}
                                            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl px-8 py-3 font-medium text-lg hover:shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center gap-2"
                                        >
                                            <Sparkles className="w-5 h-5" />
                                            {activeTab === "train" ? "Add to Knowledge Base" : "Generate Feedback"}
                                        </motion.button>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
