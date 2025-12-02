"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileVideo, FileText, Download, Copy, CheckCircle, Loader2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Transcription() {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<"idle" | "processing" | "done">("idle");
    const [transcript, setTranscript] = useState<string>("");
    const [srt, setSrt] = useState<string>("");
    const [loadingMessage, setLoadingMessage] = useState("Uploading video to AI...");

    const loadingMessages = [
        "Uploading video to AI...",
        "Processing audio track...",
        "Analyzing speech patterns...",
        "Generating transcript...",
        "Formatting SRT file...",
        "Finalizing results..."
    ];

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === "processing") {
            let i = 0;
            setLoadingMessage(loadingMessages[0]);
            interval = setInterval(() => {
                i = (i + 1) % loadingMessages.length;
                setLoadingMessage(loadingMessages[i]);
            }, 3000); // Change message every 3 seconds
        }
        return () => clearInterval(interval);
    }, [status]);

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

    const handleTranscribe = async () => {
        if (!file) return;
        setStatus("processing");
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/transcribe", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.details || "Transcription failed");
            }
            const data = await res.json();
            setTranscript(data.transcript);
            setSrt(data.srt);
            setStatus("done");
            toast.success("Transcription complete!");
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Something went wrong");
            setStatus("idle");
        }
    };

    const downloadSrt = () => {
        if (!srt) return;
        const blob = new Blob([srt], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${file?.name.split('.')[0] || "transcript"}.srt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("SRT file downloaded");
    };

    const copyTranscript = () => {
        navigator.clipboard.writeText(transcript);
        toast.success("Transcript copied to clipboard");
    };

    return (
        <div className="max-w-4xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <h1 className="text-3xl font-bold text-white mb-2">
                    Transcription
                </h1>
                <p className="text-neutral-400">
                    Generate full transcripts and SRT subtitles from your videos.
                </p>
            </motion.div>

            <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-1 shadow-xl mb-8">
                <div className="bg-neutral-950/50 rounded-[20px] p-8 border border-white/5">

                    <AnimatePresence mode="wait">
                        {status === "processing" ? (
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
                                        <FileText className="w-8 h-8 text-indigo-400 animate-pulse" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-semibold text-white mb-2">
                                    {loadingMessage}
                                </h2>
                                <p className="text-neutral-400">
                                    This may take a minute depending on video length.
                                </p>
                            </motion.div>
                        ) : status === "done" ? (
                            <motion.div
                                key="results"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-8"
                            >
                                <div className="flex gap-4">
                                    <button
                                        onClick={downloadSrt}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-5 h-5" />
                                        Download SRT
                                    </button>
                                    <button
                                        onClick={() => { setStatus("idle"); setFile(null); setTranscript(""); setSrt(""); }}
                                        className="px-6 py-3 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-all font-medium"
                                    >
                                        New Transcription
                                    </button>
                                </div>

                                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-indigo-400" />
                                            Full Transcript
                                        </h3>
                                        <button onClick={copyTranscript} className="text-neutral-400 hover:text-white transition-colors">
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="bg-black/30 rounded-xl p-6 text-neutral-300 whitespace-pre-wrap font-mono text-sm border border-white/5 leading-relaxed max-h-[500px] overflow-y-auto">
                                        {transcript}
                                    </div>
                                </div>
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
                                                Upload video for transcription
                                            </p>
                                            <p className="text-sm text-neutral-500">or click to browse</p>
                                        </div>
                                    )}
                                </div>

                                {file && (
                                    <div className="flex justify-end">
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleTranscribe}
                                            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl px-8 py-3 font-medium text-lg hover:shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center gap-2"
                                        >
                                            <FileText className="w-5 h-5" />
                                            Start Transcription
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
