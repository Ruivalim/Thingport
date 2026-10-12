CREATE TABLE "ProviderListing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderListing_userId_provider_key_key" ON "ProviderListing"("userId", "provider", "key");

ALTER TABLE "ProviderListing" ADD CONSTRAINT "ProviderListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
