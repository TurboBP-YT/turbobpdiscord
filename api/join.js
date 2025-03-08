import { dbOperation, getClient } from "./_db.js";

export async function POST(request) {
  const rawBody = await request.text();
  let bodyJSON;
  try {
    bodyJSON = JSON.parse(rawBody);
  } catch {
    return new Response("failed", {
      status: 400,
    });
  }
  if (bodyJSON.password !== process.env["password"]) {
    return new Response("prohibited", {
      status: 403,
    });
  }

  //

  const mdbClient = getClient();

  let jobSucceeded = false;

  await dbOperation(mdbClient, async (col) => {
    const docsData = [
      {
        userId: bodyJSON.userId,
        joinTimestamp: bodyJSON.joinTimestamp,
        roleToAssign: "🪙 Elder I",
      },
      {
        userId: bodyJSON.userId,
        joinTimestamp: bodyJSON.joinTimestamp,
        roleToAssign: "💎 Elder II",
      },
    ];
    col.insert(docsData);

    jobSucceeded = true;
  }).catch(console.dir);

  if (!jobSucceeded) {
    return new Response("failed", {
      status: 500,
    });
  }
  return new Response("accepted");
}
