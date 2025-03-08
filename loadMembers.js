import { exit } from "node:process";
import { dbOperation, getClient } from "./serve/api/_db.js";
import { T_PAUSE_MS, ROLES_TIMES_S, sleep } from "./serve/api/cron.js";
import { Client, GatewayIntentBits, Events } from "discord.js";

import * as dotenv from "dotenv";
dotenv.config();

const mdbClient = getClient();

var dClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

async function putMember(guildMember, col /* an MDB collection instance */) {
  const joinTimestampSeconds = guildMember.joinedTimestamp / 1000;
  const makeDoc = (roleName) => ({
    userId: guildMember.id,
    joinTimestamp: joinTimestampSeconds,
    roleToAssign: roleName,
  });
  const docsData = [];
  if (
    Date.now() / 1000 - joinTimestampSeconds <=
    process.env["role_rank_Elder1_min_membership_time_s"]
  ) {
    docsData.push(makeDoc("🪙 Elder I"));
  }
  docsData.push(makeDoc("💎 Elder II"));

  // DB write
  try {
    await col.insertMany(docsData);
  } catch {
    console.warn("database error");
    exit();
  }

  return "put scheduled tasks for user " + guildMember.user.username;
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
      exit();
    });

  let members;
  try {
    members = await guild.members.fetch();
  } catch (error) {
    console.error("Failed to fetch members. ", error);
    exit();
  }
  const newMembers = [...members.values()]
    .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
    .filter(
      (m) =>
        m.joinedTimestamp / 1000 >=
        Date.now() / 1000 -
          Number(process.env["role_rank_Elder2_min_membership_time_s"])
    );
  console.info(`${newMembers.length} members to process`);

  let n = 0;
  await dbOperation(mdbClient, async (col) => {
    for (const guildMember of newMembers) {
      n += 1;
      console.info(n + " | " + (await putMember(guildMember, col)));
      await sleep(T_PAUSE_MS);
    }
  }).catch(console.dir);
}

main();
dClient.destroy();
