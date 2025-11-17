import React from "react";
import { AppBar, Toolbar, IconButton, Typography } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import Link from "next/link";

const Navbar = () => {
  return (
    <AppBar position="sticky" color="default">
      <Toolbar className="flex justify-between py-2">
        <Link href="/">
          <Typography variant="h6" component="div" color="textPrimary">
            Svebble
          </Typography>
        </Link>
        <IconButton size="large" color="inherit" aria-label="menu">
          <MenuIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
