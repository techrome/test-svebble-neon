import React from "react";

import Drawer from "@/components/Overlays/Drawer";
import { useGlobalDrawer } from "@/utils/hooks/useOverlay";

const GlobalDrawer = () => {
  const { closeDrawer, isOpen, clearDrawer, drawerState } = useGlobalDrawer();

  return (
    <Drawer
      isOpen={isOpen}
      onClose={closeDrawer}
      onExited={clearDrawer}
      {...drawerState.props}
    >
      {drawerState.content}
    </Drawer>
  );
};

export default GlobalDrawer;
