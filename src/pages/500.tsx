import React from "react";
import ErrorSection from "@/components/GlobalError/ErrorSection";

const Error500 = () => {
  return (
    <ErrorSection errorCode="500" errorText="An error occured on the server" />
  );
};

export default Error500;
