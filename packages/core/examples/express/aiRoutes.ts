import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  AiHttpError,
  AiResponseParseError,
  AiService,
  AiServiceError,
  AiValidationError,
  type ExtractionRequest,
  type PlanDayRequest,
} from '@make-now/core';

const ai = new AiService({
  apiKey: process.env.GROQ_API_KEY,
  mode: process.env.MOCK_AI === 'true' ? 'mock' : 'live',
});

const router = Router();

router.post('/ai/extract', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as ExtractionRequest;
    const result = await ai.extract(body);
    return res.status(200).json({ data: result.data, validation: result.validation });
  } catch (err) {
    return next(err);
  }
});

router.post('/ai/plan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as PlanDayRequest;
    const result = await ai.planDay(body);
    return res.status(200).json({ data: result.data, validation: result.validation });
  } catch (err) {
    return next(err);
  }
});

export function createAiRouter(): Router {
  return router;
}

export function aiErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AiValidationError) {
    return res.status(422).json({ message: err.message, errors: err.validation.errors, raw: err.rawText });
  }

  if (err instanceof AiResponseParseError) {
    return res.status(502).json({ message: err.message, raw: err.rawText });
  }

  if (err instanceof AiHttpError) {
    return res.status(err.status >= 400 ? err.status : 500).json({ message: err.message, body: err.body });
  }

  if (err instanceof AiServiceError) {
    return res.status(500).json({ message: err.message });
  }

  return res.status(500).json({ message: 'Unexpected error' });
}

// Usage (in your server setup):
// import express from 'express';
// import { createAiRouter, aiErrorHandler } from './aiRoutes';
// const app = express();
// app.use(express.json());
// app.use('/api', createAiRouter());
// app.use(aiErrorHandler);
