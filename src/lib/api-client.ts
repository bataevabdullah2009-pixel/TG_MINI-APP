import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL?: string) {
    const resolvedBaseURL =
      baseURL ||
      (typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_APP_URL || "");

    this.client = axios.create({
      baseURL: `${resolvedBaseURL}/api`,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add token to requests
    this.client.interceptors.request.use((config) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("accessToken");
            window.location.href = "/admin/login";
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig) {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.post<T>(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.put<T>(url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.patch<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig) {
    return this.client.delete<T>(url, config);
  }
}

export const apiClient = new ApiClient();
