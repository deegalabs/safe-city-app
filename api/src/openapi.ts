/**
 * OpenAPI 3 spec for Safe City API.
 * UI at GET /docs
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Safe City API',
    version: '0.1.0',
    description: 'Safe City API — alerts, bot, reports, admin.',
  },
  servers: [
    { url: 'https://api-production-8437.up.railway.app', description: 'Produção (Railway)' },
    { url: 'http://localhost:3000', description: 'Local' },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['Health'],
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, ts: { type: 'string', format: 'date-time' } } } } } } },
      },
    },
    '/api/reports': {
      post: {
        summary: 'Cria report anônimo',
        tags: ['Reports'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tipo', 'urgencia', 'local', 'zone_id', 'fingerprint'],
                properties: {
                  tipo: { type: 'string', enum: ['furto', 'violencia', 'assedio', 'suspeito', 'infra'] },
                  urgencia: { type: 'string', enum: ['alta', 'media', 'baixa'] },
                  local: { type: 'string', minLength: 2, maxLength: 100 },
                  zone_id: { type: 'string' },
                  fingerprint: { type: 'string', minLength: 10 },
                  channel: { type: 'string', enum: ['pwa', 'whatsapp'], default: 'pwa' },
                  retrato: { type: 'object', additionalProperties: true },
                  extra: { type: 'string', maxLength: 500 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Report criado' }, 429: { description: 'Rate limit / bloqueado' } },
      },
    },
    '/api/reports/active': {
      get: {
        summary: 'Lista alertas ativos',
        tags: ['Reports'],
        parameters: [{ name: 'zone', in: 'query', schema: { type: 'string' }, description: 'Filtro por zone_id' }],
        responses: { 200: { description: 'Lista de reports ativos' } },
      },
    },
    '/api/reports/{id}/confirm': {
      post: {
        summary: 'Confirma alerta (fingerprint)',
        tags: ['Reports'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['fingerprint'], properties: { fingerprint: { type: 'string', minLength: 10 } } } } } },
        responses: { 200: { description: 'Confirmado' }, 404: { description: 'Não encontrado' }, 410: { description: 'Expirado' } },
      },
    },
    '/api/bot/message': {
      post: {
        summary: 'Envia interação ao bot (PWA)',
        tags: ['Bot'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sessionId'],
                properties: {
                  sessionId: { type: 'string' },
                  text: { type: 'string' },
                  optionKey: { type: 'string' },
                  optionData: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Resposta do bot' } },
      },
    },
    '/api/zones': {
      get: { summary: 'Zonas com risco e alertas', tags: ['Zones'], responses: { 200: { description: 'Lista de zonas' } } },
    },
    '/api/partners': {
      get: { summary: 'Parceiros ativos', tags: ['Partners'], responses: { 200: { description: 'Lista de parceiros' } } },
    },
    '/api/partners/checkin': {
      post: { summary: 'Check-in anônimo em parceiro', tags: ['Partners'], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: { description: 'OK' } } },
    },
    '/api/stats/public': {
      get: { summary: 'Estatísticas agregadas da semana', tags: ['Stats'], responses: { 200: { description: 'Stats' } } },
    },
    '/api/subscribe': {
      post: { summary: 'Registra push subscription', tags: ['Subscribe'], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: { description: 'OK' } } },
    },
    // POST /api/whatsapp/webhook/:token — intencionalmente não documentado (URL secreta)
    '/api/whatsapp/status': {
      get: { summary: 'Status da instância WhatsApp', tags: ['WhatsApp'], responses: { 200: { description: 'OK' } } },
    },
    '/api/admin/dashboard': {
      get: { summary: 'Métricas gerais (auth)', tags: ['Admin'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Dashboard' } } },
    },
    '/api/admin/reports': {
      get: { summary: 'Reports paginados (auth)', tags: ['Admin'], security: [{ bearerAuth: [] }], parameters: [{ name: 'status', in: 'query' }, { name: 'zone', in: 'query' }, { name: 'page', in: 'query' }, { name: 'limit', in: 'query' }], responses: { 200: { description: 'Lista' } } },
    },
    '/api/admin/partners': {
      get: { summary: 'Lista parceiros (auth)', tags: ['Admin'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Lista' } } },
    },
    '/api/admin/admins': {
      get: { summary: 'Lista admins (superadmin)', tags: ['Admin'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Lista' } } },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Token Supabase Auth (JWT)' },
    },
  },
} as const
