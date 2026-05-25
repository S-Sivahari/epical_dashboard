import { Router } from 'express'
import { newsController } from '../controllers/newsController'

export const newsRoutes = Router()

newsRoutes.get('/news', newsController.list)
newsRoutes.post('/news', newsController.create)
newsRoutes.put('/news/:id', newsController.update)
newsRoutes.delete('/news/:id', newsController.remove)
