import { z as baseZ } from "zod";

baseZ.config({
  customError: (issue) => {
    if (issue.code === "invalid_value") {
      return "Please select a valid option.";
    }
    return undefined;
  },
});

export * from "zod";
export * as z from "zod";
export default baseZ;
