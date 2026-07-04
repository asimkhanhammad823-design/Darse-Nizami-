import httpx

from .config import WORKER_BASE_URL


class WorkerError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class WorkerClient:
    def __init__(self, token: str):
        self._token = token

    async def _request(self, method: str, path: str, **kwargs) -> dict | list:
        try:
            async with httpx.AsyncClient(base_url=WORKER_BASE_URL, timeout=30) as client:
                response = await client.request(
                    method,
                    path,
                    headers={"authorization": f"Bearer {self._token}"},
                    **kwargs,
                )
        except httpx.HTTPError as exc:
            raise WorkerError(503, f"Could not reach the Worker at {WORKER_BASE_URL}: {exc}") from exc
        if response.status_code >= 400:
            try:
                message = response.json().get("error", response.text)
            except ValueError:
                message = response.text
            raise WorkerError(response.status_code, message)
        if response.status_code == 204 or not response.content:
            return {}
        return response.json()

    async def get(self, path: str):
        return await self._request("GET", path)

    async def post(self, path: str, body: dict):
        return await self._request("POST", path, json=body)

    async def put(self, path: str, body: dict):
        return await self._request("PUT", path, json=body)

    async def delete(self, path: str):
        return await self._request("DELETE", path)


async def login(access_code: str) -> dict:
    try:
        async with httpx.AsyncClient(base_url=WORKER_BASE_URL, timeout=30) as client:
            response = await client.post("/login", json={"access_code": access_code})
    except httpx.HTTPError as exc:
        raise WorkerError(503, f"Could not reach the Worker at {WORKER_BASE_URL}: {exc}") from exc
    if response.status_code >= 400:
        try:
            message = response.json().get("error", "Login failed")
        except ValueError:
            message = "Login failed"
        raise WorkerError(response.status_code, message)
    return response.json()
