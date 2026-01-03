import {
  adjectives,
  animals,
  NumberDictionary,
  uniqueNamesGenerator,
} from "unique-names-generator";

export const generateRandomUsername = () => {
  const numberDictionary = NumberDictionary.generate({ min: 100, max: 9999 });
  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals, numberDictionary],
    length: 3,
    separator: "_",
    style: "capital",
  });
};
