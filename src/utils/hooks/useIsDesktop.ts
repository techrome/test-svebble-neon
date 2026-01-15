import { useMediaQuery } from "@mui/material";

const useIsDesktop = () => {
  const fineHover = useMediaQuery("(hover: hover) and (pointer: fine)");
  const coarsePointer = useMediaQuery("(pointer: coarse)");

  return fineHover && !coarsePointer;
};

export default useIsDesktop;
