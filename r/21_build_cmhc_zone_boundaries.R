#!/usr/bin/env Rscript
# ---------------------------------------------------------------------------
# 21_build_cmhc_zone_boundaries.R — CMHC survey-zone + neighbourhood polygons
# for the map views (the geographies the rental/starts tabs key on).
#
# Source: CMHC RMS geographies (RMS2017 File Geodatabases), fetched via the
# mountainMath `cmhc` package's download_geographies() into r/lib/cache/ and
# cached there. The geometry is CMHC-created "Information"; CMHC's data licence
# grants rights to reproduce/publish/distribute the Information and Value-added
# Products derived from it, with attribution and no CMHC marks
# (https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/
#  housing-data/cmhc-licence-agreement-use-of-data). The map cards carry an
# "Adapted from CMHC" source line.
#
# Join model: app zone/neighbourhood GeoUIDs are "<cma3>-<zone_slug(name)>"
# (r/02 + r/05, slug rule in cmhc_helpers.R). The GDB keys on its own METCODE
# (Winnipeg 2680 != app 602) but the MET layer's SGCCODE IS the app CMA code,
# so the mapping is derived, not hardcoded. Feature id resolution per polygon:
#   1. slug(long name)  if it matches an app uid
#   2. slug(short name) if it matches an app uid
#   3. r/lib/cmhc_geo_aliases.csv (typos / abbreviation variants in API names)
#   4. otherwise keep slug(long name) — the polygon renders as no-data.
# App uids that end up with no polygon are mostly historical year-variant
# names (composite areas whose full name shifted between surveys — a sibling
# hash-uid claims the polygon) — they stay usable via the dropdowns.
#
# Output: web/public/data/geo/zones_<cma>.geojson + nbhd_<cma>.geojson
# (WGS84, mapshaper-simplified, RFC7946), one pair per surveyed CMA in the
# app's data. Run:  Rscript r/21_build_cmhc_zone_boundaries.R
# ---------------------------------------------------------------------------

suppressMessages({ library(cmhc); library(sf); library(jsonlite) })

this_dir <- tryCatch(dirname(sub("^--file=", "",
             grep("^--file=", commandArgs(FALSE), value = TRUE)[1])), error = function(e) ".")
if (is.na(this_dir) || !nzchar(this_dir)) this_dir <- "r"
ROOT   <- normalizePath(file.path(this_dir, ".."), mustWork = FALSE)
cache  <- file.path(ROOT, "r", "lib", "cache", "cmhc_geo")
outdir <- file.path(ROOT, "web", "public", "data", "geo")
dir.create(cache,  recursive = TRUE, showWarnings = FALSE)
dir.create(outdir, recursive = TRUE, showWarnings = FALSE)

source(file.path(ROOT, "r", "lib", "cmhc_helpers.R"))   # zone_slug / zone_uid_hash

# --- mapshaper simplify (same flow as r/20) ---------------------------------
ms_bin <- (function() {
  ext <- if (.Platform$OS.type == "windows") ".cmd" else ""
  p <- file.path(ROOT, "web", "node_modules", ".bin", paste0("mapshaper", ext))
  if (file.exists(p)) p else NA_character_
})()
mapshaper_simplify <- function(in_geojson, out_geojson, pct) {
  if (is.na(ms_bin)) return(FALSE)
  if (file.exists(out_geojson)) unlink(out_geojson)
  args <- c(in_geojson, "-simplify", pct, "keep-shapes",
            "-o", "precision=0.0001", "rfc7946", out_geojson, "force")
  ok <- tryCatch(system2(ms_bin, args, stdout = FALSE, stderr = FALSE) == 0, error = function(e) FALSE)
  ok && file.exists(out_geojson)
}
write_geojson <- function(g, dest) {
  if (file.exists(dest)) unlink(dest)
  sf::st_write(g, dest, driver = "GeoJSON", quiet = TRUE, layer_options = "COORDINATE_PRECISION=5")
}

# --- app-side uids (rental + starts geography lists) ------------------------
app_uids <- function(path, lvl) {
  f <- file.path(ROOT, "web", "public", "data", path)
  if (!file.exists(f)) return(character(0))
  g <- fromJSON(f, simplifyVector = TRUE); it <- g$levels[[lvl]]
  if (is.null(it)) character(0) else as.character(it$uid)
}
app_zone <- unique(c(app_uids("geographies.json", "zone"),          app_uids("starts-geographies.json", "zone")))
app_nbhd <- unique(c(app_uids("geographies.json", "neighbourhood"), app_uids("starts-geographies.json", "neighbourhood")))
app_cmas <- sort(unique(sub("-.*$", "", c(app_zone, app_nbhd))))
message("App zone uids: ", length(app_zone), " | nbhd uids: ", length(app_nbhd),
        " | CMAs: ", paste(app_cmas, collapse = ", "))

aliases <- utils::read.csv(file.path(ROOT, "r", "lib", "cmhc_geo_aliases.csv"), stringsAsFactors = FALSE)

# --- load GDB layers, map METCODE -> app CMA code via SGCCODE ---------------
met <- sf::st_drop_geometry(get_cmhc_geography(level = "MET", base_directory = cache))
met$app_code <- as.character(met$SGCCODE)
met_map <- met[met$app_code %in% app_cmas, c("METCODE", "app_code")]

build_level <- function(level, name_short, name_long, app_set, prefix) {
  g <- get_cmhc_geography(level = level, base_directory = cache)
  g <- merge(g, met_map, by.x = "MET_CODE", by.y = "METCODE")
  g$uid_s <- paste0(g$app_code, "-", zone_slug(g[[name_short]]))
  g$uid_l <- paste0(g$app_code, "-", zone_slug(g[[name_long]]))

  # id resolution: long slug > short slug > alias > long slug (no-data)
  claimed <- character(0)
  g$id <- NA_character_
  pick <- function(cand, i) { if (!is.na(cand) && cand %in% app_set && !(cand %in% claimed)) cand else NA_character_ }
  for (i in seq_len(nrow(g))) {
    id <- pick(g$uid_l[i], i)
    if (is.na(id)) id <- pick(g$uid_s[i], i)
    if (is.na(id)) {
      hit <- aliases$app_uid[match(g$uid_l[i], aliases$gdb_uid)]
      if (!is.na(hit) && hit %in% app_set && !(hit %in% claimed)) id <- hit
    }
    if (is.na(id)) id <- g$uid_l[i]
    g$id[i] <- id
    claimed <- c(claimed, id)
  }
  covered <- app_set %in% g$id
  message(sprintf("[%s] polygons: %d | app uids matched: %d/%d (%.1f%%)",
                  level, nrow(g), sum(covered), length(app_set), 100 * mean(covered)))
  if (any(!covered)) message("  no polygon (dropdown-only): ", paste(app_set[!covered], collapse = ", "))

  g <- sf::st_transform(g, 4326)
  out <- sf::st_sf(id = g$id, name = as.character(g[[name_short]]),
                   cma = g$app_code, geometry = sf::st_geometry(g))
  for (cma in sort(unique(out$cma))) {
    sub  <- out[out$cma == cma, c("id", "name")]
    dest <- file.path(outdir, sprintf("%s_%s.geojson", prefix, cma))
    tmp  <- file.path(tempdir(), sprintf("%s_%s_full.geojson", prefix, cma))
    write_geojson(sub, tmp)
    how <- if (mapshaper_simplify(tmp, dest, "12%")) "mapshaper" else {
      gp <- sf::st_transform(sub, 3347)
      gp <- sf::st_simplify(gp, dTolerance = 60, preserveTopology = TRUE)
      write_geojson(sf::st_transform(gp, 4326), dest); "st_simplify(fallback)"
    }
    message(sprintf("  wrote %s — %d features, %.0f KB [%s]",
                    basename(dest), nrow(sub), file.info(dest)$size / 1024, how))
  }
  invisible(NULL)
}

build_level("ZONE", "ZONE_NAME_EN", "ZONE_NAME_LONG_EN", app_zone, "zones")
build_level("NBHD", "NBHD_NAME_EN", "NBHD_NAME_LONG_EN", app_nbhd, "nbhd")
message("Done. CMHC zone/neighbourhood boundaries in web/public/data/geo/")
