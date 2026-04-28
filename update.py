import subprocess
import sys
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def run(step_name: str, cmd: list[str]) -> None:
    print(f"\n{'='*50}")
    print(f"[{step_name}] 開始...")
    result = subprocess.run(cmd, cwd=BASE_DIR)
    if result.returncode != 0:
        print(f"[{step_name}] 失敗，中止更新。")
        sys.exit(result.returncode)
    print(f"[{step_name}] 完成。")


def git_push() -> None:
    print(f"\n{'='*50}")
    print("[Git] 開始提交並推送...")

    subprocess.run(["git", "add", "index/", "data/", "update.py"], cwd=BASE_DIR)

    # 只看已 staged 的變更（排除 untracked 的 ?? 行）
    status = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=BASE_DIR, capture_output=True, text=True
    )
    staged = [l for l in status.stdout.splitlines() if not l.startswith("??")]
    if not staged:
        print("[Git] 沒有變更，跳過 commit 與 push。")
        return

    today = datetime.now().strftime("%Y-%m-%d")
    commit = subprocess.run(
        ["git", "commit", "-m", f"data: update {today}"],
        cwd=BASE_DIR
    )
    if commit.returncode != 0:
        print("[Git] Commit 失敗，跳過 push。")
        sys.exit(commit.returncode)

    result = subprocess.run(["git", "push", "origin", "main"], cwd=BASE_DIR)
    if result.returncode != 0:
        print("[Git] Push 失敗。請確認網路或 GitHub 認證設定。")
        sys.exit(result.returncode)
    print("[Git] Push 完成。")


if __name__ == "__main__":
    run("1/3 clean_data", [sys.executable, str(BASE_DIR / "clean_data.py")])
    run("2/3 dev",        [sys.executable, str(BASE_DIR / "dev.py")])
    git_push()
    print("\n全部更新完成。")
