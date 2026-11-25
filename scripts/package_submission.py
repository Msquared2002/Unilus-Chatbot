"""Build a reviewed candidate snapshot without Git history or local runtime state."""
import json, re, subprocess, sys, zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]).resolve()
if out.is_relative_to(root):
    raise SystemExit("Choose an archive destination outside the checkout")
names = set(subprocess.check_output(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=root).decode().split("\0"))
names.update({"backend/data/vectors/knowledge_vectors.json", "backend/data/documents/chunks.json", "docs/intelligence-ux/before.json"})
required = {"README.md", "backend/package-lock.json", "dummy-environment/chatbot-widget/package-lock.json", "backend/data/campus/additional-campuses.json", "backend/data/vectors/knowledge_vectors.json", "backend/data/documents/chunks.json"}
test_support = {
    "deployment/stage-a-local.cjs",
    "deployment/provision-runtime-role.sql",
    "deployment/rollback-permissions.sql",
    "android-survey/app/build.gradle",
    "android-survey/app/src/main/AndroidManifest.xml",
    "android-survey/app/src/main/java/zm/ac/unilus/silverestsurvey/MainActivity.java",
}
def allowed(name):
    p = Path(name)
    if not (name.startswith(("backend/", "dummy-environment/", "scripts/", "docs/final-submission/")) or name in required or name in test_support or name in {"Dockerfile", "netlify.toml", "render.yaml", "docs/intelligence-ux/before.json"}):
        return False
    if name == "backend/data/demo_users.json" or any(x in {"node_modules", "uploads", "__pycache__", "3d-prototype"} for x in p.parts):
        return False
    if p.suffix.lower() in {".db", ".sqlite", ".sqlite3", ".zip", ".mp4", ".webm", ".pem", ".key", ".bak"}:
        return False
    if p.name.startswith(".env") and p.name != ".env.example":
        return False
    return (root / name).is_file() and not (root / name).is_symlink()

files = sorted(filter(allowed, names))
if missing := (required | test_support) - set(files):
    raise SystemExit("Missing required files: " + ", ".join(sorted(missing)))
patterns = re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gsk_[A-Za-z0-9]{30,}|sb_secret_[A-Za-z0-9_-]{15,}|scrypt\$[0-9a-f]{32}\$[0-9a-f]{100,}", re.I)
hits = [name for name in files if Path(name).suffix in {".js",".cjs",".json",".md",".txt",".yaml",".sql",".py"} and patterns.search((root/name).read_bytes())]
if hits:
    raise SystemExit("Credential-pattern candidates require review: " + ", ".join(hits))
with zipfile.ZipFile(out, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name in files:
        archive.write(root/name, "UNILUS-Student-Companion/"+name)
    archive.writestr("UNILUS-Student-Companion/PACKAGE_MANIFEST.json", json.dumps(files,indent=2))
print(f"{out}: {len(files)} files, {out.stat().st_size} bytes")
