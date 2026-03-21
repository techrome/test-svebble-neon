import z from "zod";

z.config({
  customError: (issue) => {
    if (issue.code === "invalid_value") {
      return "Please select a valid option.";
    }

    return undefined;
  },
});

export default z;
