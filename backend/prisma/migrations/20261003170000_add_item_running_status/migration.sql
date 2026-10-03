-- The queue's progress UI shows which link is importing right now, not just the pending ones.
ALTER TYPE "ImportJobItemStatus" ADD VALUE 'RUNNING';
