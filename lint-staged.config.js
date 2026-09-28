// Lints the whole affected project, which avoids mapping staged paths into each project's cwd.
module.exports = {
  "backend/**/*.{ts,tsx}": () => "npm --prefix backend run lint",
  "frontend/**/*.{ts,tsx}": () => "npm --prefix frontend run lint",
  "extension/**/*.ts": () => "npm --prefix extension run lint",
};
