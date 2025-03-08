import { dbOperation, getClient } from "serve/api/_db.js";
import { T_PAUSE_MS, ROLES_TIMES_S, sleep } from "serve/api/cron.js";
import { Client, GatewayIntentBits, Events } from "discord.js";

const mdbClient = getClient();

var dClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

async function putMember(guildMember) {
  const joinTimestampSeconds = guildMember.joinedTimestamp / 1000;
  const makeDoc = (roleName) => ({
    userId: guildMember.id,
    joinTimestamp: joinTimestampSeconds,
    roleToAssign: roleName,
  });
  const docsData = [];
  if (
    Date.now() / 1000 - guildMember.joinTimestampSeconds <=
    process.env["role_rank_Elder1_min_membership_time_s"]
  ) {
    docsData.push(makeDoc("🪙 Elder I"));
  }
  docsData.push(makeDoc("💎 Elder II"));

  let jobSucceeded = false;
  await dbOperation(mdbClient, async (col) => {
    await col.insertMany(docsData);
    jobSucceeded = true;
  }).catch(console.dir);

  if (jobSucceeded) {
    console.info("put scheduled tasks for user " + guildMember.username);
  } else {
    console.warn("database error");
  }
}

async function main() {
  dClient.login(process.env["discord_token"]);
  await new Promise((resolve) => {
    dClient.once(Events.ClientReady, (readyClient) => {
      dClient = readyClient;
      resolve();
    });
  });

  const guild = await dClient.guilds
    .fetch(process.env["discord_guild_id"])
    .then((_guild) => _guild)
    .catch((error) => {
      console.error(`Failed to fetch guild: ${error}`);
    });

  let newMembers;
  try {
    const members = await guild.members.fetch();
    newMembers = [...members.values()]
      .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
      .filter(
        (m) =>
          m.joinedTimestamp >=
          Date.now() / 1000 -
            Number(process.env["role_rank_Elder2_min_membership_time_s"])
      );
  } catch (error) {
    return console.error("Failed to fetch members. ", error);
  }

  for (const guildMember of newMembers) {
    putMember(guildMember);
    sleep(T_PAUSE_MS);
  }
}

main();
