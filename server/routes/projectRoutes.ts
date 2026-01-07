import express from 'express';
import { protect } from '../middlewares/auth.js';
import { createProject, deleteProject, getProjectById, getProjectPreview, getPublishedProjects, makeRevision, rollbackToVersion, saveProjectCode } from '../controllers/projectController.js';
import { togglePublish } from '../controllers/userController.js';

const projectRouter = express.Router();

projectRouter.get('/published',  getPublishedProjects)
projectRouter.get('/published/:projectId',  getProjectById)
projectRouter.get('/:projectId',protect, getProjectPreview);
projectRouter.post('/', protect, createProject);
projectRouter.post('/revision/:projectId', protect, makeRevision)
projectRouter.put('/save/:projectId', protect, saveProjectCode)
projectRouter.put('/publish/:projectId', protect, togglePublish);
projectRouter.get('/rollback/:projectId/:versionId', protect, rollbackToVersion)
projectRouter.post('/rollback/:projectId/:versionId', protect, rollbackToVersion)
projectRouter.delete('/:projectId', protect, deleteProject)
projectRouter.get('/preview/:projectId', protect, getProjectPreview)


export default projectRouter