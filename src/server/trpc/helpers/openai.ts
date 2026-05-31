import { isDev } from "@/utils/isDev";
import { env } from "../../env";
import OpenAI from "openai";

export const openAI = new OpenAI({ apiKey: env.OPENAI_API_TOKEN });

type ModerationResult = Awaited<ReturnType<typeof openAI.moderations.create>>;

export const moderateImage = async (url: string): Promise<ModerationResult> => {
  if (isDev) {
    return { id: "dev", model: "dev", results: [] };
  }
  const result = await openAI.moderations.create({
    model: "omni-moderation-latest",
    input: [
      {
        type: "image_url",
        image_url: { url },
      },
    ],
  });
  return result;
};
