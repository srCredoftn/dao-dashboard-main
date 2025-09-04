import type { Dao } from "@shared/dao";

const API_BASE_URL = "/api/dao";

class TaskService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    // Get token from localStorage
    const token = localStorage.getItem("auth_token");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add existing headers if they exist
    if (options?.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }

    // Add Authorization header if token exists
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          // Clear invalid token
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");

          // Redirect to login page if not already there
          if (!window.location.pathname.includes("/login")) {
            window.location.href = "/login";
          }

          throw new Error("Session expirée. Veuillez vous reconnecter.");
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      // Handle network errors
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        throw new Error(
          "Erreur de connexion. Vérifiez votre connexion internet.",
        );
      }

      console.error(`Task API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Add new task to DAO
  async addTask(
    daoId: string,
    taskData: {
      name: string;
      isApplicable: boolean;
      progress?: number | null;
      comment?: string;
      assignedTo?: string;
    },
  ): Promise<Dao> {
    return this.request<Dao>(`/${daoId}/tasks`, {
      method: "POST",
      body: JSON.stringify(taskData),
    });
  }

  // Update task name
  async updateTaskName(
    daoId: string,
    taskId: number,
    name: string,
  ): Promise<Dao> {
    return this.request<Dao>(`/${daoId}/tasks/${taskId}/name`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
  }

  // Delete task
  async deleteTask(
    daoId: string,
    taskId: number,
  ): Promise<{ dao: Dao; message: string }> {
    return this.request<{ dao: Dao; message: string }>(
      `/${daoId}/tasks/${taskId}`,
      {
        method: "DELETE",
      },
    );
  }

  // Update task progress (using existing DAO service endpoint)
  async updateTask(
    daoId: string,
    taskId: number,
    updates: {
      progress?: number;
      comment?: string;
      isApplicable?: boolean;
      assignedTo?: string;
    },
  ): Promise<Dao> {
    return this.request<Dao>(`/${daoId}/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  // Reorder tasks
  async reorderTasks(daoId: string, taskIds: number[]): Promise<Dao> {
    return this.request<Dao>(`/${daoId}/tasks/reorder`, {
      method: "PUT",
      body: JSON.stringify({ taskIds }),
    });
  }
}

export const taskService = new TaskService();
