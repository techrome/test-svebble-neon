import React from "react";

export const useDebouncedValue = <T,>(
  value: T,
  timeoutMs: number,
  options?: { instantOnFalsyValue?: boolean; instantOnTruthyValue?: boolean }
): T => {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    if (
      (options?.instantOnFalsyValue && !value) ||
      (options?.instantOnTruthyValue && value)
    ) {
      setDebounced(value);
      return;
    }
    const timeout = setTimeout(() => setDebounced(value), timeoutMs);
    return () => clearTimeout(timeout);
  }, [
    value,
    timeoutMs,
    options?.instantOnFalsyValue,
    options?.instantOnTruthyValue,
  ]);

  return debounced;
};
