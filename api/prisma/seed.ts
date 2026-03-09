import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding...')

  const zones = await Promise.all([
    prisma.zone.upsert({ where: { slug: 'praca-xv' },         update: {}, create: { slug: 'praca-xv',         nome: 'Praça XV de Novembro', lat: -27.5965, lng: -48.5484, risco: 88 } }),
    prisma.zone.upsert({ where: { slug: 'paulo-fontes' },     update: {}, create: { slug: 'paulo-fontes',     nome: 'Av. Paulo Fontes',     lat: -27.5942, lng: -48.5510, risco: 71 } }),
    prisma.zone.upsert({ where: { slug: 'victor-meirelles' }, update: {}, create: { slug: 'victor-meirelles', nome: 'Rua Victor Meirelles', lat: -27.5972, lng: -48.5452, risco: 62 } }),
    prisma.zone.upsert({ where: { slug: 'ticen' },            update: {}, create: { slug: 'ticen',            nome: 'Terminal TICEN',       lat: -27.5932, lng: -48.5520, risco: 75 } }),
    prisma.zone.upsert({ where: { slug: 'bocaiuva' },         update: {}, create: { slug: 'bocaiuva',         nome: 'Rua Bocaiúva',         lat: -27.5960, lng: -48.5467, risco: 45 } }),
    prisma.zone.upsert({ where: { slug: 'rio-branco' },       update: {}, create: { slug: 'rio-branco',       nome: 'Av. Rio Branco',       lat: -27.5957, lng: -48.5492, risco: 55 } }),
    prisma.zone.upsert({ where: { slug: 'felipe-schmidt' },   update: {}, create: { slug: 'felipe-schmidt',   nome: 'Rua Felipe Schmidt',   lat: -27.5948, lng: -48.5445, risco: 38 } }),
    prisma.zone.upsert({ where: { slug: 'alfandega' },        update: {}, create: { slug: 'alfandega',        nome: 'Largo da Alfândega',   lat: -27.5976, lng: -48.5498, risco: 70 } }),
  ])

  const zoneMap = Object.fromEntries(zones.map((z) => [z.slug, z.id]))

  const partnerDefaults = { type: 'bar' as const, open_time: '18:00', close_time: '02:00', open_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] }
  await Promise.all([
    prisma.partner.upsert({ where: { slug: 'bar-do-ze' },      update: {}, create: { slug: 'bar-do-ze',      nome: 'Bar do Zé',      lat: -27.5963, lng: -48.5460, zone_id: zoneMap['praca-xv']!,     checkins_hoje: 34, endereco: 'R. Arcipreste Paiva, 2', responsavel: 'José Silva', telefone: '4899999001', ...partnerDefaults } }),
    prisma.partner.upsert({ where: { slug: 'verde-vida' },     update: {}, create: { slug: 'verde-vida',     nome: 'Verde Vida',     lat: -27.5950, lng: -48.5490, zone_id: zoneMap['rio-branco']!,   checkins_hoje: 21, endereco: 'Av. Rio Branco, 140',    responsavel: 'Ana Lima',   telefone: '4899999002', ...partnerDefaults } }),
    prisma.partner.upsert({ where: { slug: 'boteco-central' }, update: {}, create: { slug: 'boteco-central', nome: 'Boteco Central', lat: -27.5968, lng: -48.5478, zone_id: zoneMap['alfandega']!,    checkins_hoje: 15, endereco: 'Largo da Alfândega, 10', responsavel: 'Pedro Costa', telefone: '4899999003', status: 'atencao', ...partnerDefaults } }),
    prisma.partner.upsert({ where: { slug: 'choperia-ilha' },  update: {}, create: { slug: 'choperia-ilha',  nome: 'Choperia Ilha',  lat: -27.5940, lng: -48.5463, zone_id: zoneMap['paulo-fontes']!, checkins_hoje: 28, endereco: 'Av. Paulo Fontes, 88',   responsavel: 'Maria Souza', telefone: '4899999004', ...partnerDefaults } }),
  ])

  // Seed superadmin
  await prisma.admin.upsert({
    where: { email: 'hi@safecity.dev' },
    update: {},
    create: { email: 'hi@safecity.dev', nome: 'Admin Safe City', role: 'superadmin' },
  })

  // Seed sample reports
  const zoneId = zoneMap['praca-xv']!
  const now = new Date()
  await prisma.report.createMany({
    skipDuplicates: true,
    data: [
      { hash: 'SEED001', tipo: 'furto', urgencia: 'alta', status: 'confirmado', local: 'Praça XV', zone_id: zoneId, retrato: { genero: 'homem', idade: 'jovem 15-25', pele: 'parda', cabelo: 'boné', bone_cor: 'preto', roupa: 'camiseta', cor_roupa: 'preta', fuga: 'fugiu' }, confirmacoes: 3, fingerprint: 'seed-fp-1', created_at: new Date(now.getTime() - 8 * 60000), expires_at: new Date(now.getTime() + 37 * 60000) },
      { hash: 'SEED002', tipo: 'suspeito', urgencia: 'media', status: 'ativo', local: 'Av. Paulo Fontes', zone_id: zoneMap['paulo-fontes']!, retrato: { genero: 'homem', idade: 'adulto 26-40', altura: 'alto (>1,80)', detalhe: 'tatuagem no antebraço' }, confirmacoes: 1, fingerprint: 'seed-fp-2', created_at: new Date(now.getTime() - 22 * 60000), expires_at: new Date(now.getTime() + 23 * 60000) },
    ],
  })

  console.log('✅ Seed concluído')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
