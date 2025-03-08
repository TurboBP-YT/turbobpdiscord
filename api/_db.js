import { MongoClient, ServerApiVersion } from "mongodb";
const uri =
  "mongodb+srv://<mongo_username>:<mongo_password>@cluster0.ko8ks.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

export function getClient() {
  return new MongoClient(
    uri
      .replace("<mongo_username>", process.env["mongo_username"])
      .replace("<mongo_password>", process.env["mongo_password"]),
    {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    }
  );
}

export async function dbOperation(client, callback) {
  try {
    // Connects the client to the server (optional starting in v4.7)
    await client.connect();
    await callback(client.db("db").collection("scheduled_tasks"));
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
