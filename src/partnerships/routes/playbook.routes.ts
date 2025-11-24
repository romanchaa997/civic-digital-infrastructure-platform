import { Router, Request, Response } from 'express';
import { Repository } from 'typeorm';
import { Playbook } from '../models/playbook.model';
import { authenticate } from '../../middleware/auth.middleware';

export function createPlaybookRoutes(db: Repository<Playbook>): Router {
  const router = Router();

  // Create playbook
  router.post('/', authenticate, async (req: Request, res: Response) => {
    try {
      const playbook = db.create(req.body);
      playbook.owner = req.user.id;
      const saved = await db.save(playbook);
      res.status(201).json(saved);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get all playbooks
  router.get('/', authenticate, async (req: Request, res: Response) => {
    try {
      const { skip = 0, take = 20 } = req.query;
      const [playbooks, total] = await db.findAndCount({
        skip: Number(skip),
        take: Number(take),
        order: { createdAt: 'DESC' }
      });
      res.json({ data: playbooks, total, skip: Number(skip), take: Number(take) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get playbook by ID
  router.get('/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const playbook = await db.findOne({ where: { id: req.params.id } });
      if (!playbook) return res.status(404).json({ error: 'Not found' });
      res.json(playbook);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update playbook
  router.put('/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const playbook = await db.findOne({ where: { id: req.params.id } });
      if (!playbook) return res.status(404).json({ error: 'Not found' });
      Object.assign(playbook, req.body);
      const updated = await db.save(playbook);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete playbook
  router.delete('/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const result = await db.delete(req.params.id);
      if (result.affected === 0) return res.status(404).json({ error: 'Not found' });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Execute playbook
  router.post('/:id/execute', authenticate, async (req: Request, res: Response) => {
    try {
      const playbook = await db.findOne({ where: { id: req.params.id } });
      if (!playbook) return res.status(404).json({ error: 'Not found' });
      // Execution logic would be implemented via playbookService
      res.json({ executionId: 'pending', status: 'queued' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
