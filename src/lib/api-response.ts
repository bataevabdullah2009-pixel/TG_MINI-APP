// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

export function errorResponse(error: string): ApiResponse {
  return {
    success: false,
    error,
  };
}

// Error handling
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public data?: any
  ) {
    super(message);
  }
}

export function handleError(error: any) {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      body: errorResponse(error.message),
    };
  }

  console.error("Unexpected error:", error);
  return {
    statusCode: 500,
    body: errorResponse("Internal server error"),
  };
}
