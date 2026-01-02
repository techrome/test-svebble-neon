import React from "react";

import { Section, VerticalStack } from "@/components/Layout/Containers";
import { Typography } from "@mui/material";

const MyProfile = () => {
  return (
    <Section>
      <VerticalStack>
        <Typography variant="h4" component="h1">
          My Profile
        </Typography>
        <form></form>
      </VerticalStack>
    </Section>
  );
};

export default MyProfile;
