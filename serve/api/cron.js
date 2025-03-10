import { dbOperation, getClient } from "./_db.js";
import { Client, GatewayIntentBits, Events } from "discord.js";

export const T_PAUSE_MS = 500;

export const ROLES_TIMES_S = {
  "🪙 Elder I": Number(process.env["role_rank_Elder1_min_membership_time_s"]),
  "💎 Elder II": Number(process.env["role_rank_Elder2_min_membership_time_s"]),
};

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  var dClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
  dClient.login(process.env["discord_token"]);
  await new Promise((resolve) => {
    dClient.once(Events.ClientReady, (readyClient) => {
      dClient = readyClient;
      resolve();
    });
  });

  let guild = dClient.guilds.cache.get(process.env["discord_guild_id"]);
  if (guild == undefined) {
    // guild is uncached
    await dClient.guilds
      .fetch(process.env["discord_guild_id"])
      .then((_guild) => {
        guild = _guild;
      })
      .catch((error) => {
        console.error(`Failed to fetch guild: ${error}`);
      });
    if (guild == undefined) {
      return new Response("failed", {
        status: 500,
      });
    }
  }

  const mdbClient = getClient();

  let jobSucceeded = false;

  await dbOperation(mdbClient, async (col) => {
    for await (const doc of col.find().sort(
      { joinTimestamp: 1 } // Sort by joinTimestamp in ascending order
    )) {
      // checks if enough time has passed since the user joined the server
      if (
        Date.now() / 1000 - doc.joinTimestamp <
        ROLES_TIMES_S[doc.roleToAssign]
      ) {
        console.log("skipped scheduled task = not time yet");
        continue; // not long enough
      }

      await col.deleteOne({ _id: doc._id });
      console.log("document deleted");

      // checks if user is still in the server
      const [isUserInGuild, member] = await guild.members
        .fetch(doc.userId)
        .then((member) => {
          // Member exists in the guild
          return [true, member];
        })
        .catch((error) => {
          // Member does not exist in the guild
          return [false, null];
        });
      if (!isUserInGuild) {
        continue;
      }

      // assigns role
      const role = guild.roles.cache.find(
        (role) => role.name === doc.roleToAssign
      );
      member.roles.add(role);

      // sends a notification message to the server’s bot-log chnannel
      const logsChannel = dClient.channels.cache.get(
        process.env["discord_bot_output_channel_id"]
      );
      logsChannel.send(
        `🔼 <@${doc.userId}> Automatically Promoted to Role "${doc.roleToAssign}"`
      );

      await sleep(T_PAUSE_MS);
    }

    jobSucceeded = true;
  }).catch(console.dir);

  if (!jobSucceeded) {
    return new Response("failed", {
      status: 500,
    });
  }
  return new Response("completed");
}
