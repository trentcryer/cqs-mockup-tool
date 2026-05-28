import base64
import time
from pathlib import Path

import httpx

BASE_URL = "https://api.printful.com"


class PrintfulError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class PrintfulClient:
    def __init__(self, api_key: str, timeout: int = 30):
        self._http = httpx.Client(
            base_url=BASE_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout,
        )

    def _get(self, path: str, **params) -> dict:
        r = self._http.get(path, params=params or None)
        self._raise(r)
        return r.json()["result"]

    def _post(self, path: str, body: dict) -> dict:
        r = self._http.post(path, json=body)
        self._raise(r)
        return r.json()["result"]

    @staticmethod
    def _raise(response: httpx.Response) -> None:
        if response.is_error:
            try:
                msg = response.json().get("error", {}).get("message", response.text)
            except Exception:
                msg = response.text
            raise PrintfulError(msg, response.status_code)

    # --- Catalog ---

    def get_products(self) -> list[dict]:
        return self._get("/products")

    def get_product(self, product_id: int) -> dict:
        return self._get(f"/products/{product_id}")

    # --- Mockup generator ---

    def get_printfiles(self, product_id: int) -> dict:
        return self._get(f"/mockup-generator/printfiles/{product_id}")

    def upload_file(self, file_path: Path) -> dict:
        contents = base64.b64encode(file_path.read_bytes()).decode()
        result = self._post("/files", {"filename": file_path.name, "data": contents})
        # Base64 uploads never get a public `url`; preview_url is accessible and usable
        if not result.get("url") and result.get("preview_url"):
            result["url"] = result["preview_url"]
        return result

    def create_mockup_task(
        self,
        product_id: int,
        variant_ids: list[int],
        placement: str,
        image_url: str,
        position: dict,
        fmt: str = "jpg",
    ) -> str:
        result = self._post(
            f"/mockup-generator/create-task/{product_id}",
            {
                "variant_ids": variant_ids,
                "format": fmt,
                "files": [{"placement": placement, "image_url": image_url, "position": position}],
            },
        )
        return result["task_key"]

    def get_task(self, task_key: str) -> dict:
        return self._get("/mockup-generator/task", task_key=task_key)

    def poll_task(self, task_key: str, interval: int = 3, max_polls: int = 20) -> dict:
        for _ in range(max_polls):
            result = self.get_task(task_key)
            status = result["status"]
            if status == "completed":
                return result
            if status == "failed":
                raise PrintfulError(f"Mockup task failed: {result.get('error', 'unknown')}")
            time.sleep(interval)
        raise TimeoutError(f"Mockup task timed out after {max_polls * interval}s")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self._http.close()
