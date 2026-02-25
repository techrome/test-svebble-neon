import React from "react";

export const useScreenHeight = () => {
  const [height, setHeight] = React.useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight
  );

  React.useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return height;
};
