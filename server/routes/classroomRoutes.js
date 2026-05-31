import express from 'express';
import { requireAuth } from '@clerk/express';
import { createClassroom, joinClassroom, getMyClassrooms, getClassroomDetail, createPost, editPost, deleteClassroom, removeStudent, deletePost, askTutor } from '../controllers/classroomController.js';
import upload from '../middlewares/multer.js';

const classroomRouter = express.Router();

classroomRouter.post('/create', requireAuth(), createClassroom);
classroomRouter.post('/join', requireAuth(), joinClassroom);
classroomRouter.get('/my-classes', requireAuth(), getMyClassrooms);
classroomRouter.get('/:id', requireAuth(), getClassroomDetail);
classroomRouter.post('/:id/posts', requireAuth(), upload.single('file'), createPost);
classroomRouter.post('/:id/tutor', requireAuth(), askTutor);
classroomRouter.put('/posts/:postId', requireAuth(), editPost);
classroomRouter.delete('/posts/:postId', requireAuth(), deletePost);
classroomRouter.delete('/:id', requireAuth(), deleteClassroom);
classroomRouter.delete('/:id/students/:studentId', requireAuth(), removeStudent);

export default classroomRouter;
