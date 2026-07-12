import { useState, useCallback, useRef, useEffect } from "react";

export function useAlerts() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const errorTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const triggerError = useCallback((msg: string) => {
    clearTimeout(errorTimerRef.current);
    setErrorMessage(msg);
    errorTimerRef.current = setTimeout(() => setErrorMessage(null), 6000);
  }, []);

  const triggerSuccess = useCallback((msg: string) => {
    clearTimeout(successTimerRef.current);
    setSuccessMessage(msg);
    successTimerRef.current = setTimeout(() => setSuccessMessage(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(errorTimerRef.current);
      clearTimeout(successTimerRef.current);
    };
  }, []);

  return { errorMessage, successMessage, triggerError, triggerSuccess, setErrorMessage, setSuccessMessage };
}
