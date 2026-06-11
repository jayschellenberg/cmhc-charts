@echo off
REM Local convenience wrapper. Re-runs the R pipeline, regenerates JSON
REM shards, and (if anything changed) commits + pushes so Vercel redeploys.
REM Equivalent to running the .github/workflows/refresh-data.yml action by hand.

setlocal
cd /d "%~dp0"

REM Match the GitHub Actions scope so local refreshes don't silently scrape a
REM thinner dataset and overwrite full shards. Without these, defaults in
REM r/02_scrape_zone_snapshots.R and r/05_scrape_starts.R fall back to
REM Winnipeg + All-dwelling only, which deletes Apartment/Row records and
REM every non-Winnipeg zone on commit.
set "CMHC_ZONE_CMAS=ALL"
set "CMHC_ZONE_DWELLING=ALL"
set "CMHC_STARTS_ZONES=ALL"

call npm --prefix web run data:all || goto :err

REM Anything to commit?
git diff --quiet web/public/data
if errorlevel 1 (
  git add web/public/data
  git commit -m "data: monthly refresh"
  git push
) else (
  echo No data changes.
)
exit /b 0

:err
echo Pipeline failed; aborting.
exit /b 1
