import { dbOperation, getClient } from "./_db.js";

export async function POST(request) {
  const rawBody = await request.text();
  let bodyJSON;
  try {
    bodyJSON = JSON.parse(rawBody);
  } catch {
    return new Response("bad request", {
      status: 400,
    });
  }
  if (bodyJSON.password !== process.env["password"]) {
    return new Response("prohibited", {
      status: 403,
    });
  }

  if (
    !(
      Object.keys(bodyJSON).includes("joinTimestamp") &&
      bodyJSON.joinTimestamp != null &&
      Object.keys(bodyJSON).includes("userId") &&
      bodyJSON.userId != null
    )
  ) {
    return new Response("missing request data", {
      status: 400,
    });
  }

  //

  const joinTimestamp = Number(bodyJSON.joinTimestamp);

  const mdbClient = getClient();

  let jobSucceeded = false;

  await dbOperation(mdbClient, async (col) => {
    const docsData = [
      {
        userId: bodyJSON.userId,
        joinTimestamp: joinTimestamp,
        roleToAssign: "🪙 Elder I",
      },
      {
        userId: bodyJSON.userId,
        joinTimestamp: joinTimestamp,
        roleToAssign: "💎 Elder II",
      },
    ];
    await col.insertMany(docsData);

    jobSucceeded = true;
  }).catch(console.dir);

  if (!jobSucceeded) {
    return new Response("failed", {
      status: 500,
    });
  }
  return new Response("accepted");
}
