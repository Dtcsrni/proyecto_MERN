import { Router } from 'express';
import { middlewaresOmrV1 } from './controladorOmrV1';

const router = Router();

router.get('/templates/:id/preview', ...middlewaresOmrV1.preview);
router.get('/templates/:id/preview/booklet.pdf', ...middlewaresOmrV1.previewBookletPdf);
router.get('/templates/:id/preview/omr-sheet.pdf', ...middlewaresOmrV1.previewOmrPdf);
router.post('/templates/:id/generate', ...middlewaresOmrV1.generate);
router.get('/generated/:id/booklet.pdf', ...middlewaresOmrV1.downloadBooklet);
router.get('/generated/:id/omr-sheet.pdf', ...middlewaresOmrV1.downloadOmrSheet);

export default router;
