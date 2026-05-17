import { Router, type IRouter } from "express";
import healthRouter from "./health";
import postgrestRouter from "./postgrest";

const router: IRouter = Router();

router.use(healthRouter);
router.use(postgrestRouter);

export default router;
