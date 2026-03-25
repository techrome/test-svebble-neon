import { useMediaQuery } from "@mui/material";

const useIsDesktop = () => {
  return useMediaQuery("(hover: hover) and (pointer: fine)");
};

export default useIsDesktop;
