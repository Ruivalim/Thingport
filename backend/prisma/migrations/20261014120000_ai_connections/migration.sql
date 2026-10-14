-- CreateTable
CREATE TABLE "AiConnection" (
    "id" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT,
    "model" TEXT NOT NULL,
    "timeoutMs" INTEGER NOT NULL DEFAULT 60000,
    "concurrency" INTEGER NOT NULL DEFAULT 1,
    "thinking" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConnection_pkey" PRIMARY KEY ("id")
);

-- The single connection stored with the categorization settings becomes the first AI, and the default.
INSERT INTO "AiConnection" ("id", "baseUrl", "apiKey", "model", "timeoutMs", "concurrency", "thinking", "isDefault", "position", "updatedAt")
SELECT
    'ai' || substr(md5(random()::text || clock_timestamp()::text), 1, 23),
    "value"->>'baseUrl',
    NULLIF(btrim("value"->>'apiKey'), ''),
    btrim("value"->>'model'),
    CASE WHEN jsonb_typeof("value"->'timeoutMs') = 'number' THEN ("value"->>'timeoutMs')::numeric::integer ELSE 60000 END,
    CASE WHEN jsonb_typeof("value"->'concurrency') = 'number' THEN ("value"->>'concurrency')::numeric::integer ELSE 1 END,
    CASE WHEN jsonb_typeof("value"->'thinking') = 'boolean' THEN ("value"->>'thinking')::boolean ELSE true END,
    true,
    0,
    CURRENT_TIMESTAMP
FROM "Setting"
WHERE "key" = 'ai_categorization'
  AND COALESCE(btrim("value"->>'baseUrl'), '') <> ''
  AND COALESCE(btrim("value"->>'model'), '') <> '';

-- What's left there is how categorization behaves, not which AI it talks to.
UPDATE "Setting"
SET "value" = "value" - 'baseUrl' - 'apiKey' - 'model' - 'timeoutMs' - 'concurrency' - 'thinking'
WHERE "key" = 'ai_categorization' AND jsonb_typeof("value") = 'object';
