import { db } from "@workspace/db";
import { leaderboardEntries } from "@workspace/db";

function gaussianRandom(mean: number, std: number): number {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

const names = ["Aiden","Zara","Felix","Mia","Oscar","Luna","Kai","Iris","Leo","Nova","Eli","Sage","Axel","Cleo","Dax","Lyra","Finn","Vera","Rex","Wren","Soren","Alba","Max","Ivy","Cole","Nyx","Evan","Skye","Jace","Piper"];
const surnames = ["Chen","Park","Kim","Patel","Singh","Zhang","Liu","Wang","Garcia","Lopez","Müller","Schmidt","Meyer","Clarke","Davis","Evans","Wright","Walker","Hall","Allen","Young","Hernandez","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green"];

interface Row {
  displayName: string;
  sgiScore: number;
}

const rows: Row[] = [];
for (let i = 0; i < 1000; i++) {
  const name = names[Math.floor(Math.random() * names.length)]!;
  const surname = surnames[Math.floor(Math.random() * surnames.length)]!;
  const displayName = `${name}_${surname}_${i}`;
  let sgiScore = gaussianRandom(52, 15);
  sgiScore = Math.max(5, Math.min(97, sgiScore));
  sgiScore = Math.round(sgiScore * 10) / 10;
  rows.push({ displayName, sgiScore });
}

rows.sort((a, b) => b.sgiScore - a.sgiScore);

const total = rows.length;
const values = rows.map((r, i) => {
  const rank = i + 1;
  const percentile = Math.round((1 - rank / total) * 1000) / 10;
  const rankChange = Math.floor(Math.random() * 41) - 20;
  return {
    displayName: r.displayName,
    sgiScore: r.sgiScore,
    rank,
    percentile,
    rankChange30d: rankChange,
    isAnonymous: 1,
  };
});

for (let i = 0; i < values.length; i += 100) {
  const chunk = values.slice(i, i + 100);
  await db.insert(leaderboardEntries).values(chunk).onConflictDoNothing();
  console.log(`Inserted ${i + chunk.length} entries...`);
}

console.log("Done seeding leaderboard!");
process.exit(0);
