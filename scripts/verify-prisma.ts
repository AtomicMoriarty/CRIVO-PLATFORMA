import { prisma } from "../lib/prisma";

async function main() {
  const users = await prisma.user.count();
  console.log(`✅ Connected. Usuários no banco: ${users}`);
}

main()
  .catch((e) => {
    console.error("❌ Falha ao conectar:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
