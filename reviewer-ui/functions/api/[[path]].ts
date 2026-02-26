import { type WorkerEnv } from '../lib/env';
import { handleApiRequest } from '../lib/router';

interface PagesFunctionContext {
  request: Request;
  env: WorkerEnv;
}

export async function onRequest(context: PagesFunctionContext): Promise<Response> {
  return handleApiRequest(context.request, context.env);
}
