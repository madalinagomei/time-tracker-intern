import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({ adapter });

const INITIAL_PASSWORD = process.env.INITIAL_USER_PASSWORD;

const specialProjects = [
  {
    name: "Vacation",
    colorKey: "leave-vacation",
  },
  {
    name: "Sick Leave",
    colorKey: "leave-sick",
  },
  {
    name: "Training",
    colorKey: "leave-training",
  },
  {
    name: "Out of Office",
    colorKey: "leave-ooo",
  },
];

type SeedUser = {
  username: string;
  displayName: string;
  role: "ADMIN" | "USER";
};

async function main() {
  if (!INITIAL_PASSWORD) {
    throw new Error(
      "INITIAL_USER_PASSWORD is required to seed Milion and Domino safely.",
    );
  }

  const filePath = path.join(process.cwd(), "seed", "users.seed.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const users = JSON.parse(raw) as SeedUser[];

  const hash = await bcrypt.hash(INITIAL_PASSWORD, 12);

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {
        displayName: u.displayName,
        role: u.role,
      },
      create: {
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        passwordHash: hash,
      },
    });
  }

  for (const p of specialProjects) {
    const existing = await prisma.project.findFirst({
      where: { name: p.name },
    });

    if (existing) {
      await prisma.project.update({
        where: { id: existing.id },
        data: { colorKey: p.colorKey },
      });
    } else {
      await prisma.project.create({
        data: {
          name: p.name,
          colorKey: p.colorKey,
        },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
