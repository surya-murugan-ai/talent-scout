import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { NotificationService } from "./notifications";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const error = new Error(`${res.status}: ${text}`);
    NotificationService.emitApiError(error, res.url, res.status);
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const config: RequestInit = {
    method,
    credentials: "include",
  };

  // Handle FormData differently - don't set Content-Type header for file uploads
  if (data instanceof FormData) {
    config.body = data;
    // Don't set Content-Type - browser will set it with boundary for FormData
  } else if (data) {
    config.headers = { "Content-Type": "application/json" };
    config.body = JSON.stringify(data);
  }

  try {
    const res = await fetch(url, config);
    await throwIfResNotOk(res);
    
    // Emit success notification for POST, PUT, DELETE operations
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      NotificationService.emitApiSuccess(
        `${method} request completed successfully`,
        url
      );
    }
    
    return res;
  } catch (error) {
    if (error instanceof Error && !error.message.includes('HTTP error')) {
      NotificationService.emitApiError(error, url);
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Use the current origin (localhost:5173) and let Vite proxy handle /api routes
    const url = queryKey.join("/") as string;
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
