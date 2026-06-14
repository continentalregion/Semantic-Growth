import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import leaderboardRouter from "./leaderboard";
import gamificationRouter from "./gamification";
import recommendationsRouter from "./recommendations";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(leaderboardRouter);
router.use(gamificationRouter);
router.use(recommendationsRouter);
router.use(chatRouter);

export default router;
