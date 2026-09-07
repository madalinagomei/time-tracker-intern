import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const username = process.env.TARGET_USERNAME?.trim().toLowerCase();
const configuredPassword = process.env.NEW_PASSWORD;

if (!username || !configuredPassword) {
  throw new Error("TARGET_USERNAME and NEW_PASSWORD are required.");
}
const password: string = configuredPassword;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { username },
    data: { passwordHash, mustChangePassword: false },
  });
  console.log(`Password updated for ${username}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
