"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Calendar,
  Clock,
  Image as ImageIcon,
  Film,
  Send,
  Loader2,
  X,
  Instagram,
  CheckCircle,
  AlertCircle,
  Plus,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadToFirebaseStorage, UploadProgress } from "@/lib/storage";

type Account = {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  profilePicture?: string;
};

type MediaFile = {
  file: File;
  preview: string;
  uploadedUrl?: string;
  isUploading?: boolean;
};

type PostType = "post" | "reel" | "story";

export default function SchedulePost() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [caption, setCaption] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [postType, setPostType] = useState<PostType>("post");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [isPostNow, setIsPostNow] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/social/accounts?platform=instagram");
      if (!response.ok) throw new Error("Failed to fetch accounts");
      const data = await response.json();
      const igAccounts = (data.accounts || []).filter(
        (a: Account) => a.platform === "instagram"
      );
      setAccounts(igAccounts);
      if (igAccounts.length === 1) {
        setSelectedAccount(igAccounts[0]);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles: MediaFile[] = acceptedFiles.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        isUploading: true,
      }));

      setMediaFiles((prev) => [...prev, ...newFiles]);

      // Upload each file to Firebase Storage first, then use public URL
      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];
        try {
          // Upload to Firebase Storage
          const { storagePath, downloadUrl } = await uploadToFirebaseStorage(
            file.file,
            (progress: UploadProgress) => {
              // Could show upload progress per file here
              console.log(`Upload progress for ${file.file.name}: ${progress.progress}%`);
            }
          );

          // Use the public download URL
          const publicUrl = downloadUrl;

          setMediaFiles((prev) =>
            prev.map((f) =>
              f.preview === file.preview
                ? { ...f, uploadedUrl: publicUrl, isUploading: false }
                : f
            )
          );
          toast.success(`Uploaded ${file.file.name}`);
        } catch (error) {
          console.error("Upload error:", error);
          toast.error(`Failed to upload ${file.file.name}`);
          setMediaFiles((prev) => prev.filter((f) => f.preview !== file.preview));
        }
      }
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"],
      "video/*": [".mp4", ".mov", ".avi"],
    },
    maxFiles: postType === "reel" || postType === "story" ? 1 : 10,
  });

  const removeMedia = (preview: string) => {
    setMediaFiles((prev) => {
      const updated = prev.filter((f) => f.preview !== preview);
      URL.revokeObjectURL(preview);
      return updated;
    });
  };

  const handleSubmit = async (postNow: boolean = false) => {
    if (!selectedAccount) {
      toast.error("Please select an Instagram account");
      return;
    }

    if (!caption.trim() && mediaFiles.length === 0) {
      toast.error("Please add a caption or media");
      return;
    }

    if (postType === "reel" && mediaFiles.length === 0) {
      toast.error("Reels require a video");
      return;
    }

    // For Instagram, media is required
    if (mediaFiles.length === 0) {
      toast.error("Instagram posts require at least one image or video");
      return;
    }

    const pendingUploads = mediaFiles.filter((f) => f.isUploading);
    if (pendingUploads.length > 0) {
      toast.error("Please wait for media uploads to complete");
      return;
    }

    const filesWithoutUrl = mediaFiles.filter((f) => !f.uploadedUrl);
    if (filesWithoutUrl.length > 0) {
      toast.error("Some files failed to upload. Please remove them and try again.");
      return;
    }

    if (!postNow && (!scheduleDate || !scheduleTime)) {
      toast.error("Please select a date and time to schedule");
      return;
    }

    setIsPosting(true);
    setIsPostNow(postNow);

    try {
      // Build mediaItems array with type and url
      const mediaItems = mediaFiles
        .filter((f) => f.uploadedUrl)
        .map((f) => ({
          type: f.file.type.startsWith("video/") ? "video" : "image",
          url: f.uploadedUrl,
        }));

      const payload: any = {
        content: caption,
        platforms: [
          {
            platform: "instagram",
            accountId: selectedAccount._id,
          },
        ],
        mediaItems,
      };

      if (!postNow) {
        const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
        payload.scheduledFor = scheduledDateTime.toISOString();
        payload.timezone = timezone;
      }

      if (postType === "reel") {
        payload.postType = "reel";
      } else if (postType === "story") {
        payload.postType = "story";
      }

      const response = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create post");
      }

      toast.success(
        postNow ? "Post published successfully!" : "Post scheduled successfully!"
      );

      // Reset form
      setCaption("");
      setMediaFiles([]);
      setScheduleDate("");
      setScheduleTime("");
    } catch (error: any) {
      console.error("Error creating post:", error);
      toast.error(error.message || "Failed to create post");
    } finally {
      setIsPosting(false);
      setIsPostNow(false);
    }
  };

  const postTypeOptions: { value: PostType; label: string; icon: any }[] = [
    { value: "post", label: "Feed Post", icon: ImageIcon },
    { value: "reel", label: "Reel", icon: Film },
    { value: "story", label: "Story", icon: Plus },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">Schedule Post</h1>
          <p className="text-neutral-400">
            Create and schedule posts for your Instagram account.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-12 text-center"
        >
          <div className="w-16 h-16 bg-neutral-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Instagram className="w-8 h-8 text-neutral-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            No Instagram account connected
          </h3>
          <p className="text-neutral-400 text-sm max-w-md mx-auto mb-6">
            Connect your Instagram account first to start creating and scheduling
            posts.
          </p>
          <button
            onClick={() => {
              // Navigate to connect socials - would need to be handled by parent
              window.location.hash = "connect";
            }}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-pink-500/20 transition-all"
          >
            Connect Instagram Account
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-white mb-2">Schedule Post</h1>
        <p className="text-neutral-400">
          Create and schedule posts for your Instagram account.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 space-y-6"
        >
          {/* Account Selection */}
          <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-6">
            <label className="block text-sm font-medium text-neutral-400 mb-4">
              Select Account
            </label>
            <div className="flex flex-wrap gap-3">
              {accounts.map((account) => (
                <button
                  key={account._id}
                  onClick={() => setSelectedAccount(account)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                    selectedAccount?._id === account._id
                      ? "bg-white/5 border-pink-500/50 text-white"
                      : "border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white"
                  )}
                >
                  {account.profilePicture ? (
                    <img
                      src={account.profilePicture}
                      alt=""
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full flex items-center justify-center">
                      <Instagram className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <span className="font-medium">
                    @{account.username || "Instagram"}
                  </span>
                  {selectedAccount?._id === account._id && (
                    <CheckCircle className="w-4 h-4 text-pink-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Post Type Selection */}
          <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-6">
            <label className="block text-sm font-medium text-neutral-400 mb-4">
              Post Type
            </label>
            <div className="flex gap-3">
              {postTypeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setPostType(option.value)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-3 rounded-xl border transition-all flex-1",
                    postType === option.value
                      ? "bg-white/5 border-pink-500/50 text-white"
                      : "border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white"
                  )}
                >
                  <option.icon className="w-5 h-5" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Media Upload */}
          <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-6">
            <label className="block text-sm font-medium text-neutral-400 mb-4">
              Media{" "}
              {postType === "reel" && (
                <span className="text-pink-400">(Required for Reels)</span>
              )}
            </label>

            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
                isDragActive
                  ? "border-pink-500 bg-pink-500/5"
                  : "border-neutral-800 hover:border-neutral-700"
              )}
            >
              <input {...getInputProps()} />
              <div className="w-14 h-14 bg-neutral-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Upload className="w-7 h-7 text-neutral-400" />
              </div>
              <p className="text-white font-medium mb-1">
                Drop files here or click to upload
              </p>
              <p className="text-sm text-neutral-500">
                {postType === "reel"
                  ? "Video files only (MP4, MOV)"
                  : "Images and videos (JPEG, PNG, MP4)"}
              </p>
            </div>

            {/* Media Preview */}
            {mediaFiles.length > 0 && (
              <div className="mt-4 grid grid-cols-4 gap-3">
                <AnimatePresence mode="popLayout">
                  {mediaFiles.map((media) => (
                    <motion.div
                      key={media.preview}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative aspect-square rounded-xl overflow-hidden bg-neutral-800"
                    >
                      {media.file.type.startsWith("video/") ? (
                        <video
                          src={media.preview}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={media.preview}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                      {media.isUploading && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                      {!media.isUploading && (
                        <button
                          onClick={() => removeMedia(media.preview)}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Caption - Not available for Stories */}
          {postType !== "story" && (
            <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-6">
              <label className="block text-sm font-medium text-neutral-400 mb-4">
                Caption
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write your caption here..."
                rows={6}
                className="w-full bg-neutral-950/50 border border-neutral-800 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:border-pink-500/50 resize-none transition-colors"
              />
              <div className="flex justify-between items-center mt-3">
                <p className="text-xs text-neutral-500">
                  {caption.length} / 2,200 characters
                </p>
              </div>
            </div>
          )}

          {/* Story Notice */}
          {postType === "story" && (
            <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-6">
              <div className="flex items-center gap-3 text-neutral-400">
                <div className="p-2 bg-pink-500/10 rounded-lg">
                  <ImageIcon className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Stories don't support captions</p>
                  <p className="text-sm">Add text overlays directly to your image or video instead.</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Sidebar - Schedule */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Schedule Options */}
          <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-6 sticky top-8">
            <h3 className="text-lg font-semibold text-white mb-6">
              Schedule Post
            </h3>

            <div className="space-y-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Date
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full bg-neutral-950/50 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500/50 transition-colors"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Time
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full bg-neutral-950/50 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500/50 transition-colors"
                />
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-neutral-950/50 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500/50 transition-colors"
                >
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Asia/Dubai">Dubai (GST)</option>
                  <option value="Australia/Sydney">Sydney (AEST)</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 space-y-3">
              <button
                onClick={() => handleSubmit(false)}
                disabled={isPosting}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium transition-all",
                  isPosting && !isPostNow
                    ? "bg-neutral-800 text-neutral-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white hover:shadow-lg hover:shadow-pink-500/20"
                )}
              >
                {isPosting && !isPostNow ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Calendar className="w-5 h-5" />
                    Schedule Post
                  </>
                )}
              </button>

              <button
                onClick={() => handleSubmit(true)}
                disabled={isPosting}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium border transition-all",
                  isPosting && isPostNow
                    ? "bg-neutral-800 border-neutral-700 text-neutral-400 cursor-not-allowed"
                    : "bg-transparent border-neutral-700 text-white hover:bg-white/5"
                )}
              >
                {isPosting && isPostNow ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Post Now
                  </>
                )}
              </button>
            </div>

            {/* Tips */}
            <div className="mt-6 p-4 bg-neutral-950/50 rounded-xl border border-neutral-800">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-neutral-400">
                  <p className="font-medium text-white mb-1">Best posting times</p>
                  <p>
                    Instagram engagement is typically highest between 11am-1pm and
                    7pm-9pm in your audience's timezone.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

