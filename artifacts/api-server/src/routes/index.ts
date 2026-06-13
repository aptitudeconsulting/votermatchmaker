import { Router, type IRouter } from "express";
import health from "./health";
import issues from "./issues";
import stats from "./stats";
import candidates from "./candidates";
import profile from "./profile";
import matches from "./matches";
import ballot from "./ballot";

const router: IRouter = Router();

router.use(health);
router.use(issues);
router.use(stats);
router.use(candidates);
router.use(profile);
router.use(matches);
router.use(ballot);

export default router;
