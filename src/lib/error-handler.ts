import { toast } from "sonner";

/**
 * Standardized error handler that extracts error messages from various API/Error shapes
 * and displays them via toast notification.
 */
export const handleError = (error: unknown, fallbackMessage = "An unexpected error occurred") => {
  console.error("handleError called with:", error);
  let message = fallbackMessage;

  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "object" && error !== null) {
    // Handle RTK Query / Axios error shapes
    const err = error as any;
    
    // Check for 'data.message' (common in API responses)
    if (err.data && typeof err.data === "object" && err.data.message) {
      message = err.data.message;
    }
    // Check for 'message' property on error object itself
    else if (err.message) {
      message = err.message;
    }
    // Check for 'error' property which might be a string
    else if (typeof err.error === "string") {
      message = err.error;
    }
  }

  toast.error(message, {
    position: "top-right",
    duration: 5000,
  });
  
  return message;
};

export const handleSuccess = (message: string) => {
  toast.success(message, {
    position: "top-right",
    duration: 3000,
  });
};
