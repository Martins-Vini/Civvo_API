import express from 'express';
import { FollowerController } from '../controllers/followerController.js';

const router = express.Router();

router.post('/', FollowerController.followUser);
router.delete('/:followingId', FollowerController.unfollowUser);
router.get('/:userId/followers', FollowerController.listFollowers);
router.get('/:userId/following', FollowerController.listFollowing);

export default router;