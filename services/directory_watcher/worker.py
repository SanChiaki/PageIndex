import time

from services.common.settings import DB_PATH, DIRECTORY_SCAN_INTERVAL_SECONDS, PROJECTS_ROOT
from services.directory_watcher.sync import sync_once


def run_forever(poll_seconds: float = DIRECTORY_SCAN_INTERVAL_SECONDS):
    while True:
        sync_once(str(DB_PATH), PROJECTS_ROOT)
        time.sleep(poll_seconds)


if __name__ == "__main__":
    run_forever()
