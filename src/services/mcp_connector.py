import asyncio
import json
from contextlib import asynccontextmanager
from io import StringIO
from typing import Any, AsyncIterator, Protocol

import pandas as pd


class QueryResultCache(Protocol):
    def get_cached_query_result(
        self, query: str, arguments: dict[str, Any]
    ) -> pd.DataFrame | None: ...

    def cache_query_result(
        self, query: str, arguments: dict[str, Any], frame: pd.DataFrame
    ) -> None: ...


class MCPDataConnector:
    """Open an MCP stdio connection and return tool query results as DataFrames."""

    def __init__(
        self,
        command: str,
        args: list[str] | None = None,
        env: dict[str, str] | None = None,
        query_cache: QueryResultCache | None = None,
    ) -> None:
        if not command.strip():
            raise ValueError("MCP server command cannot be empty")
        self.command = command
        self.args = args or []
        self.env = env
        self.query_cache = query_cache
        self._session: Any | None = None

    @asynccontextmanager
    async def connect(self) -> AsyncIterator["MCPDataConnector"]:
        try:
            from mcp import ClientSession, StdioServerParameters
            from mcp.client.stdio import stdio_client
        except ImportError as error:
            raise RuntimeError("MCP connections require the 'mcp' package") from error

        parameters = StdioServerParameters(
            command=self.command,
            args=self.args,
            env=self.env,
        )
        async with stdio_client(parameters) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                self._session = session
                try:
                    yield self
                finally:
                    self._session = None

    async def query(self, tool_name: str, arguments: dict[str, Any]) -> pd.DataFrame:
        if self._session is None:
            raise RuntimeError("Connect to the MCP server before issuing a query")
        cache_query = json.dumps(
            {"command": self.command, "args": self.args, "tool": tool_name},
            sort_keys=True,
            separators=(",", ":"),
        )
        if self.query_cache is not None:
            cached = await asyncio.to_thread(
                self.query_cache.get_cached_query_result, cache_query, arguments
            )
            if cached is not None:
                return cached
        result = await self._session.call_tool(tool_name, arguments)
        if result.isError:
            detail = "\n".join(
                item.text for item in result.content if hasattr(item, "text")
            )
            raise RuntimeError(f"MCP tool '{tool_name}' failed: {detail}")
        structured = getattr(result, "structuredContent", None)
        if structured is not None:
            frame = self.normalize_result(structured)
        else:
            text_items = [
                item.text for item in result.content if hasattr(item, "text")
            ]
            if not text_items:
                raise ValueError(f"MCP tool '{tool_name}' returned no tabular content")
            if len(text_items) > 1:
                raise ValueError(
                    f"MCP tool '{tool_name}' returned multiple text blocks; "
                    "return one JSON or CSV table"
                )
            frame = self.normalize_result(text_items[0])
        if self.query_cache is not None:
            await asyncio.to_thread(
                self.query_cache.cache_query_result,
                cache_query,
                arguments,
                frame,
            )
        return frame

    @staticmethod
    def normalize_result(result: Any) -> pd.DataFrame:
        if isinstance(result, pd.DataFrame):
            return result.copy()
        if isinstance(result, list):
            if all(isinstance(row, dict) for row in result):
                return pd.DataFrame.from_records(result)
            if all(not isinstance(row, (dict, list)) for row in result):
                return pd.DataFrame({"value": result})
            raise ValueError("MCP query rows must be JSON objects or scalar values")
        if isinstance(result, dict):
            rows = result.get("rows", result.get("records"))
            if rows is not None:
                return MCPDataConnector.normalize_result(rows)
            raise ValueError("MCP JSON result must contain a 'rows' or 'records' list")
        if not isinstance(result, str) or not result.strip():
            raise ValueError("MCP query returned empty or unsupported content")

        try:
            decoded = json.loads(result)
        except json.JSONDecodeError:
            try:
                frame = pd.read_csv(StringIO(result))
            except (pd.errors.ParserError, ValueError) as error:
                raise ValueError("MCP response is neither valid JSON nor CSV") from error
            if frame.empty and not len(frame.columns):
                raise ValueError("MCP CSV response contains no tabular data")
            return frame
        return MCPDataConnector.normalize_result(decoded)


async def run_query(
    command: str,
    args: list[str],
    tool_name: str,
    arguments: dict[str, Any],
    env: dict[str, str] | None = None,
    query_cache: QueryResultCache | None = None,
) -> pd.DataFrame:
    connector = MCPDataConnector(command, args, env, query_cache)
    async with connector.connect():
        return await connector.query(tool_name, arguments)


def run_query_sync(
    command: str,
    args: list[str],
    tool_name: str,
    arguments: dict[str, Any],
    env: dict[str, str] | None = None,
    query_cache: QueryResultCache | None = None,
) -> pd.DataFrame:
    return asyncio.run(
        run_query(command, args, tool_name, arguments, env, query_cache)
    )
