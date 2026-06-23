import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import leaderboardRouter from "./leaderboard";
import gamificationRouter from "./gamification";
import recommendationsRouter from "./recommendations";
import chatRouter from "./chat";
import translateRouter from "./translate";
import threadsRouter from "./threads";
import adminRouter from "./admin";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(usersRouter);
router.use(leaderboardRouter);
router.use(gamificationRouter);
router.use(recommendationsRouter);
router.use(chatRouter);
router.use(translateRouter);
router.use(threadsRouter);
router.use(adminRouter);

export default router;
