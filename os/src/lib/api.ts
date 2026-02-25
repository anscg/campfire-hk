// ============================================================
// API Client - communicates with Express backend
// ============================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (this.token) {
      (headers as Record<string, string>)["Authorization"] =
        `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Request failed" }));
      throw new ApiError(error.error || "Request failed", res.status);
    }

    return res.json();
  }

  // Auth
  async requestOTP(email: string) {
    return this.request<{ success: boolean; message: string }>(
      "/api/auth/request-otp",
      {
        method: "POST",
        body: JSON.stringify({ email }),
      }
    );
  }

  async verifyOTP(email: string, code: string) {
    return this.request<{ success: boolean; token: string; userId: string }>(
      "/api/auth/verify-otp",
      {
        method: "POST",
        body: JSON.stringify({ email, code }),
      }
    );
  }

  // User
  async getMe() {
    return this.request<any>("/api/user/me");
  }

  // XP
  async awardXP(amount: number, reason: string) {
    return this.request<{ xp: number }>("/api/xp/award", {
      method: "POST",
      body: JSON.stringify({ amount, reason }),
    });
  }

  // Shop
  async getShopItems() {
    return this.request<any[]>("/api/shop/items");
  }

  async purchaseItem(itemId: string) {
    return this.request<{ success: boolean; newXP: number }>(
      "/api/shop/purchase",
      {
        method: "POST",
        body: JSON.stringify({ itemId }),
      }
    );
  }

  // Transactions
  async getTransactions() {
    return this.request<any[]>("/api/transactions");
  }

  // Health
  async health() {
    return this.request<{ status: string; timestamp: number }>("/api/health");
  }
}

export const apiClient = new ApiClient();
