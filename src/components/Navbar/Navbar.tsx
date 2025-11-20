import React from "react";
import { AppBar, Toolbar, IconButton, Typography, Button } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useGlobalDrawer } from "@/utils/useModal";
import { Section } from "@/components/Containers/Section";
import Link from "@/components/Link/Link";

const Navbar = () => {
  const { openDrawer, closeDrawer } = useGlobalDrawer();

  return (
    <AppBar position="sticky" color="default">
      <Toolbar className="flex justify-between py-2 sm:py-3">
        <Link href="/" className="logo">
          <Typography variant="h5" component="div" color="textPrimary">
            ChatApp
          </Typography>
        </Link>
        <IconButton
          size="large"
          color="inherit"
          aria-label="menu"
          onClick={() => {
            openDrawer({
              content: (
                <Section>
                  <Button
                    variant="contained"
                    color="info"
                    onClick={closeDrawer}
                  >
                    OK
                  </Button>
                </Section>
              ),
              props: { title: "Menu" },
            });
          }}
        >
          <MenuIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
