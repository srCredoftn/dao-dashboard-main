import type { TaskComment } from "@shared/dao";

const API_BASE_URL = "/api/comments";

// Simple in-memory cache to reduce burst requests (per DAO)
const daoCommentsCache = new Map<string, { data: TaskComment[]; ts: number }>();
const inFlight = new Map<string, Promise<TaskComment[]>>();
const CACHE_TTL = 60 * 1000; // 1 min

class CommentApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T> {
    let url = `${API_BASE_URL}${endpoint}`;

    const token = localStorage.getItem("auth_token");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (options?.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value as string;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value as string;
        });
      } else {
        Object.assign(headers, options.headers as Record<string, string>);
      }
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Build absolute URL
    if (typeof window !== "undefined" && !/^https?:/i.test(url)) {
      url = `${window.location.origin}${url}`;
    }

    // First try: window.fetch with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const response = await window.fetch(url, {
        ...options,
        headers,
        credentials: "same-origin",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as any).error || `HTTP error! status: ${response.status}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      console.error(`Comment API request failed for ${endpoint}:`, error);

      // Fallback using XMLHttpRequest to bypass fetch interceptors
      try {
        const data = await new Promise<T>((resolve, reject) => {
          try {
            const xhr = new XMLHttpRequest();
            xhr.open((options?.method || "GET").toUpperCase(), url, true);
            Object.entries(headers).forEach(([k, v]) =>
              xhr.setRequestHeader(k, v),
            );
            xhr.timeout = 12000;
            xhr.withCredentials = true;
            xhr.onreadystatechange = () => {
              if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const json = JSON.parse(xhr.responseText || "null");
                    resolve(json as T);
                  } catch (e) {
                    reject(e);
                  }
                } else {
                  reject(new Error(`HTTP error! status: ${xhr.status}`));
                }
              }
            };
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.ontimeout = () => reject(new Error("Request timeout"));
            xhr.send(
              options?.body
                ? typeof options.body === "string"
                  ? options.body
                  : JSON.stringify(options.body)
                : null,
            );
          } catch (e) {
            reject(e);
          }
        });

        return data;
      } catch (fallbackError) {
        console.error("XHR fallback failed:", fallbackError);
        throw error;
      }
    }
  }

  // Get all comments for a DAO (cached)
  async getDaoComments(daoId: string): Promise<TaskComment[]> {
    const cached = daoCommentsCache.get(daoId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return cached.data;
    }

    // Deduplicate concurrent calls
    const existing = inFlight.get(daoId);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const data = await this.request<TaskComment[]>(`/dao/${daoId}`);
        daoCommentsCache.set(daoId, { data, ts: Date.now() });
        return data;
      } catch (e) {
        // Fallback to stale cache if available
        const stale = daoCommentsCache.get(daoId);
        if (stale) return stale.data;
        throw e;
      } finally {
        inFlight.delete(daoId);
      }
    })();

    inFlight.set(daoId, promise);
    return promise;
  }

  // Get comments for a specific task (batch via DAO endpoint when possible)
  async getTaskComments(daoId: string, taskId: number): Promise<TaskComment[]> {
    const daoComments = await this.getDaoComments(daoId);
    return daoComments.filter((c) => c.taskId === taskId);
  }

  // Add a new comment (invalidate cache)
  async addComment(
    daoId: string,
    taskId: number,
    content: string,
  ): Promise<TaskComment> {
    const result = await this.request<TaskComment>("/", {
      method: "POST",
      body: JSON.stringify({ daoId, taskId, content }),
    });
    daoCommentsCache.delete(daoId);
    inFlight.delete(daoId);
    return result;
  }

  // Update a comment (invalidate cache)
  async updateComment(
    commentId: string,
    content: string,
  ): Promise<TaskComment> {
    const updated = await this.request<TaskComment>(`/${commentId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
    daoCommentsCache.clear();
    inFlight.clear();
    return updated;
  }

  // Delete a comment (invalidate cache)
  async deleteComment(commentId: string): Promise<void> {
    await this.request<void>(`/${commentId}`, {
      method: "DELETE",
    });
    daoCommentsCache.clear();
    inFlight.clear();
  }

  // Get recent comments
  async getRecentComments(limit: number = 10): Promise<TaskComment[]> {
    return this.request<TaskComment[]>(`/recent?limit=${limit}`);
  }
}

export const commentService = new CommentApiService();
