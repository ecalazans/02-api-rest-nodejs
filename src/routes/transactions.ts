import { FastifyInstance } from 'fastify';
import { string, z } from 'zod';
import { randomUUID } from 'node:crypto';
import { knex } from '../database';
import { checkSessionIdExists } from '../middlewares/check-sessioni-d-exists';

export async function transactionsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request) => {
    console.log(`[${request.method}] ${request.url}`);
  });

  app.get(
    '/',
    {
      preHandler: [checkSessionIdExists],
    },
    async (request) => {
      const { sessionId } = request.cookies;

      const transactions = await knex('transactions')
        .where('session_id', sessionId)
        .select();

      return { transactions };
    },
  );

  app.get(
    '/:id',
    {
      preHandler: [checkSessionIdExists],
    },
    async (request) => {
      const getTransactionsParamsSchema = z.object({
        id: string().uuid(),
      });

      const { id } = getTransactionsParamsSchema.parse(request.params);

      const { sessionId } = request.cookies;

      const transaction = await knex('transactions')
        .where({
          session_id: sessionId,
          id,
        })
        .first();

      return { transaction };
    },
  );

  app.get(
    '/summary',
    {
      preHandler: [checkSessionIdExists],
    },
    async (request) => {
      const { sessionId } = request.cookies;

      const summary = await knex('transactions')
        .where('session_id', sessionId)
        .sum('amount', { as: 'amount' })
        .first();

      return { summary };
    },
  );

  app.post('/', async (request, reply) => {
    const createTransactionsBodySchema = z.object({
      title: z.string(), // tipo de dados da requisição body
      amount: z.number(), // tipo de dados da requisição body
      type: z.enum(['credit', 'debit']), // enum pode ser um(credit) ou outro(debit)
    });

    // o parse irá validar os dados do request, caso
    // seja falso ele não irá avançar
    const { title, amount, type } = createTransactionsBodySchema.parse(
      request.body,
    );

    let sessionId = request.cookies.sessionId;

    if (!sessionId) {
      sessionId = randomUUID();

      reply.cookie('sessionId', sessionId, {
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      });
    }

    await knex('transactions').insert({
      id: randomUUID(),
      title,
      amount: type === 'credit' ? amount : amount * -1,
      session_id: sessionId,
    });

    return reply.status(201).send();
  });
}
