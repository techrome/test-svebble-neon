import { env } from "../../env";
import OpenAI from "openai";

export const openAI = new OpenAI({ apiKey: env.OPENAI_API_TOKEN });
