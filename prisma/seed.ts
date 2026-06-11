import { prisma } from "../lib/prisma";

async function main() {
  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      email: "alice@example.com",
      name: "Alice",
      posts: {
        create: [
          { title: "Primeiro post", published: true },
          { title: "Rascunho", published: false },
        ],
      },
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      email: "bob@example.com",
      name: "Bob",
      posts: { create: [{ title: "Olá, Prisma", published: true }] },
    },
  });

  console.log(`Seed ok: usuários ${alice.id} e ${bob.id} criados/atualizados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
