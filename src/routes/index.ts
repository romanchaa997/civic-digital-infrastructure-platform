import { Router } from 'express';
export const apiRouter = Router();
apiRouter.get('/audit', (req, res) => res.json({ message: 'Audit endpoint' }));
apiRouter.get('/compliance', (req, res) => res.json({ message: 'Compliance endpoint' }));
