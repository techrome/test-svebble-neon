import React from "react";
import { Box, AppBar, Toolbar, IconButton, Typography } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

const Navbar = () => {
  return (
    <AppBar position="sticky">
      <Toolbar className="flex justify-between py-2">
        <Typography variant="h6" component="div">
          Svebble
        </Typography>
        <IconButton size="large" color="inherit" aria-label="menu">
          <MenuIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
