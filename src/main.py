import asyncio
import os

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from services.mcp_agent import create_agent
from dotenv import load_dotenv
load_dotenv()

async def main():
    # Configure your MCP server parameters (example: SQLite or custom data server)
    # UPDATE THIS BLOCK IN src/main.py
    server_params = StdioServerParameters(
        command="mcp-server-sqlite",          # Use the CLI command directly
        args=["--db-path", "telemetry.db"],   # Remove "-m" and "mcp_server_sqlite"
        env=None
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # List available tools to inspect capabilities
            tools = await session.list_tools()
            print(f"Connected to MCP Server. Available tools: {[t.name for t in tools.tools]}")

            agent = create_agent(session)
            
            query = (
                "1. Call the 'fetch_mcp_data' tool. Pass tool_name='read_query', "
                "arguments={'query': 'SELECT * FROM system_telemetry'}, and dataset_alias='telemetry'.\n"
                "2. Call the 'run_anomaly_audit' tool on the 'telemetry' dataset using time_col='recorded_at' and freq='1h'.\n"
                "3. Synthesize the findings into a report identifying gaps and outliers."
            )

            response = await agent.ainvoke({"messages": [("user", query)]})
            print("\n--- Diagnostic Findings ---\n")
            print(response["messages"][-1].content)

if __name__ == "__main__":
    asyncio.run(main())