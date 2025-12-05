"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Instagram,
  Loader2,
  Image as ImageIcon,
  Film,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Post = {
  _id: string;
  content: string;
  scheduledFor: string;
  status: "scheduled" | "published" | "failed" | "draft";
  platforms: {
    platform: string;
    accountId: string;
    username?: string;
  }[];
  mediaUrls?: string[];
  mediaItems?: { url: string; type: string }[];
  createdAt: string;
};

// Helper to get first media URL from post
const getPostThumbnail = (post: Post): string | null => {
  if (post.mediaUrls && post.mediaUrls.length > 0) {
    return post.mediaUrls[0];
  }
  if (post.mediaItems && post.mediaItems.length > 0) {
    return post.mediaItems[0].url;
  }
  return null;
};

type ViewMode = "month" | "week" | "list";

export default function ContentCalendar() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/social/posts?platform=instagram&limit=100");
      if (!response.ok) throw new Error("Failed to fetch posts");
      const data = await response.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast.error("Failed to load scheduled posts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const deletePost = async (postId: string) => {
    setDeletingId(postId);
    try {
      const response = await fetch(`/api/social/posts?postId=${postId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete post");

      setPosts((prev) => prev.filter((p) => p._id !== postId));
      setSelectedPost(null);
      toast.success("Post deleted successfully");
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    } finally {
      setDeletingId(null);
    }
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty slots for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getPostsForDate = (date: Date) => {
    return posts.filter((post) => {
      const postDate = new Date(post.scheduledFor);
      return (
        postDate.getDate() === date.getDate() &&
        postDate.getMonth() === date.getMonth() &&
        postDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: Post["status"]) => {
    switch (status) {
      case "published":
        return (
          <span className="flex items-center gap-1 text-xs font-medium text-green-400">
            <CheckCircle className="w-3 h-3" />
            Published
          </span>
        );
      case "scheduled":
        return (
          <span className="flex items-center gap-1 text-xs font-medium text-blue-400">
            <Clock className="w-3 h-3" />
            Scheduled
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 text-xs font-medium text-red-400">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-xs font-medium text-neutral-400">
            <AlertCircle className="w-3 h-3" />
            Draft
          </span>
        );
    }
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const days = getDaysInMonth(currentDate);
  const today = new Date();

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-white mb-2">Content Calendar</h1>
        <p className="text-neutral-400">
          View and manage your scheduled Instagram posts.
        </p>
      </motion.div>

      {/* Calendar Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-neutral-900/30 border border-neutral-800 rounded-3xl overflow-hidden"
      >
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-neutral-400" />
            </button>
            <h2 className="text-xl font-bold text-white min-w-[200px] text-center">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-neutral-400" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const today = new Date();
                setCurrentDate(today);
                setSelectedDate(today);
              }}
              className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Today
            </button>
            <div className="flex bg-neutral-900/50 rounded-lg p-1">
              {(["month", "list"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md transition-all capitalize",
                    viewMode === mode
                      ? "bg-white/10 text-white"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
          </div>
        ) : viewMode === "month" ? (
          <div className="p-6">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-neutral-500 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                const dayPosts = day ? getPostsForDate(day) : [];
                const isToday =
                  day &&
                  day.getDate() === today.getDate() &&
                  day.getMonth() === today.getMonth() &&
                  day.getFullYear() === today.getFullYear();

                return (
                  <div
                    key={index}
                    onClick={() => day && setSelectedDate(day)}
                    className={cn(
                      "min-h-[120px] p-2 rounded-xl border transition-colors cursor-pointer",
                      day
                        ? "border-neutral-800 hover:border-neutral-700 bg-neutral-900/30"
                        : "border-transparent cursor-default",
                      isToday && "border-pink-500/50 bg-pink-500/5"
                    )}
                  >
                    {day && (
                      <>
                        <div
                          className={cn(
                            "text-sm font-medium mb-2",
                            isToday ? "text-pink-400" : "text-neutral-400"
                          )}
                        >
                          {day.getDate()}
                        </div>
                        <div className="space-y-1">
                          {dayPosts.slice(0, 3).map((post) => (
                            <button
                              key={post._id}
                              onClick={() => setSelectedPost(post)}
                              className="w-full text-left px-2 py-1 bg-gradient-to-r from-purple-600/20 to-pink-500/20 border border-pink-500/20 rounded-lg text-xs text-white truncate hover:from-purple-600/30 hover:to-pink-500/30 transition-colors"
                            >
                              <span className="flex items-center gap-1">
                                <Instagram className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">
                                  {new Date(post.scheduledFor).toLocaleTimeString(
                                    "en-US",
                                    { hour: "numeric", minute: "2-digit" }
                                  )}
                                </span>
                              </span>
                            </button>
                          ))}
                          {dayPosts.length > 3 && (
                            <div className="text-xs text-neutral-500 px-2">
                              +{dayPosts.length - 3} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="p-6">
            {posts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-neutral-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="w-8 h-8 text-neutral-500" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">
                  No scheduled posts
                </h3>
                <p className="text-neutral-400 text-sm">
                  Create your first scheduled post to see it here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts
                  .sort(
                    (a, b) =>
                      new Date(a.scheduledFor).getTime() -
                      new Date(b.scheduledFor).getTime()
                  )
                  .map((post) => (
                    <motion.div
                      key={post._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 flex items-center gap-4 hover:border-neutral-700 transition-colors cursor-pointer"
                      onClick={() => setSelectedPost(post)}
                    >
                      {/* Media Preview */}
                      <div className="w-16 h-16 bg-neutral-800 rounded-lg overflow-hidden flex-shrink-0">
                        {getPostThumbnail(post) ? (
                          <img
                            src={getPostThumbnail(post)!}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-neutral-600" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate mb-1">
                          {post.content || "No caption"}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-neutral-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(post.scheduledFor)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Instagram className="w-3 h-3" />
                            Instagram
                          </span>
                        </div>
                      </div>

                      {/* Status + Cancel Button */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {getStatusBadge(post.status)}
                        {post.status === "scheduled" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePost(post._id);
                            }}
                            disabled={deletingId === post._id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors"
                          >
                            {deletingId === post._id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            Cancel
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Post Detail Modal */}
      <AnimatePresence>
        {selectedPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPost(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Media */}
              {getPostThumbnail(selectedPost) && (
                <div className="aspect-square bg-neutral-950 relative">
                  <img
                    src={getPostThumbnail(selectedPost)!}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {((selectedPost.mediaUrls && selectedPost.mediaUrls.length > 1) ||
                    (selectedPost.mediaItems && selectedPost.mediaItems.length > 1)) && (
                      <div className="absolute bottom-4 right-4 bg-black/60 px-3 py-1 rounded-full text-xs text-white">
                        +{(selectedPost.mediaUrls?.length || selectedPost.mediaItems?.length || 1) - 1} more
                      </div>
                    )}
                </div>
              )}

              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full flex items-center justify-center">
                      <Instagram className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Instagram</p>
                      {getStatusBadge(selectedPost.status)}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="bg-neutral-950/50 rounded-xl p-4 mb-4">
                  <p className="text-white whitespace-pre-wrap">
                    {selectedPost.content || "No caption"}
                  </p>
                </div>

                {/* Schedule Info */}
                <div className="flex items-center gap-2 text-sm text-neutral-400 mb-6">
                  <Clock className="w-4 h-4" />
                  <span>Scheduled for {formatDate(selectedPost.scheduledFor)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  {selectedPost.status === "scheduled" && (
                    <button
                      onClick={() => deletePost(selectedPost._id)}
                      disabled={deletingId === selectedPost._id}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all",
                        deletingId === selectedPost._id
                          ? "bg-neutral-800 text-neutral-400 cursor-not-allowed"
                          : "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                      )}
                    >
                      {deletingId === selectedPost._id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Delete Post
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedPost(null)}
                    className="flex-1 px-4 py-3 bg-white/5 border border-neutral-700 rounded-xl font-medium text-white hover:bg-white/10 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day Detail Modal */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedDate(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-neutral-800">
                <h3 className="text-xl font-bold text-white">
                  {selectedDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h3>
                <p className="text-neutral-400 text-sm mt-1">
                  {getPostsForDate(selectedDate).length} scheduled posts
                </p>
              </div>

              <div className="p-6 space-y-3">
                {getPostsForDate(selectedDate).length === 0 ? (
                  <div className="text-center py-8">
                    <CalendarIcon className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                    <p className="text-neutral-400">No posts scheduled for this day</p>
                  </div>
                ) : (
                  getPostsForDate(selectedDate)
                    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
                    .map((post) => (
                      <div
                        key={post._id}
                        className="bg-neutral-950/50 border border-neutral-800 rounded-xl p-4 flex items-center gap-4 hover:border-neutral-700 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedDate(null);
                          setSelectedPost(post);
                        }}
                      >
                        {/* Time */}
                        <div className="text-center flex-shrink-0 w-16">
                          <p className="text-lg font-bold text-white">
                            {new Date(post.scheduledFor).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>

                        {/* Media Preview */}
                        <div className="w-12 h-12 bg-neutral-800 rounded-lg overflow-hidden flex-shrink-0">
                          {getPostThumbnail(post) ? (
                            <img
                              src={getPostThumbnail(post)!}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-5 h-5 text-neutral-600" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">
                            {post.content || "No caption"}
                          </p>
                          {getStatusBadge(post.status)}
                        </div>

                        {/* Delete button for scheduled posts */}
                        {post.status === "scheduled" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePost(post._id);
                            }}
                            disabled={deletingId === post._id}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            {deletingId === post._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    ))
                )}
              </div>

              <div className="p-6 border-t border-neutral-800">
                <button
                  onClick={() => setSelectedDate(null)}
                  className="w-full px-4 py-3 bg-white/5 border border-neutral-700 rounded-xl font-medium text-white hover:bg-white/10 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}










