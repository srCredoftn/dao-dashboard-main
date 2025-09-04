import { devLog } from "@/utils/devLogger";

export interface ServerNotification {
  id: string;
  type:
    | "role_update"
    | "comment_added"
    | "comment_updated"
    | "comment_deleted"
    | "task_created"
    | "task_deleted"
    | "task_updated"
    | "task_assigned"
    | "task_unassigned"
    | "system";
  title: string;
  message: string;
  data?: any;
  createdAt: string;
  read: boolean;
}

import { authService } from "./authService";

async function api<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  const token = authService.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(input, {
    headers,
    credentials: "include",
    ...init,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const notificationsApi = {
  async list(): Promise<ServerNotification[]> {
    try {
      return await api<ServerNotification[]>("/api/notifications");
    } catch (e) {
      devLog.error("Failed to fetch notifications", e);
      return [];
    }
  },
  async markRead(id: string): Promise<void> {
    try {
      await api(`/api/notifications/${id}/read`, { method: "PUT" });
    } catch (e) {
      devLog.error("Failed to mark notification as read", e);
    }
  },
  async markAllRead(): Promise<void> {
    try {
      await api(`/api/notifications/read-all`, { method: "PUT" });
    } catch (e) {
      devLog.error("Failed to mark all notifications as read", e);
    }
  },
};
