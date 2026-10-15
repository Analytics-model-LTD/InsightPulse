import asyncio
from typing import List
import pandas as pd

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from core.anomaly import DataDiagnostics

# State holding cached data retrieved via MCP
DATA_CACHE: dict[str, pd.DataFrame] = {}

def create_agent(mcp_session: ClientSession):
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    @tool
    async def fetch_mcp_data(tool_name: str, arguments: dict, dataset_alias: str) -> str:
        """Call a data-fetching tool exposed by the connected MCP server and store in local cache."""
        result = await mcp_session.call_tool(tool_name, arguments)
        raw_text = result.content[0].text
        
        # Expecting JSON or CSV structured output from MCP data servers
        import io
        try:
            df = pd.read_json(io.StringIO(raw_text))
        except Exception:
            df = pd.read_csv(io.StringIO(raw_text))
            
        DATA_CACHE[dataset_alias] = df
        return f"Loaded dataset '{dataset_alias}' with shape {df.shape} and columns: {list(df.columns)}"

    @tool
    def run_anomaly_audit(dataset_alias: str, time_col: str = None, freq: str = None) -> dict:
        """Analyze a cached dataset for missing fields, chronological gaps, and numeric outliers."""
        if dataset_alias not in DATA_CACHE:
            return {"error": f"Dataset '{dataset_alias}' not found in cache."}
        
        df = DATA_CACHE[dataset_alias]
        return DataDiagnostics.audit_dataframe(df, time_col=time_col, freq=freq)

    tools = [fetch_mcp_data, run_anomaly_audit]
    
    system_prompt = (
        "You are an expert Data Diagnostics and Reliability Agent. "
        "Your task is to fetch data via the MCP server, run structural and anomaly audits, "
        "and synthesize actionable diagnoses detailing missing entries, irregular cadences, "
        "and distribution outliers."
    )

    # Change the final line of create_agent in agent.py to this:
    return create_react_agent(llm, tools,prompt=system_prompt)