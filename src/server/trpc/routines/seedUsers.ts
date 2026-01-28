import { chunked } from "@/utils/chunk";
import { db } from "../../db";
import { files, user } from "../../db/schema";
import { generatePlaceholderEmail } from "../helpers/email";

const USER_COUNT = 100;
const USER_INSERT_CHUNK = 50;
const FILES_PER_USER = 10;

export const seedUsers = async () => {
  let remainingUsersToAdd = USER_COUNT;
  for (let i = 0; i < USER_COUNT; i += USER_INSERT_CHUNK) {
    let userRows: (typeof user.$inferInsert)[] = [];
    for (let j = 0; j < Math.min(USER_INSERT_CHUNK, remainingUsersToAdd); j++) {
      userRows.push({
        email: generatePlaceholderEmail(),
        name: "Dummy name",
        deletedAt: new Date(),
      });
    }
    const addedUsers = await db.insert(user).values(userRows).returning();
    let dummyFiles: (typeof files.$inferInsert)[] = [];
    for (const userRow of addedUsers) {
      for (let j = 0; j < FILES_PER_USER; j++) {
        dummyFiles.push({
          object_key: `users/${userRow.id}/${Math.random()}`,
          owner_user_id: userRow.id,
          purpose: "message_attachment",
          status: "issued",
        });
      }
    }
    for (const chunk of chunked(dummyFiles, 10000)) {
      await db.insert(files).values(chunk);
    }
    remainingUsersToAdd = Math.max(0, remainingUsersToAdd - USER_INSERT_CHUNK);
  }
  console.log("Inserted users!");
};
