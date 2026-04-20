-- CreateEnum
CREATE TYPE "CommentKind" AS ENUM ('COMMENT', 'SYSTEM');

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "kind" "CommentKind" NOT NULL DEFAULT 'COMMENT',
ADD COLUMN     "meta" JSONB;
