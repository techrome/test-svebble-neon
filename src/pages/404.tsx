import React from "react";
import ErrorSection from "@/components/GlobalError/ErrorSection";

const NotFound = () => {
  return (
    <ErrorSection errorCode="404" errorText="This page could not be found" />
  );
};

export default NotFound;
