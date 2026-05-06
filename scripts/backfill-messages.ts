import { and, desc, inArray, isNull, sql, SQL } from "drizzle-orm";
import { db, schema } from "../src/server/db";
import { htmlToText } from "../src/server/utils/sanitizeHtml";
import { runChunksConcurrently } from "../src/server/utils/concurrency";

(async () => {
  const rows = await db
    .select()
    .from(schema.messages)
    .where(
      and(
        isNull(schema.messages.content_text),
        isNull(schema.messages.deleted_at)
      )
    )
    .orderBy(desc(schema.messages.id))
    .limit(1000);

  await runChunksConcurrently(rows, 200, 5, async (chunk) => {
    let ids: bigint[] = [];
    let sqlChunks: SQL[] = [sql`case`];
    for (let row of chunk) {
      const id = row.id;
      const contentText = htmlToText(row.content);
      ids.push(id);

      sqlChunks.push(
        sql`when ${schema.messages.id} = ${id} then ${contentText}`
      );
    }
    sqlChunks.push(sql`end`);

    const contentTextSql = sql.join(sqlChunks, sql.raw(" "));

    await db
      .update(schema.messages)
      .set({
        content_text: contentTextSql,
      })
      .where(inArray(schema.messages.id, ids));
  });

  console.log(`DONE. Items changed: ${rows.length}`);
  process.exit(1);
})();
