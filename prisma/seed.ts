import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

async function main() {
  console.log("\n🌱 بدء عملية بذر قاعدة البيانات...\n");

  // Wipe in safe order
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();
  await prisma.region.deleteMany();

  // ── 1. Admin ────────────────────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      name: "مدير النظام",
      email: "admin@example.com",
      password: await hash("admin123"),
      role: "admin",
      isActive: true,
    },
  });

  // ── 2. General Manager ──────────────────────────────────────────────────────
  const gm = await prisma.user.create({
    data: {
      name: "المدير العام",
      email: "gm@example.com",
      password: await hash("gm123"),
      role: "general_manager",
      managerId: admin.id,
      isActive: true,
    },
  });

  // ── 3. Sales Managers ───────────────────────────────────────────────────────
  const [sm1, sm2] = await Promise.all([
    prisma.user.create({
      data: {
        name: "مدير المبيعات — المنطقة الغربية",
        email: "sm1@example.com",
        password: await hash("sm123"),
        role: "sales_manager",
        managerId: gm.id,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "مدير المبيعات — المنطقة الشرقية",
        email: "sm2@example.com",
        password: await hash("sm123"),
        role: "sales_manager",
        managerId: gm.id,
        isActive: true,
      },
    }),
  ]);

  // ── 4. Teams ────────────────────────────────────────────────────────────────
  const [teamRiyadh, teamJeddah, teamDammam] = await Promise.all([
    prisma.team.create({ data: { nameAr: "فريق الرياض",  nameEn: "Riyadh Team"  } }),
    prisma.team.create({ data: { nameAr: "فريق جدة",    nameEn: "Jeddah Team"  } }),
    prisma.team.create({ data: { nameAr: "فريق الدمام", nameEn: "Dammam Team"  } }),
  ]);

  // ── 5. Team Managers ────────────────────────────────────────────────────────
  const [tm1, tm2, tm3] = await Promise.all([
    prisma.user.create({
      data: {
        name: "مدير فريق الرياض",
        email: "tm1@example.com",
        password: await hash("tm123"),
        role: "team_manager",
        managerId: sm1.id,
        teamId: teamRiyadh.id,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "مدير فريق جدة",
        email: "tm2@example.com",
        password: await hash("tm123"),
        role: "team_manager",
        managerId: sm1.id,
        teamId: teamJeddah.id,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "مدير فريق الدمام",
        email: "tm3@example.com",
        password: await hash("tm123"),
        role: "team_manager",
        managerId: sm2.id,
        teamId: teamDammam.id,
        isActive: true,
      },
    }),
  ]);

  // Assign managers to their teams
  await Promise.all([
    prisma.team.update({ where: { id: teamRiyadh.id  }, data: { managerId: tm1.id } }),
    prisma.team.update({ where: { id: teamJeddah.id  }, data: { managerId: tm2.id } }),
    prisma.team.update({ where: { id: teamDammam.id  }, data: { managerId: tm3.id } }),
  ]);

  // ── 6. Sales Reps (3 per team) ───────────────────────────────────────────────
  const repData = [
    // Riyadh (rep1-3)
    { name: "مندوب رياض 1", email: "rep1@example.com", managerId: tm1.id, teamId: teamRiyadh.id },
    { name: "مندوب رياض 2", email: "rep2@example.com", managerId: tm1.id, teamId: teamRiyadh.id },
    { name: "مندوب رياض 3", email: "rep3@example.com", managerId: tm1.id, teamId: teamRiyadh.id },
    // Jeddah (rep4-6)
    { name: "مندوب جدة 1",  email: "rep4@example.com", managerId: tm2.id, teamId: teamJeddah.id },
    { name: "مندوب جدة 2",  email: "rep5@example.com", managerId: tm2.id, teamId: teamJeddah.id },
    { name: "مندوب جدة 3",  email: "rep6@example.com", managerId: tm2.id, teamId: teamJeddah.id },
    // Dammam (rep7-9)
    { name: "مندوب دمام 1", email: "rep7@example.com", managerId: tm3.id, teamId: teamDammam.id },
    { name: "مندوب دمام 2", email: "rep8@example.com", managerId: tm3.id, teamId: teamDammam.id },
    { name: "مندوب دمام 3", email: "rep9@example.com", managerId: tm3.id, teamId: teamDammam.id },
  ];

  const pw = await hash("rep123");
  await prisma.user.createMany({
    data: repData.map((r) => ({
      ...r,
      password: pw,
      role: "sales_rep" as const,
      isActive: true,
    })),
  });

  // ── 7. Audit log for seed ───────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      action: "seed_database",
      entityType: "System",
      userId: admin.id,
      metadata: { seededAt: new Date().toISOString() },
    },
  });

  // ── Summary table ─────────────────────────────────────────────────────────────
  console.log("✅ تم بذر قاعدة البيانات بنجاح!\n");
  console.log("┌─────────────────────────────┬──────────────────────────┬──────────────┬─────────────────────────────┐");
  console.log("│ الدور                        │ البريد الإلكتروني         │ كلمة المرور   │ المشرف                     │");
  console.log("├─────────────────────────────┼──────────────────────────┼──────────────┼─────────────────────────────┤");
  const rows = [
    ["مدير النظام",         "admin@example.com", "admin123", "—"],
    ["المدير العام",        "gm@example.com",    "gm123",    "admin"],
    ["مدير مبيعات 1",       "sm1@example.com",   "sm123",    "gm"],
    ["مدير مبيعات 2",       "sm2@example.com",   "sm123",    "gm"],
    ["مدير فريق رياض",      "tm1@example.com",   "tm123",    "sm1"],
    ["مدير فريق جدة",       "tm2@example.com",   "tm123",    "sm1"],
    ["مدير فريق دمام",      "tm3@example.com",   "tm123",    "sm2"],
    ["مندوب رياض 1-3",      "rep1-3@example.com","rep123",   "tm1"],
    ["مندوب جدة 1-3",       "rep4-6@example.com","rep123",   "tm2"],
    ["مندوب دمام 1-3",      "rep7-9@example.com","rep123",   "tm3"],
  ];
  for (const row of rows) {
    const [role = "", email = "", pw = "", mgr = ""] = row;
    console.log(`│ ${role.padEnd(27)} │ ${email.padEnd(24)} │ ${pw.padEnd(12)} │ ${mgr.padEnd(27)} │`);
  }
  console.log("└─────────────────────────────┴──────────────────────────┴──────────────┴─────────────────────────────┘\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
