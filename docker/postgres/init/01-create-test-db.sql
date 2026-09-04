-- Runs once, on the first start of an empty Postgres volume.
-- A separate database for the automated tests, so `pnpm test` never wipes your dev data.
CREATE DATABASE askdocs_test;
