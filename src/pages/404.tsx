import React from "react";
import { Box, Typography } from "@mui/material";
import { SwitchingStack, VerticalStack } from "@/components/Layout/Containers";
import { SwitchingDivider } from "@/components/Layout/Dividers";
import Button from "@/components/Button/Button";
import Link from "@/components/Link/Link";
import { ROUTES } from "@/utils/routes";

const NotFound = () => {
  return (
    <Box className="flex-1 flex justify-center items-center">
      <VerticalStack addClassName="items-center" spacing="lg">
        <SwitchingStack addClassName="justify-center items-center">
          <Typography variant="h2" component="h1" textAlign="center">
            404
          </Typography>
          <SwitchingDivider className="max-md:w-1/2" />
          <Typography variant="h4" component="h2" textAlign="center">
            This page could not be found
          </Typography>
        </SwitchingStack>
        <Link href={ROUTES.home} className="w-md max-w-full">
          <Button variant="contained" color="primary" size="large" fullWidth>
            Return to Home page
          </Button>
        </Link>
      </VerticalStack>
    </Box>
  );
};

export default NotFound;
