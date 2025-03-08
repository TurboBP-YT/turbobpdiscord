import { dbOperation, getClient } from "./_db.js";
import { Client, GatewayIntentBits } from "discord.js";

const T_PAUSE_MS = 1000;

const ROLES_TIMES_S = {
  "🪙 Elder I": Number(process.env["role_rank_Elder1_min_membership_time_s"]),
  "💎 Elder II": Number(process.env["role_rank_Elder2_min_membership_time_s"]),
};

const dClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function sleep(ms) {
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

  dClient.login(process.env["discord_token"]);

  const mdbClient = getClient();

  let jobSucceeded = false;

  await dbOperation(mdbClient, async (col) => {
    for (const doc in col.find(
      { sort: { joinTimestamp: 1 } } // Sort by joinTimestamp in ascending order
    )) {
      // checks if enough time has passed since the user joined the server
      if (Date.now() - doc.joinTimestamp < ROLES_TIMES_S[doc.roleToAssign]) {
        continue; // not long enough
      }

      col.remove({ _id: doc._id });

      // checks if user is still in the server
      const guild = dClient.guilds.cache.get(process.env["discord_guild_id"]);
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
