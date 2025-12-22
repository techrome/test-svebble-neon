import z from "zod";

export const passwordMinLength = 8;
export const passwordCheck = z.string().min(passwordMinLength);
