import React from "react";

export const useDebouncedValue = <T,>(
  value: T,
  timeoutMs: number,
  options?: { instantOnFalsyValue?: boolean }
): T => {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    if (options?.instantOnFalsyValue && !value) {
      setDebounced(value);
      return;
    }
    const timeout = setTimeout(() => setDebounced(value), timeoutMs);
    return () => clearTimeout(timeout);
  }, [value, timeoutMs]);

  return debounced;
};
