import { useEffect, useState } from "react";

export const useScreenHeight = () => {
  const [height, setHeight] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight
  );

  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return height;
};
