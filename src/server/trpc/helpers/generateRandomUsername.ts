import {
  adjectives,
  animals,
  NumberDictionary,
  uniqueNamesGenerator,
} from "unique-names-generator";
import { randomUUID } from "node:crypto";

import { TEXT_LIMITS } from "@/utils/validators/helpers/text";

export const generateRandomUsername = (isGuest: boolean) => {
  let result = "";
  if (isGuest) {
    result = `guest_${randomUUID()}`;
  } else {
    const numberDictionary = NumberDictionary.generate({ min: 100, max: 9999 });
    result = uniqueNamesGenerator({
      dictionaries: [adjectives, animals, numberDictionary],
      length: 3,
      separator: "_",
      style: "lowerCase",
    });
  }
  return result.toLowerCase().replaceAll("-", "").slice(0, TEXT_LIMITS.handle);
};
